from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlmodel import Session, col, func, select

from app.models import LoteStock, Producto, Venta, VentaItem
from app.schemas.kpi import (
    KpisOut,
    ProductoPorVencerOut,
    ProductoRankingOut,
    ProductoStockAlertaOut,
)
from app.services.stock import resumen_stock_negocio


def _day_bounds(dia: date) -> tuple[datetime, datetime]:
    start = datetime.combine(dia, datetime.min.time())
    end = start + timedelta(days=1)
    return start, end


def _month_bounds(dia: date) -> tuple[datetime, datetime]:
    start = datetime(dia.year, dia.month, 1)
    if dia.month == 12:
        end = datetime(dia.year + 1, 1, 1)
    else:
        end = datetime(dia.year, dia.month + 1, 1)
    return start, end


def _year_bounds(dia: date) -> tuple[datetime, datetime]:
    start = datetime(dia.year, 1, 1)
    end = datetime(dia.year + 1, 1, 1)
    return start, end


def _sum_ventas(
    session: Session, *, negocio_id: int, start: datetime, end: datetime
) -> tuple[int, int, int]:
    """Retorna (total_venta, ganancia, num_ventas)."""
    row = session.exec(
        select(
            func.coalesce(func.sum(Venta.total_venta), 0),
            func.coalesce(func.sum(Venta.ganancia), 0),
            func.count(Venta.id),
        ).where(
            Venta.negocio_id == negocio_id,
            Venta.anulada == False,  # noqa: E712
            Venta.fecha_hora >= start,
            Venta.fecha_hora < end,
        )
    ).one()
    return int(row[0]), int(row[1]), int(row[2])


def _sum_gastos(
    session: Session, *, negocio_id: int, start: datetime, end: datetime
) -> int:
    from app.models import TransaccionFinanciera
    from app.models.enums import TipoTransaccion

    row = session.exec(
        select(func.coalesce(func.sum(TransaccionFinanciera.monto), 0)).where(
            TransaccionFinanciera.negocio_id == negocio_id,
            col(TransaccionFinanciera.tipo_transaccion).in_(
                [
                    TipoTransaccion.GASTO_OPERATIVO,
                    TipoTransaccion.GASTO_GENERAL,
                ]
            ),
            TransaccionFinanciera.fecha_hora >= start,
            TransaccionFinanciera.fecha_hora < end,
        )
    ).one()
    return int(row)


def _sum_merma(
    session: Session, *, negocio_id: int, start: datetime, end: datetime
) -> int:
    from app.models import HistorialMovimiento
    from app.models.enums import TipoMovimiento

    rows = session.exec(
        select(
            HistorialMovimiento.cantidad,
            HistorialMovimiento.costo_unitario_aplicado,
        ).where(
            HistorialMovimiento.negocio_id == negocio_id,
            HistorialMovimiento.tipo_movimiento == TipoMovimiento.SALIDA_MERMA,
            HistorialMovimiento.fecha_hora >= start,
            HistorialMovimiento.fecha_hora < end,
        )
    ).all()
    total = 0
    for cantidad, costo in rows:
        total += int(abs(Decimal(cantidad)) * int(costo or 0))
    return total


def _ranking_productos(
    session: Session,
    *,
    negocio_id: int,
    start: datetime,
    end: datetime,
    limit: int = 5,
    ascending: bool = False,
) -> list[ProductoRankingOut]:
    """Ranking por SKU escaneado (venta_items), mes de referencia."""
    qty_expr = func.coalesce(func.sum(VentaItem.cantidad), 0)
    tot_expr = func.coalesce(func.sum(VentaItem.subtotal), 0)
    lineas_expr = func.count(VentaItem.id)

    stmt = (
        select(
            VentaItem.producto_id,
            Producto.nombre,
            Producto.codigo_barras,
            qty_expr,
            tot_expr,
            lineas_expr,
        )
        .join(Venta, Venta.id == VentaItem.venta_id)
        .join(Producto, Producto.id == VentaItem.producto_id)
        .where(
            Venta.negocio_id == negocio_id,
            Venta.anulada == False,  # noqa: E712
            Venta.fecha_hora >= start,
            Venta.fecha_hora < end,
        )
        .group_by(VentaItem.producto_id, Producto.nombre, Producto.codigo_barras)
    )
    if ascending:
        stmt = stmt.order_by(qty_expr.asc(), tot_expr.asc())
    else:
        stmt = stmt.order_by(qty_expr.desc(), tot_expr.desc())
    stmt = stmt.limit(limit)

    rows = session.exec(stmt).all()
    return [
        ProductoRankingOut(
            producto_id=r[0],
            nombre=r[1],
            codigo_barras=r[2],
            cantidad_vendida=Decimal(r[3]).quantize(Decimal("0.01")),
            total_venta=int(r[4]),
            num_lineas=int(r[5]),
        )
        for r in rows
    ]


