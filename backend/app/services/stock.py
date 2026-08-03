from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_FLOOR, Decimal

from fastapi import HTTPException
from sqlmodel import Session, col, func, select

from app.models import HistorialMovimiento, LoteStock, Producto
from app.models.enums import TipoMovimiento, TipoProducto
from app.schemas.stock import (
    ConsumoLoteOut,
    EntradaCompraOut,
    LoteOut,
    MovimientoOut,
    SalidaStockOut,
    StockProductoOut,
)


def costo_unitario_real(lote: LoteStock) -> int:
    return int(lote.precio_costo_neto) + int(lote.costo_operacion_prorrateado)


def salidas_por_lote(
    session: Session,
    *,
    negocio_id: int,
    lote_ids: list[int],
) -> dict[int, tuple[Decimal, Decimal]]:
    """lote_id -> (cantidad_vendida, cantidad_merma)."""
    if not lote_ids:
        return {}
    rows = session.exec(
        select(
            HistorialMovimiento.lote_id,
            HistorialMovimiento.tipo_movimiento,
            func.coalesce(func.sum(HistorialMovimiento.cantidad), 0),
        )
        .where(
            HistorialMovimiento.negocio_id == negocio_id,
            col(HistorialMovimiento.lote_id).in_(lote_ids),
            col(HistorialMovimiento.tipo_movimiento).in_(
                [TipoMovimiento.SALIDA_VENTA, TipoMovimiento.SALIDA_MERMA]
            ),
        )
        .group_by(
            HistorialMovimiento.lote_id,
            HistorialMovimiento.tipo_movimiento,
        )
    ).all()
    out: dict[int, tuple[Decimal, Decimal]] = {
        lid: (Decimal("0"), Decimal("0")) for lid in lote_ids
    }
    for lote_id, tipo, total in rows:
        vendida, merma = out.get(lote_id, (Decimal("0"), Decimal("0")))
        qty = Decimal(total)
        if tipo == TipoMovimiento.SALIDA_VENTA:
            out[lote_id] = (vendida + qty, merma)
        elif tipo == TipoMovimiento.SALIDA_MERMA:
            out[lote_id] = (vendida, merma + qty)
    return out


def lote_to_out(
    lote: LoteStock,
    *,
    cantidad_vendida: Decimal | None = None,
    cantidad_merma: Decimal | None = None,
) -> LoteOut:
    return LoteOut(
        id=lote.id,  # type: ignore[arg-type]
        negocio_id=lote.negocio_id,
        producto_id=lote.producto_id,
        cantidad_inicial=lote.cantidad_inicial,
        cantidad_actual=lote.cantidad_actual,
        cantidad_vendida=cantidad_vendida or Decimal("0"),
        cantidad_merma=cantidad_merma or Decimal("0"),
        precio_costo_neto=lote.precio_costo_neto,
        iva_porcentaje=lote.iva_porcentaje,
        costo_operacion_prorrateado=lote.costo_operacion_prorrateado,
        costo_unitario_real=costo_unitario_real(lote),
        fecha_ingreso=lote.fecha_ingreso,
        fecha_caducidad=lote.fecha_caducidad,
        activo=lote.activo,
    )


def movimiento_to_out(mov: HistorialMovimiento) -> MovimientoOut:
    return MovimientoOut(
        id=mov.id,  # type: ignore[arg-type]
        producto_id=mov.producto_id,
        lote_id=mov.lote_id,
        tipo_movimiento=mov.tipo_movimiento.value,
        cantidad=mov.cantidad,
        costo_unitario_aplicado=mov.costo_unitario_aplicado,
        motivo=mov.motivo,
        fecha_hora=mov.fecha_hora,
    )


def get_producto_stockeable(
    session: Session, producto_id: int, negocio_id: int
) -> Producto:
    producto = session.get(Producto, producto_id)
    if producto is None or producto.negocio_id != negocio_id or not producto.activo:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if producto.tipo != TipoProducto.SIMPLE:
        raise HTTPException(
            status_code=400,
            detail="Solo productos SIMPLE tienen stock; los KIT consumen componentes",
        )
    return producto


