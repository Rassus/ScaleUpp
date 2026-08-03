from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio, require_negocio_write
from app.db import get_session
from app.schemas.config_negocio import ConfigNegocioOut, ConfigNegocioUpdate
from app.services import config_negocio as config_service

router = APIRouter(prefix="/config", tags=["config"])


@router.get("", response_model=ConfigNegocioOut)
def obtener(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> ConfigNegocioOut:
    return config_service.obtener_config(
        session, negocio_id=ctx.negocio.id  # type: ignore[arg-type]
    )


@router.put("", response_model=ConfigNegocioOut)
def actualizar(
    body: ConfigNegocioUpdate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> ConfigNegocioOut:
    return config_service.actualizar_config(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        body=body,
    )
