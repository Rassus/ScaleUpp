from datetime import date, datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlmodel import Session, col, select

from app.models import CompraMercaderia, CompraMercaderiaItem, MovimientoNegocio, Producto
from app.models.enums import TipoMovimientoNegocio, utcnow
from app.schemas.compra import (
    CompraCreateIn,
    CompraItemOut,
    CompraListItemOut,
    CompraOut,
    InversionMesOut,
    InversionResumenOut,
    MovimientoNegocioOut,
)
from app.services import stock as stock_service
from app.services.folios import siguiente_numero


def _monto_linea(cantidad: Decimal, precio_costo_neto: int) -> int:
    return int((cantidad * Decimal(precio_costo_neto)).quantize(Decimal("1")))


def _producto_nombre(session: Session, producto_id: int) -> str:
    p = session.get(Producto, producto_id)
    return p.nombre if p else f"Producto #{producto_id}"


def compra_to_out(session: Session, compra: CompraMercaderia) -> CompraOut:
    items = session.exec(
        select(CompraMercaderiaItem).where(
            CompraMercaderiaItem.compra_id == compra.id
        )
    ).all()
    return CompraOut(
        id=compra.id,  # type: ignore[arg-type]
        numero=compra.numero,
        negocio_id=compra.negocio_id,
        usuario_id=compra.usuario_id,
        fecha=compra.fecha,
        nota=compra.nota,
        costo_operacion_total=compra.costo_operacion_total,
        monto_total=compra.monto_total,
        creado_en=compra.creado_en,
        items=[
            CompraItemOut(
                id=it.id,  # type: ignore[arg-type]
                producto_id=it.producto_id,
                producto_nombre=_producto_nombre(session, it.producto_id),
                cantidad=it.cantidad,
                precio_costo_neto=it.precio_costo_neto,
                iva_porcentaje=it.iva_porcentaje,
                fecha_caducidad=it.fecha_caducidad,
                monto_linea=it.monto_linea,
                lote_stock_id=it.lote_stock_id,
            )
            for it in items
        ],
    )


def registrar_compra(
    session: Session,
    *,
    negocio_id: int,
    usuario_id: int | None,
    body: CompraCreateIn,
) -> CompraOut:
    if not body.items:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un ítem")

    lineas: list[tuple] = []
    suma_lineas = 0
    for item in body.items:
        stock_service.get_producto_stockeable(
            session, item.producto_id, negocio_id
        )
        monto = _monto_linea(item.cantidad, item.precio_costo_neto)
        suma_lineas += monto
        lineas.append((item, monto))

    if suma_lineas <= 0 and body.costo_operacion_total <= 0:
        raise HTTPException(
            status_code=400,
            detail="El monto de la compra debe ser mayor a 0",
        )

    # Prorrateo de costo operación por peso de cada línea
    op_restante = body.costo_operacion_total
    op_por_linea: list[int] = []
    for i, (item, monto) in enumerate(lineas):
        if i == len(lineas) - 1:
            op_por_linea.append(max(0, op_restante))
        elif suma_lineas > 0 and body.costo_operacion_total > 0:
            share = int(
                (
                    Decimal(body.costo_operacion_total)
                    * Decimal(monto)
                    / Decimal(suma_lineas)
                ).quantize(Decimal("1"))
            )
            op_por_linea.append(share)
            op_restante -= share
        else:
            op_por_linea.append(0)

    fecha = body.fecha or date.today()
    monto_total = suma_lineas + body.costo_operacion_total
    # Medianoche local aproximada vía mediodía para FIFO por fecha de compra
    fecha_ingreso_lote = datetime(fecha.year, fecha.month, fecha.day, 12, 0, 0)

    compra = CompraMercaderia(
        negocio_id=negocio_id,
        numero=siguiente_numero(
            session, model=CompraMercaderia, negocio_id=negocio_id
        ),
        usuario_id=usuario_id,
        fecha=fecha,
        nota=body.nota,
        costo_operacion_total=body.costo_operacion_total,
        monto_total=monto_total,
    )
    session.add(compra)
    session.flush()

    for (item, monto), op in zip(lineas, op_por_linea):
        entrada = stock_service.registrar_entrada_compra(
            session,
            negocio_id=negocio_id,
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_costo_neto=item.precio_costo_neto,
            iva_porcentaje=item.iva_porcentaje,
            costo_operacion_total=op,
            fecha_caducidad=item.fecha_caducidad,
            fecha_ingreso=fecha_ingreso_lote,
            motivo=f"Compra #{compra.numero}"
            + (f" — {body.nota}" if body.nota else ""),
            commit=False,
        )
        row = CompraMercaderiaItem(
            compra_id=compra.id,  # type: ignore[arg-type]
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_costo_neto=item.precio_costo_neto,
            iva_porcentaje=item.iva_porcentaje,
            fecha_caducidad=item.fecha_caducidad,
            monto_linea=monto,
            lote_stock_id=entrada.lote.id,
        )
        session.add(row)

    nota_desc = body.nota.strip() if body.nota else "Compra de mercadería"
    mov = MovimientoNegocio(
        negocio_id=negocio_id,
        usuario_id=usuario_id,
        tipo=TipoMovimientoNegocio.INVERSION_MERCADERIA,
        monto=monto_total,
        descripcion=f"Inversión mercadería — {nota_desc} (compra #{compra.numero})",
        compra_id=compra.id,  # type: ignore[arg-type]
        fecha_hora=utcnow(),
    )
    session.add(mov)
    session.commit()
    session.refresh(compra)
    return compra_to_out(session, compra)