def registrar_entrada_compra(
    session: Session,
    *,
    negocio_id: int,
    producto_id: int,
    cantidad: Decimal,
    precio_costo_neto: int,
    iva_porcentaje: Decimal,
    costo_operacion_total: int = 0,
    fecha_caducidad: date | None = None,
    fecha_ingreso: datetime | None = None,
    motivo: str | None = "Entrada por compra",
    omitir_validacion_caducidad: bool = False,
    commit: bool = True,
) -> EntradaCompraOut:
    producto = get_producto_stockeable(session, producto_id, negocio_id)
    if cantidad <= 0:
        raise HTTPException(status_code=400, detail="cantidad debe ser > 0")

    if (
        producto.controla_caducidad
        and fecha_caducidad is None
        and not omitir_validacion_caducidad
    ):
        raise HTTPException(
            status_code=400,
            detail="Este producto controla caducidad: fecha_caducidad es obligatoria",
        )
    if not producto.controla_caducidad:
        fecha_caducidad = None

    prorrateado = 0
    if costo_operacion_total > 0:
        prorrateado = int(
            (Decimal(costo_operacion_total) / cantidad).quantize(Decimal("1"))
        )

    lote = LoteStock(
        negocio_id=negocio_id,
        producto_id=producto_id,
        cantidad_inicial=cantidad,
        cantidad_actual=cantidad,
        precio_costo_neto=precio_costo_neto,
        iva_porcentaje=iva_porcentaje,
        costo_operacion_prorrateado=prorrateado,
        fecha_caducidad=fecha_caducidad,
        **({"fecha_ingreso": fecha_ingreso} if fecha_ingreso is not None else {}),
    )
    session.add(lote)
    session.flush()

    mov = HistorialMovimiento(
        negocio_id=negocio_id,
        producto_id=producto_id,
        lote_id=lote.id,  # type: ignore[arg-type]
        tipo_movimiento=TipoMovimiento.ENTRADA_COMPRA,
        cantidad=cantidad,
        costo_unitario_aplicado=costo_unitario_real(lote),
        motivo=motivo,
    )
    session.add(mov)
    if commit:
        session.commit()
        session.refresh(lote)
        session.refresh(mov)
    else:
        session.flush()

    return EntradaCompraOut(lote=lote_to_out(lote), movimiento=movimiento_to_out(mov))


@dataclass
class _Consumo:
    lote: LoteStock
    cantidad: Decimal


def _consumir_fifo(
    session: Session,
    *,
    negocio_id: int,
    producto_id: int,
    cantidad: Decimal,
    tipo: TipoMovimiento,
    motivo: str | None,
) -> list[tuple[_Consumo, HistorialMovimiento]]:
    if cantidad <= 0:
        raise HTTPException(status_code=400, detail="cantidad debe ser > 0")

    get_producto_stockeable(session, producto_id, negocio_id)

    lotes = session.exec(
        select(LoteStock)
        .where(
            LoteStock.negocio_id == negocio_id,
            LoteStock.producto_id == producto_id,
            LoteStock.activo == True,  # noqa: E712
            LoteStock.cantidad_actual > 0,
        )
        .order_by(col(LoteStock.fecha_ingreso).asc(), col(LoteStock.id).asc())
        .with_for_update()
    ).all()

    restante = cantidad
    resultados: list[tuple[_Consumo, HistorialMovimiento]] = []

    for lote in lotes:
        if restante <= 0:
            break
        tomar = min(lote.cantidad_actual, restante)
        lote.cantidad_actual = (lote.cantidad_actual - tomar).quantize(Decimal("0.01"))
        session.add(lote)

        mov = HistorialMovimiento(
            negocio_id=negocio_id,
            producto_id=producto_id,
            lote_id=lote.id,  # type: ignore[arg-type]
            tipo_movimiento=tipo,
            cantidad=tomar,
            costo_unitario_aplicado=costo_unitario_real(lote),
            motivo=motivo,
        )
        session.add(mov)
        resultados.append((_Consumo(lote=lote, cantidad=tomar), mov))
        restante = (restante - tomar).quantize(Decimal("0.01"))

    if restante > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Stock insuficiente: faltan {restante} unidades",
        )

    return resultados


