from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio, require_negocio_write
from app.db import get_session
from app.schemas.compra import (
    CompraCreateIn,
    CompraListItemOut,
    CompraOut,
    InversionResumenOut,
)
from app.services import compra as compra_service

router = APIRouter(prefix="/compras", tags=["compras"])


@router.get("", response_model=list[CompraListItemOut])
def listar(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[CompraListItemOut]:
    return compra_service.listar_compras(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        limit=limit,
    )


@router.get("/inversiones", response_model=InversionResumenOut)
def inversiones(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> InversionResumenOut:
    return compra_service.resumen_inversiones(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        limit=limit,
    )


@router.get("/{compra_id}", response_model=CompraOut)
def detalle(
    compra_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> CompraOut:
    return compra_service.obtener_compra(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        compra_id=compra_id,
    )


@router.post("", response_model=CompraOut, status_code=201)
def crear(
    body: CompraCreateIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> CompraOut:
    return compra_service.registrar_compra(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        usuario_id=ctx.usuario.id,
        body=body,
    )