def listar_compras(
    session: Session,
    *,
    negocio_id: int,
    limit: int = 50,
) -> list[CompraListItemOut]:
    rows = session.exec(
        select(CompraMercaderia)
        .where(CompraMercaderia.negocio_id == negocio_id)
        .order_by(col(CompraMercaderia.creado_en).desc())
        .limit(limit)
    ).all()
    out: list[CompraListItemOut] = []
    for c in rows:
        n = session.exec(
            select(CompraMercaderiaItem).where(
                CompraMercaderiaItem.compra_id == c.id
            )
        ).all()
        out.append(
            CompraListItemOut(
                id=c.id,  # type: ignore[arg-type]
                numero=c.numero,
                fecha=c.fecha,
                nota=c.nota,
                costo_operacion_total=c.costo_operacion_total,
                monto_total=c.monto_total,
                num_items=len(n),
                creado_en=c.creado_en,
            )
        )
    return out


def obtener_compra(
    session: Session, *, negocio_id: int, compra_id: int
) -> CompraOut:
    compra = session.get(CompraMercaderia, compra_id)
    if compra is None or compra.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra_to_out(session, compra)


def resumen_inversiones(
    session: Session,
    *,
    negocio_id: int,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    limit: int = 100,
) -> InversionResumenOut:
    q = select(MovimientoNegocio).where(
        MovimientoNegocio.negocio_id == negocio_id,
        MovimientoNegocio.tipo == TipoMovimientoNegocio.INVERSION_MERCADERIA,
    )
    if desde is not None:
        q = q.where(MovimientoNegocio.fecha_hora >= desde)
    if hasta is not None:
        q = q.where(MovimientoNegocio.fecha_hora <= hasta)
    rows = session.exec(
        q.order_by(col(MovimientoNegocio.fecha_hora).desc()).limit(limit)
    ).all()

    por_mes_map: dict[str, int] = {}
    total = 0
    movimientos: list[MovimientoNegocioOut] = []
    for m in rows:
        total += m.monto
        key = m.fecha_hora.strftime("%Y-%m")
        por_mes_map[key] = por_mes_map.get(key, 0) + m.monto
        movimientos.append(
            MovimientoNegocioOut(
                id=m.id,  # type: ignore[arg-type]
                tipo=m.tipo.value,
                monto=m.monto,
                descripcion=m.descripcion,
                compra_id=m.compra_id,
                fecha_hora=m.fecha_hora,
            )
        )

    por_mes = [
        InversionMesOut(mes=k, total=v)
        for k, v in sorted(por_mes_map.items(), key=lambda x: x[1], reverse=True)
    ]
    return InversionResumenOut(
        total_periodo=total,
        por_mes=por_mes,
        movimientos=movimientos,
    )