def registrar_salida_fifo(
    session: Session,
    *,
    negocio_id: int,
    producto_id: int,
    cantidad: Decimal,
    tipo: TipoMovimiento = TipoMovimiento.SALIDA_VENTA,
    motivo: str | None = None,
    commit: bool = True,
) -> SalidaStockOut:
    if tipo not in (
        TipoMovimiento.SALIDA_VENTA,
        TipoMovimiento.SALIDA_MERMA,
        TipoMovimiento.AJUSTE_INVENTARIO,
    ):
        raise HTTPException(status_code=400, detail="Tipo de salida inválido")

    pares = _consumir_fifo(
        session,
        negocio_id=negocio_id,
        producto_id=producto_id,
        cantidad=cantidad,
        tipo=tipo,
        motivo=motivo,
    )
    if commit:
        session.commit()
        for _, mov in pares:
            session.refresh(mov)
            session.refresh(session.get(LoteStock, mov.lote_id))
    else:
        session.flush()

    consumos: list[ConsumoLoteOut] = []
    movimientos: list[MovimientoOut] = []
    costo_total = 0
    for consumo, mov in pares:
        unit = costo_unitario_real(consumo.lote)
        costo_total += int(unit * consumo.cantidad)
        consumos.append(
            ConsumoLoteOut(
                lote_id=consumo.lote.id,  # type: ignore[arg-type]
                cantidad=consumo.cantidad,
                precio_costo_neto=consumo.lote.precio_costo_neto,
                costo_operacion_prorrateado=consumo.lote.costo_operacion_prorrateado,
                costo_unitario_real=unit,
            )
        )
        movimientos.append(movimiento_to_out(mov))

    return SalidaStockOut(
        producto_id=producto_id,
        cantidad_solicitada=cantidad,
        consumos=consumos,
        costo_total=costo_total,
        movimientos=movimientos,
    )


def registrar_ajuste(
    session: Session,
    *,
    negocio_id: int,
    producto_id: int,
    cantidad: Decimal,
    motivo: str,
    precio_costo_neto: int = 0,
    commit: bool = True,
) -> EntradaCompraOut | SalidaStockOut:
    if cantidad > 0:
        return registrar_entrada_compra(
            session,
            negocio_id=negocio_id,
            producto_id=producto_id,
            cantidad=cantidad,
            precio_costo_neto=precio_costo_neto,
            iva_porcentaje=Decimal("19.00"),
            costo_operacion_total=0,
            fecha_caducidad=None,
            motivo=f"Ajuste (+): {motivo}",
            omitir_validacion_caducidad=True,
            commit=commit,
        )
    # Negativo: salida FIFO tipada como ajuste
    return registrar_salida_fifo(
        session,
        negocio_id=negocio_id,
        producto_id=producto_id,
        cantidad=abs(cantidad),
        tipo=TipoMovimiento.AJUSTE_INVENTARIO,
        motivo=f"Ajuste (-): {motivo}",
        commit=commit,
    )


def devolver_a_lote(
    session: Session,
    *,
    negocio_id: int,
    producto_id: int,
    lote_id: int,
    cantidad: Decimal,
    costo_unitario: int,
    motivo: str,
    commit: bool = False,
) -> HistorialMovimiento:
    """Devuelve unidades a un lote existente (p.ej. anulación de venta)."""
    if cantidad <= 0:
        raise HTTPException(status_code=400, detail="cantidad debe ser > 0")
    lote = session.get(LoteStock, lote_id)
    if (
        lote is None
        or lote.negocio_id != negocio_id
        or lote.producto_id != producto_id
    ):
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    lote.cantidad_actual = (lote.cantidad_actual + cantidad).quantize(Decimal("0.01"))
    lote.activo = True
    session.add(lote)
    mov = HistorialMovimiento(
        negocio_id=negocio_id,
        producto_id=producto_id,
        lote_id=lote_id,
        tipo_movimiento=TipoMovimiento.AJUSTE_INVENTARIO,
        cantidad=cantidad,
        costo_unitario_aplicado=costo_unitario,
        motivo=motivo,
    )
    session.add(mov)
    if commit:
        session.commit()
        session.refresh(mov)
    else:
        session.flush()
    return mov


def stock_actual_producto(
    session: Session, *, negocio_id: int, producto_id: int
) -> Decimal:
    total = session.exec(
        select(func.coalesce(func.sum(LoteStock.cantidad_actual), 0)).where(
            LoteStock.negocio_id == negocio_id,
            LoteStock.producto_id == producto_id,
            LoteStock.activo == True,  # noqa: E712
        )
    ).one()
    return Decimal(total).quantize(Decimal("0.01"))


