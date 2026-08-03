from datetime import date, datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio
from app.db import get_session
from app.schemas.venta import VentaCreate, VentaOut
from app.services import venta as venta_service

router = APIRouter(prefix="/ventas", tags=["ventas"])


@router.post("", response_model=VentaOut, status_code=201)
def crear_venta(
    body: VentaCreate,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> VentaOut:
    """Cajero u owner pueden vender (cualquier usuario con acceso al negocio)."""
    return venta_service.registrar_venta(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        usuario_id=ctx.usuario.id,
        data=body,
    )


@router.get("", response_model=list[VentaOut])
def listar(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=2000)] = 50,
    desde: Annotated[
        Optional[date],
        Query(description="Incluye ventas desde esta fecha (inclusive)"),
    ] = None,
    hasta: Annotated[
        Optional[date],
        Query(description="Incluye ventas hasta esta fecha (inclusive)"),
    ] = None,
) -> list[VentaOut]:
    start = (
        datetime.combine(desde, datetime.min.time()) if desde is not None else None
    )
    end = None
    if hasta is not None:
        end = datetime.combine(hasta, datetime.min.time())
        from datetime import timedelta

        end = end + timedelta(days=1)
    return venta_service.listar_ventas(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        limit=limit,
        desde=start,
        hasta=end,
    )

@router.get("/{venta_id}", response_model=VentaOut)
def obtener(
    venta_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> VentaOut:
    return venta_service.obtener_venta(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        venta_id=venta_id,
    )


@router.post("/{venta_id}/anular", response_model=VentaOut)
def anular(
    venta_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> VentaOut:
    """Anula la venta, restaura stock FIFO a los lotes y quita el ingreso de caja."""
    return venta_service.anular_venta(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        venta_id=venta_id,
    )
