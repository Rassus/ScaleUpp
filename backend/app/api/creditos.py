from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio_write
from app.db import get_session
from app.schemas.cliente import CobroCreditoIn, CobroCreditoOut
from app.services import credito as credito_service

router = APIRouter(prefix="/creditos", tags=["creditos"])


@router.post(
    "/cobros",
    response_model=CobroCreditoOut,
    status_code=status.HTTP_201_CREATED,
)
def registrar_cobro(
    body: CobroCreditoIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> CobroCreditoOut:
    return credito_service.registrar_cobro(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        data=body,
    )
