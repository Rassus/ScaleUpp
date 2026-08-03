from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import CurrentContext, require_platform_admin
from app.db import get_session
from app.models import Negocio
from app.schemas.negocio import NegocioCreate, NegocioOut

router = APIRouter(prefix="/negocios", tags=["negocios"])


@router.get("", response_model=list[NegocioOut])
def listar_negocios(
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[Negocio]:
    return list(session.exec(select(Negocio).order_by(Negocio.id)).all())


@router.post("", response_model=NegocioOut, status_code=status.HTTP_201_CREATED)
def crear_negocio(
    body: NegocioCreate,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> Negocio:
    existente = session.exec(
        select(Negocio).where(Negocio.slug == body.slug.lower())
    ).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un negocio con ese slug",
        )

    negocio = Negocio(nombre=body.nombre, slug=body.slug.lower())
    session.add(negocio)
    session.commit()
    session.refresh(negocio)
    return negocio


@router.get("/{negocio_id}", response_model=NegocioOut)
def obtener_negocio(
    negocio_id: int,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> Negocio:
    negocio = session.get(Negocio, negocio_id)
    if negocio is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negocio no encontrado",
        )
    return negocio
