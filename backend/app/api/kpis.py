from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio
from app.db import get_session
from app.schemas.kpi import KpisOut
from app.services import kpi as kpi_service

router = APIRouter(prefix="/kpis", tags=["kpis"])


@router.get("", response_model=KpisOut)
def obtener_kpis(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    fecha: Annotated[
        Optional[date],
        Query(description="Fecha de referencia (default: hoy)"),
    ] = None,
    top_n: Annotated[int, Query(ge=1, le=20)] = 5,
    dias_caducidad: Annotated[
        Optional[int],
        Query(ge=1, le=365, description="Override; default: config del negocio"),
    ] = None,
) -> KpisOut:
    return kpi_service.obtener_kpis(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        fecha=fecha,
        top_n=top_n,
        dias_caducidad=dias_caducidad,
    )
