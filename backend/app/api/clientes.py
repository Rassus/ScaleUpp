from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio, require_negocio_write
from app.db import get_session
from app.schemas.cliente import (
    ClienteCreate,
    ClienteDeudaOut,
    ClienteOut,
    ClienteUpdate,
    CobroCreditoIn,
    CobroCreditoOut,
)
from app.services import credito as credito_service

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("", response_model=list[ClienteOut])
def listar(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    solo_activos: bool = True,
) -> list[ClienteOut]:
    return credito_service.listar_clientes(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        solo_activos=solo_activos,
    )


@router.post("", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def crear(
    body: ClienteCreate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> ClienteOut:
    return credito_service.crear_cliente(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        data=body,
    )


@router.patch("/{cliente_id}", response_model=ClienteOut)
def actualizar(
    cliente_id: int,
    body: ClienteUpdate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> ClienteOut:
    return credito_service.actualizar_cliente(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        cliente_id=cliente_id,
        data=body,
    )


@router.delete("/{cliente_id}", response_model=ClienteOut)
def eliminar(
    cliente_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> ClienteOut:
    return credito_service.eliminar_cliente(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        cliente_id=cliente_id,
    )


@router.get("/{cliente_id}/deuda", response_model=ClienteDeudaOut)
def deuda(
    cliente_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> ClienteDeudaOut:
    return credito_service.deuda_detalle(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        cliente_id=cliente_id,
    )


@router.get("/{cliente_id}", response_model=ClienteOut)
def obtener(
    cliente_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> ClienteOut:
    row = credito_service.obtener_cliente(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        cliente_id=cliente_id,
    )
    return credito_service.cliente_to_out(session, row)
