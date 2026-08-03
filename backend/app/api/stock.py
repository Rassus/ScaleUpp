from typing import Annotated, Optional

from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, col, select

from app.api.deps import CurrentContext, require_negocio, require_negocio_write
from app.db import get_session
from app.models import HistorialMovimiento, LoteStock
from app.models.enums import TipoMovimiento
from app.schemas.stock import (
    AjusteStockIn,
    EntradaCompraIn,
    EntradaCompraOut,
    LoteOut,
    MovimientoOut,
    SalidaStockIn,
    SalidaStockOut,
    StockProductoOut,
)
from app.services import stock as stock_service

router = APIRouter(prefix="/stock", tags=["stock"])


@router.get("/resumen", response_model=list[StockProductoOut])
def resumen(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> list[StockProductoOut]:
    return stock_service.resumen_stock_negocio(
        session, negocio_id=ctx.negocio.id  # type: ignore[arg-type]
    )


@router.get("/lotes", response_model=list[LoteOut])
def listar_lotes(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    producto_id: Annotated[Optional[int], Query()] = None,
    solo_con_stock: bool = True,
) -> list[LoteOut]:
    q = select(LoteStock).where(LoteStock.negocio_id == ctx.negocio.id)
    if producto_id is not None:
        q = q.where(LoteStock.producto_id == producto_id)
    if solo_con_stock:
        q = q.where(LoteStock.cantidad_actual > 0)
    rows = session.exec(
        q.order_by(col(LoteStock.fecha_ingreso).asc(), col(LoteStock.id).asc())
    ).all()
    salidas = stock_service.salidas_por_lote(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        lote_ids=[r.id for r in rows if r.id is not None],  # type: ignore[misc]
    )
    out: list[LoteOut] = []
    for r in rows:
        vendida, merma = salidas.get(
            r.id,  # type: ignore[arg-type]
            (Decimal("0"), Decimal("0")),
        )
        out.append(
            stock_service.lote_to_out(
                r,
                cantidad_vendida=vendida,
                cantidad_merma=merma,
            )
        )
    return out


@router.get("/movimientos", response_model=list[MovimientoOut])
def listar_movimientos(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    producto_id: Annotated[Optional[int], Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[MovimientoOut]:
    q = select(HistorialMovimiento).where(
        HistorialMovimiento.negocio_id == ctx.negocio.id
    )
    if producto_id is not None:
        q = q.where(HistorialMovimiento.producto_id == producto_id)
    rows = session.exec(
        q.order_by(col(HistorialMovimiento.fecha_hora).desc()).limit(limit)
    ).all()
    return [stock_service.movimiento_to_out(r) for r in rows]


@router.post("/entradas", response_model=EntradaCompraOut, status_code=201)
def entrada_compra(
    body: EntradaCompraIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> EntradaCompraOut:
    return stock_service.registrar_entrada_compra(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        producto_id=body.producto_id,
        cantidad=body.cantidad,
        precio_costo_neto=body.precio_costo_neto,
        iva_porcentaje=body.iva_porcentaje,
        costo_operacion_total=body.costo_operacion_total,
        fecha_caducidad=body.fecha_caducidad,
        motivo=body.motivo,
    )


@router.post("/salidas/merma", response_model=SalidaStockOut, status_code=201)
def salida_merma(
    body: SalidaStockIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> SalidaStockOut:
    return stock_service.registrar_salida_fifo(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        producto_id=body.producto_id,
        cantidad=body.cantidad,
        tipo=TipoMovimiento.SALIDA_MERMA,
        motivo=body.motivo or "Merma",
    )


@router.post("/ajustes", status_code=201)
def ajuste(
    body: AjusteStockIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> EntradaCompraOut | SalidaStockOut:
    return stock_service.registrar_ajuste(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        producto_id=body.producto_id,
        cantidad=body.cantidad,
        motivo=body.motivo,
        precio_costo_neto=body.precio_costo_neto,
    )
