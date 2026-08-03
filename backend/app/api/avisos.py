from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio
from app.db import get_session
from app.schemas.aviso import AvisoAckIn, AvisoAckOut, AvisoPendienteOut
from app.services import aviso as aviso_service

router = APIRouter(prefix="/avisos", tags=["avisos"])


@router.get("/pendientes", response_model=list[AvisoPendienteOut])
def pendientes(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> list[AvisoPendienteOut]:
    return aviso_service.listar_pendientes(
        session, negocio_id=ctx.negocio.id  # type: ignore[arg-type]
    )


@router.post("/ack", response_model=AvisoAckOut)
def ack(
    body: AvisoAckIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> AvisoAckOut:
    n = aviso_service.ack_avisos(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        body=body,
    )
    return AvisoAckOut(marcados=n)