def stock_disponible_kit(
    session: Session, *, negocio_id: int, kit_id: int
) -> Decimal:
    """Cuántos kits se pueden armar con el stock actual de componentes."""
    from app.services.receta import listar_receta
    from app.models import Producto

    kit = session.get(Producto, kit_id)
    if kit is None or kit.negocio_id != negocio_id:
        return Decimal("0")
    receta = listar_receta(session, kit)
    if not receta.componentes:
        return Decimal("0")
    capacidades: list[Decimal] = []
    for comp in receta.componentes:
        if comp.cantidad <= 0:
            continue
        stock = stock_actual_producto(
            session, negocio_id=negocio_id, producto_id=comp.producto_componente_id
        )
        capacidades.append(
            (stock / comp.cantidad).to_integral_value(rounding=ROUND_FLOOR)
        )
    if not capacidades:
        return Decimal("0")
    return min(capacidades)


def resumen_stock_negocio(
    session: Session, *, negocio_id: int
) -> list[StockProductoOut]:
    productos = session.exec(
        select(Producto).where(
            Producto.negocio_id == negocio_id,
            Producto.activo == True,  # noqa: E712
        ).order_by(Producto.nombre)
    ).all()

    from app.services.config_negocio import get_or_create_config

    cfg = get_or_create_config(session, negocio_id=negocio_id)

    out: list[StockProductoOut] = []
    for p in productos:
        if p.tipo == TipoProducto.KIT:
            stock = stock_disponible_kit(
                session, negocio_id=negocio_id, kit_id=p.id  # type: ignore[arg-type]
            )
            out.append(
                StockProductoOut(
                    producto_id=p.id,  # type: ignore[arg-type]
                    producto_nombre=p.nombre,
                    codigo_barras=p.codigo_barras,
                    stock_actual=stock,
                    stock_ideal=None,
                    stock_minimo=None,
                    porcentaje_emergencia=cfg.alerta_stock_porcentaje,
                    porcentaje_sobrestock=p.porcentaje_sobrestock,
                    alerta_bajo_stock=stock <= 0,
                    alerta_sobrestock=False,
                    lotes_abiertos=0,
                )
            )
            continue

        stock = stock_actual_producto(
            session, negocio_id=negocio_id, producto_id=p.id  # type: ignore[arg-type]
        )
        lotes_abiertos = session.exec(
            select(func.count()).select_from(LoteStock).where(
                LoteStock.negocio_id == negocio_id,
                LoteStock.producto_id == p.id,
                LoteStock.activo == True,  # noqa: E712
                LoteStock.cantidad_actual > 0,
            )
        ).one()

        alerta_bajo = False
        alerta_sobre = False

        umbral_cantidad = (
            p.stock_minimo
            if p.stock_minimo is not None
            else cfg.alerta_stock_cantidad
        )
        pct = cfg.alerta_stock_porcentaje
        if p.stock_ideal and p.stock_ideal > 0:
            pct = p.porcentaje_emergencia or cfg.alerta_stock_porcentaje
            umbral_pct = p.stock_ideal * Decimal(pct) / Decimal(100)
            umbral_sobre = (
                p.stock_ideal * Decimal(p.porcentaje_sobrestock) / Decimal(100)
            )
            alerta_bajo = stock <= umbral_cantidad or stock <= umbral_pct
            alerta_sobre = stock >= umbral_sobre
        else:
            alerta_bajo = stock <= umbral_cantidad

        out.append(
            StockProductoOut(
                producto_id=p.id,  # type: ignore[arg-type]
                producto_nombre=p.nombre,
                codigo_barras=p.codigo_barras,
                stock_actual=stock,
                stock_ideal=p.stock_ideal,
                stock_minimo=umbral_cantidad,
                porcentaje_emergencia=pct,
                porcentaje_sobrestock=p.porcentaje_sobrestock,
                alerta_bajo_stock=alerta_bajo,
                alerta_sobrestock=alerta_sobre,
                lotes_abiertos=int(lotes_abiertos),
            )
        )
    return out