def _productos_por_vencer(
    session: Session,
    *,
    negocio_id: int,
    dentro_de_dias: int = 30,
) -> list[ProductoPorVencerOut]:
    hoy = date.today()
    limite = hoy + timedelta(days=dentro_de_dias)
    rows = session.exec(
        select(LoteStock, Producto)
        .join(Producto, Producto.id == LoteStock.producto_id)
        .where(
            LoteStock.negocio_id == negocio_id,
            LoteStock.activo == True,  # noqa: E712
            LoteStock.cantidad_actual > 0,
            LoteStock.fecha_caducidad.is_not(None),  # type: ignore[union-attr]
            LoteStock.fecha_caducidad <= limite,
            Producto.controla_caducidad == True,  # noqa: E712
        )
        .order_by(LoteStock.fecha_caducidad.asc())
    ).all()

    out: list[ProductoPorVencerOut] = []
    for lote, prod in rows:
        assert lote.fecha_caducidad is not None
        out.append(
            ProductoPorVencerOut(
                producto_id=prod.id,  # type: ignore[arg-type]
                nombre=prod.nombre,
                lote_id=lote.id,  # type: ignore[arg-type]
                cantidad_actual=lote.cantidad_actual,
                fecha_caducidad=lote.fecha_caducidad,
                dias_restantes=(lote.fecha_caducidad - hoy).days,
            )
        )
    return out


def obtener_kpis(
    session: Session,
    *,
    negocio_id: int,
    fecha: date | None = None,
    top_n: int = 5,
    dias_caducidad: int | None = None,
) -> KpisOut:
    from app.services.config_negocio import get_or_create_config

    cfg = get_or_create_config(session, negocio_id=negocio_id)
    dias = dias_caducidad if dias_caducidad is not None else cfg.dias_caducidad_alerta

    ref = fecha or date.today()
    d0, d1 = _day_bounds(ref)
    m0, m1 = _month_bounds(ref)
    y0, y1 = _year_bounds(ref)

    venta_diaria, ganancia_diaria, num_dia = _sum_ventas(
        session, negocio_id=negocio_id, start=d0, end=d1
    )
    venta_mensual, ganancia_mensual, num_mes = _sum_ventas(
        session, negocio_id=negocio_id, start=m0, end=m1
    )
    venta_anual, ganancia_anual, num_anio = _sum_ventas(
        session, negocio_id=negocio_id, start=y0, end=y1
    )
    gastos_anuales = _sum_gastos(
        session, negocio_id=negocio_id, start=y0, end=y1
    )
    merma_anual = _sum_merma(
        session, negocio_id=negocio_id, start=y0, end=y1
    )

    estrellas = _ranking_productos(
        session,
        negocio_id=negocio_id,
        start=m0,
        end=m1,
        limit=top_n,
        ascending=False,
    )
    # Impopulares: productos activos con menos ventas en el mes (incluye 0 ventas).
    impopulares = _ranking_impopulares(
        session,
        negocio_id=negocio_id,
        start=m0,
        end=m1,
        limit=top_n,
    )

    stock = resumen_stock_negocio(session, negocio_id=negocio_id)
    bajo = [
        ProductoStockAlertaOut(
            producto_id=s.producto_id,
            nombre=s.producto_nombre,
            stock_actual=s.stock_actual,
            stock_ideal=s.stock_ideal,
            stock_minimo=s.stock_minimo,
            tipo_alerta="bajo",
        )
        for s in stock
        if s.alerta_bajo_stock
    ]
    sobre = [
        ProductoStockAlertaOut(
            producto_id=s.producto_id,
            nombre=s.producto_nombre,
            stock_actual=s.stock_actual,
            stock_ideal=s.stock_ideal,
            stock_minimo=s.stock_minimo,
            tipo_alerta="sobre",
        )
        for s in stock
        if s.alerta_sobrestock
    ]

    return KpisOut(
        fecha_referencia=ref,
        venta_diaria=venta_diaria,
        venta_mensual=venta_mensual,
        venta_anual=venta_anual,
        ganancia_diaria=ganancia_diaria,
        ganancia_mensual=ganancia_mensual,
        ganancia_anual=ganancia_anual,
        num_ventas_dia=num_dia,
        num_ventas_mes=num_mes,
        num_ventas_anio=num_anio,
        gastos_anuales=gastos_anuales,
        merma_anual=merma_anual,
        productos_por_vencer=_productos_por_vencer(
            session, negocio_id=negocio_id, dentro_de_dias=dias
        ),
        productos_estrella=estrellas,
        productos_impopulares=impopulares,
        productos_bajo_stock=bajo,
        productos_sobre_stock=sobre,
    )


def _ranking_impopulares(
    session: Session,
    *,
    negocio_id: int,
    start: datetime,
    end: datetime,
    limit: int,
) -> list[ProductoRankingOut]:
    """Productos activos con menos ventas en el mes (incluye 0 ventas)."""
    vendidos = {
        r.producto_id: r
        for r in _ranking_productos(
            session,
            negocio_id=negocio_id,
            start=start,
            end=end,
            limit=10_000,
            ascending=True,
        )
    }

    productos = session.exec(
        select(Producto)
        .where(
            Producto.negocio_id == negocio_id,
            Producto.activo == True,  # noqa: E712
        )
        .order_by(Producto.nombre)
    ).all()

    ranking: list[ProductoRankingOut] = []
    for p in productos:
        if p.id in vendidos:
            ranking.append(vendidos[p.id])  # type: ignore[index]
        else:
            ranking.append(
                ProductoRankingOut(
                    producto_id=p.id,  # type: ignore[arg-type]
                    nombre=p.nombre,
                    codigo_barras=p.codigo_barras,
                    cantidad_vendida=Decimal("0.00"),
                    total_venta=0,
                    num_lineas=0,
                )
            )

    ranking.sort(key=lambda x: (x.cantidad_vendida, x.total_venta, x.nombre))
    return ranking[:limit]
