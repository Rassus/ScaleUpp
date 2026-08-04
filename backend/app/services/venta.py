from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlmodel import Session, col, select

from app.models import DetalleVenta, Producto, Venta, VentaItem
from app.models.enums import TipoMovimiento, TipoProducto
from app.schemas.venta import (
    DetalleVentaOut,
    VentaCreate,
    VentaItemOut,
    VentaOut,
)
from app.services.receta import expandir_kit, get_kit_or_404
from app.services.stock import registrar_salida_fifo


def _split_iva(total_bruto: int, iva_pct: Decimal) -> tuple[int, int]:
    """precio público con IVA incluido → (neto, iva)."""
    if iva_pct <= 0:
        return total_bruto, 0
    factor = Decimal("1") + (iva_pct / Decimal("100"))
    neto = int(
        (Decimal(total_bruto) / factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )
    iva = total_bruto - neto
    return neto, iva


def redondear_efectivo(monto: int) -> int:
    """Redondeo chileno a múltiplo de $10: 0–4 abajo, 5–9 arriba."""
    if monto == 0:
        return 0
    signo = -1 if monto < 0 else 1
    abs_m = abs(monto)
    resto = abs_m % 10
    if resto == 0:
        return monto
    if resto >= 5:
        return signo * (abs_m + (10 - resto))
    return signo * (abs_m - resto)

def _get_producto_vendible(
    session: Session, producto_id: int, negocio_id: int
) -> Producto:
    producto = session.get(Producto, producto_id)
    if producto is None or producto.negocio_id != negocio_id or not producto.activo:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")
    return producto


def venta_to_out(
    session: Session, venta: Venta, *, include_details: bool = True
) -> VentaOut:
    items_rows = session.exec(
        select(VentaItem, Producto)
        .join(Producto, Producto.id == VentaItem.producto_id)
        .where(VentaItem.venta_id == venta.id)
        .order_by(col(VentaItem.id).asc())
    ).all()
    items = [
        VentaItemOut(
            id=item.id,  # type: ignore[arg-type]
            producto_id=item.producto_id,
            producto_nombre=prod.nombre,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            subtotal=item.subtotal,
        )
        for item, prod in items_rows
    ]

    detalles: list[DetalleVentaOut] = []
    if include_details:
        dets = session.exec(
            select(DetalleVenta)
            .where(DetalleVenta.venta_id == venta.id)
            .order_by(col(DetalleVenta.id).asc())
        ).all()
        detalles = [
            DetalleVentaOut(
                id=d.id,  # type: ignore[arg-type]
                venta_item_id=d.venta_item_id,
                producto_vendido_id=d.producto_vendido_id,
                producto_id=d.producto_id,
                lote_id=d.lote_id,
                cantidad=d.cantidad,
                precio_unitario_venta=d.precio_unitario_venta,
                costo_unitario=d.costo_unitario,
            )
            for d in dets
        ]

    return VentaOut(
        id=venta.id,  # type: ignore[arg-type]
        numero=venta.numero,
        negocio_id=venta.negocio_id,
        caja_chica_id=getattr(venta, "caja_chica_id", None),
        usuario_id=venta.usuario_id,
        cliente_id=venta.cliente_id,
        fecha_hora=venta.fecha_hora,
        metodo_pago=venta.metodo_pago,
        total_venta=venta.total_venta,
        total_neto=venta.total_neto,
        total_iva=venta.total_iva,
        monto_recargo=getattr(venta, "monto_recargo", 0) or 0,
        porcentaje_recargo=getattr(venta, "porcentaje_recargo", Decimal("0"))
        or Decimal("0"),
        monto_descuento_promo=getattr(venta, "monto_descuento_promo", 0) or 0,
        costo_total=venta.costo_total,
        ganancia=venta.ganancia,
        anulada=venta.anulada,
        items=items,
        detalles=detalles,
    )


def registrar_venta(
    session: Session,
    *,
    negocio_id: int,
    usuario_id: int | None,
    data: VentaCreate,
    commit: bool = True,
) -> VentaOut:
    if not data.items:
        raise HTTPException(status_code=400, detail="La venta no tiene ítems")

    from app.models.enums import MetodoPago
    from app.services.credito import (
        crear_cargo_fiado,
        validar_cupo_fiado,
    )

    cliente = None
    recargo_pct: Decimal | None = None
    if data.metodo_pago == MetodoPago.CREDITO:
        if data.cliente_id is None:
            raise HTTPException(
                status_code=400, detail="cliente_id es obligatorio para crédito"
            )
        from app.services.credito import obtener_cliente

        cliente = obtener_cliente(
            session, negocio_id=negocio_id, cliente_id=data.cliente_id
        )
        if not cliente.activo:
            raise HTTPException(status_code=400, detail="El cliente está inactivo")
        recargo_pct = cliente.porcentaje_recargo

    # 1) Validar líneas y armar consumos requeridos por componente
    # Precios de ítem = precio lista (sin recargo). El recargo va aparte.
    from app.services.promocion import resolver_precio_efectivo

    lineas: list[tuple[Producto, Decimal, int, int]] = []
    # (producto_vendido, qty, precio_unitario, subtotal)
    necesidades: dict[int, Decimal] = {}  # producto_simple_id -> qty a descontar
    monto_descuento_promo = 0

    for raw in data.items:
        producto = _get_producto_vendible(session, raw.producto_id, negocio_id)
        resuelto = resolver_precio_efectivo(
            session, negocio_id=negocio_id, producto=producto
        )
        if resuelto.promocion_id is not None:
            precio = resuelto.precio_efectivo
        elif raw.precio_unitario is not None:
            precio = int(raw.precio_unitario)
        else:
            precio = resuelto.precio_efectivo
        ahorro_u = max(0, resuelto.precio_lista - precio)
        subtotal = int(
            (Decimal(precio) * raw.cantidad).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
        monto_descuento_promo += int(
            (Decimal(ahorro_u) * raw.cantidad).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
        lineas.append((producto, raw.cantidad, precio, subtotal))

        if producto.tipo == TipoProducto.SIMPLE:
            necesidades[producto.id] = (  # type: ignore[index]
                necesidades.get(producto.id, Decimal("0")) + raw.cantidad  # type: ignore[arg-type]
            )
        elif producto.tipo == TipoProducto.KIT:
            kit = get_kit_or_404(session, producto.id, negocio_id)  # type: ignore[arg-type]
            expansion = expandir_kit(session, kit=kit, cantidad_kits=raw.cantidad)
            for comp in expansion.componentes:
                necesidades[comp.producto_id] = (
                    necesidades.get(comp.producto_id, Decimal("0")) + comp.cantidad
                )
        else:
            raise HTTPException(status_code=400, detail="Tipo de producto no soportado")

    subtotal_productos = sum(sub for *_, sub in lineas)
    monto_recargo = 0
    pct_guardar = Decimal("0.00")
    if recargo_pct is not None and recargo_pct > 0:
        pct_guardar = recargo_pct.quantize(Decimal("0.01"))
        monto_recargo = int(
            (Decimal(subtotal_productos) * pct_guardar / Decimal("100")).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
    total_venta = subtotal_productos + monto_recargo
    if data.metodo_pago == MetodoPago.EFECTIVO:
        total_venta = redondear_efectivo(total_venta)
    total_neto, total_iva = _split_iva(total_venta, data.iva_porcentaje)

    if data.metodo_pago == MetodoPago.CREDITO:
        assert data.cliente_id is not None
        cliente = validar_cupo_fiado(
            session,
            negocio_id=negocio_id,
            cliente_id=data.cliente_id,
            monto_nuevo=total_venta,
        )

    from app.services.caja import require_caja_abierta
    from app.services.folios import siguiente_numero_venta_caja

    caja = require_caja_abierta(session, negocio_id=negocio_id)

    venta = Venta(
        negocio_id=negocio_id,
        caja_chica_id=caja.id,  # type: ignore[arg-type]
        numero=siguiente_numero_venta_caja(session, caja_id=caja.id),  # type: ignore[arg-type]
        usuario_id=usuario_id,
        metodo_pago=data.metodo_pago,
        cliente_id=data.cliente_id,
        total_venta=total_venta,
        total_neto=total_neto,
        total_iva=total_iva,
        monto_recargo=monto_recargo,
        porcentaje_recargo=pct_guardar,
        monto_descuento_promo=monto_descuento_promo,
        costo_total=0,
        ganancia=0,
    )
    session.add(venta)
    session.flush()

    # 2) Guardar ítems vendidos
    item_ids: list[tuple[VentaItem, Producto, Decimal, int]] = []
    for producto, qty, precio, subtotal in lineas:
        item = VentaItem(
            venta_id=venta.id,  # type: ignore[arg-type]
            producto_id=producto.id,  # type: ignore[arg-type]
            cantidad=qty,
            precio_unitario=precio,
            subtotal=subtotal,
        )
        session.add(item)
        session.flush()
        item_ids.append((item, producto, qty, precio))

    # 3) FIFO por cada componente (una sola pasada agregada) + mapear a ítems
    # Primero consumimos stock agregado por componente
    consumos_por_producto: dict[int, list] = {}
    costo_total = 0
    for producto_id, cantidad in necesidades.items():
        salida = registrar_salida_fifo(
            session,
            negocio_id=negocio_id,
            producto_id=producto_id,
            cantidad=cantidad.quantize(Decimal("0.01")),
            tipo=TipoMovimiento.SALIDA_VENTA,
            motivo=f"Venta #{venta.numero}",
            commit=False,
        )
        consumos_por_producto[producto_id] = list(salida.consumos)
        costo_total += salida.costo_total

    # 4) Detalle por ítem: reparte consumos FIFO del componente entre ítems que lo usan
    # Estrategia: recorrer ítems en orden y tomar del pool de consumos del componente
    pools: dict[int, list[list]] = {
        pid: [[c.lote_id, c.cantidad, c.costo_unitario_real] for c in cons]
        for pid, cons in consumos_por_producto.items()
    }

    def take_from_pool(producto_id: int, qty: Decimal) -> list[tuple[int, Decimal, int]]:
        restante = qty
        taken: list[tuple[int, Decimal, int]] = []
        pool = pools.get(producto_id, [])
        while restante > 0 and pool:
            lote_id, disponible, costo_u = pool[0]
            usar = min(disponible, restante)
            taken.append((lote_id, usar, costo_u))
            nuevo = (disponible - usar).quantize(Decimal("0.01"))
            if nuevo <= 0:
                pool.pop(0)
            else:
                pool[0][1] = nuevo
            restante = (restante - usar).quantize(Decimal("0.01"))
        if restante > 0:
            raise HTTPException(
                status_code=409,
                detail=f"No se pudo asignar detalle FIFO para producto {producto_id}",
            )
        return taken

    for item, producto, qty, precio in item_ids:
        if producto.tipo == TipoProducto.SIMPLE:
            for lote_id, cant, costo_u in take_from_pool(producto.id, qty):  # type: ignore[arg-type]
                session.add(
                    DetalleVenta(
                        venta_id=venta.id,  # type: ignore[arg-type]
                        venta_item_id=item.id,  # type: ignore[arg-type]
                        producto_vendido_id=producto.id,  # type: ignore[arg-type]
                        producto_id=producto.id,  # type: ignore[arg-type]
                        lote_id=lote_id,
                        cantidad=cant,
                        precio_unitario_venta=precio,
                        costo_unitario=costo_u,
                    )
                )
        else:
            expansion = expandir_kit(session, kit=producto, cantidad_kits=qty)
            for comp in expansion.componentes:
                for lote_id, cant, costo_u in take_from_pool(
                    comp.producto_id, comp.cantidad
                ):
                    session.add(
                        DetalleVenta(
                            venta_id=venta.id,  # type: ignore[arg-type]
                            venta_item_id=item.id,  # type: ignore[arg-type]
                            producto_vendido_id=producto.id,  # type: ignore[arg-type]
                            producto_id=comp.producto_id,
                            lote_id=lote_id,
                            cantidad=cant,
                            precio_unitario_venta=precio,
                            costo_unitario=costo_u,
                        )
                    )

    venta.costo_total = costo_total
    venta.ganancia = total_venta - costo_total
    session.add(venta)

    # 5) Finanzas: toda venta exige caja abierta y genera transacción
    from app.services.caja import registrar_ingreso_venta

    registrar_ingreso_venta(
        session,
        negocio_id=negocio_id,
        venta=venta,
        commit=False,
    )

    # 6) Crédito: cargo a cuenta por cobrar
    if data.metodo_pago == MetodoPago.CREDITO and cliente is not None:
        crear_cargo_fiado(
            session,
            negocio_id=negocio_id,
            cliente=cliente,
            venta=venta,
            commit=False,
        )

    if commit:
        session.commit()
        session.refresh(venta)
    else:
        session.flush()

    return venta_to_out(session, venta)


def listar_ventas(
    session: Session,
    *,
    negocio_id: int,
    limit: int = 50,
    desde: datetime | None = None,
    hasta: datetime | None = None,
) -> list[VentaOut]:
    stmt = select(Venta).where(Venta.negocio_id == negocio_id)
    if desde is not None:
        stmt = stmt.where(Venta.fecha_hora >= desde)
    if hasta is not None:
        stmt = stmt.where(Venta.fecha_hora < hasta)
    rows = session.exec(
        stmt.order_by(col(Venta.fecha_hora).desc()).limit(limit)
    ).all()
    return [venta_to_out(session, v, include_details=False) for v in rows]


def obtener_venta(
    session: Session, *, negocio_id: int, venta_id: int
) -> VentaOut:
    venta = session.get(Venta, venta_id)
    if venta is None or venta.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return venta_to_out(session, venta)


def anular_venta(
    session: Session,
    *,
    negocio_id: int,
    venta_id: int,
    commit: bool = True,
) -> VentaOut:
    """Anula una venta: restaura stock a los lotes originales y quita el ingreso de caja."""
    from app.models import TransaccionFinanciera
    from app.services.stock import devolver_a_lote

    venta = session.get(Venta, venta_id)
    if venta is None or venta.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.anulada:
        raise HTTPException(status_code=409, detail="La venta ya está anulada")

    detalles = session.exec(
        select(DetalleVenta).where(DetalleVenta.venta_id == venta_id)
    ).all()
    motivo = f"Anulación venta #{venta.numero}"
    for d in detalles:
        devolver_a_lote(
            session,
            negocio_id=negocio_id,
            producto_id=d.producto_id,
            lote_id=d.lote_id,
            cantidad=d.cantidad,
            costo_unitario=d.costo_unitario,
            motivo=motivo,
            commit=False,
        )

    txs = session.exec(
        select(TransaccionFinanciera).where(
            TransaccionFinanciera.venta_id == venta_id
        )
    ).all()
    for tx in txs:
        session.delete(tx)

    from app.models.enums import MetodoPago
    from app.services.credito import revertir_cargo_venta

    if venta.metodo_pago == MetodoPago.CREDITO:
        revertir_cargo_venta(session, negocio_id=negocio_id, venta_id=venta_id)

    venta.anulada = True
    session.add(venta)

    if commit:
        session.commit()
        session.refresh(venta)
    else:
        session.flush()

    return venta_to_out(session, venta, include_details=False)
