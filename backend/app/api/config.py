from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio, require_negocio_write
from app.db import get_session
from app.models import Negocio
from app.schemas.config_negocio import (
    ConfigNegocioOut,
    ConfigNegocioUpdate,
    PlanResumenOut,
)
from app.schemas.negocio import NegocioPerfilOut, NegocioPerfilUpdate
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


@router.get("/plan", response_model=PlanResumenOut)
def obtener_plan(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> PlanResumenOut:
    return config_service.resumen_plan(
        session, negocio_id=ctx.negocio.id  # type: ignore[arg-type]
    )


@router.get("/negocio", response_model=NegocioPerfilOut)
def obtener_perfil_negocio(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
) -> NegocioPerfilOut:
    n = ctx.negocio
    assert n is not None
    return NegocioPerfilOut(
        id=n.id,  # type: ignore[arg-type]
        nombre=n.nombre,
        slug=n.slug,
        comuna=n.comuna,
        activo=n.activo,
    )


@router.patch("/negocio", response_model=NegocioPerfilOut)
def actualizar_perfil_negocio(
    body: NegocioPerfilUpdate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> NegocioPerfilOut:
    negocio = session.get(Negocio, ctx.negocio.id)  # type: ignore[arg-type]
    if negocio is None:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    data = body.model_dump(exclude_unset=True)
    if "nombre" in data and data["nombre"] is not None:
        negocio.nombre = data["nombre"].strip()
    if "comuna" in data and data["comuna"] is not None:
        negocio.comuna = data["comuna"].strip()
    session.add(negocio)
    session.commit()
    session.refresh(negocio)
    return NegocioPerfilOut(
        id=negocio.id,  # type: ignore[arg-type]
        nombre=negocio.nombre,
        slug=negocio.slug,
        comuna=negocio.comuna,
        activo=negocio.activo,
    )
