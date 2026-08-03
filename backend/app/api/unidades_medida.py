from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import CurrentContext, require_negocio, require_negocio_write
from app.db import get_session
from app.models import UnidadMedida
from app.schemas.unidad_medida import (
    UnidadMedidaCreate,
    UnidadMedidaOut,
    UnidadMedidaUpdate,
)

router = APIRouter(prefix="/unidades-medida", tags=["unidades-medida"])


@router.get("", response_model=list[UnidadMedidaOut])
def listar(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    solo_activos: bool = True,
) -> list[UnidadMedida]:
    q = select(UnidadMedida).where(UnidadMedida.negocio_id == ctx.negocio.id)
    if solo_activos:
        q = q.where(UnidadMedida.activo == True)  # noqa: E712
    return list(session.exec(q.order_by(UnidadMedida.nombre)).all())


@router.post("", response_model=UnidadMedidaOut, status_code=status.HTTP_201_CREATED)
def crear(
    body: UnidadMedidaCreate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> UnidadMedida:
    sigla = body.sigla.strip().upper()
    exists = session.exec(
        select(UnidadMedida).where(
            UnidadMedida.negocio_id == ctx.negocio.id,
            UnidadMedida.sigla == sigla,
        )
    ).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una unidad con esa sigla",
        )
    row = UnidadMedida(
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        nombre=body.nombre.strip(),
        sigla=sigla,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.patch("/{unidad_id}", response_model=UnidadMedidaOut)
def actualizar(
    unidad_id: int,
    body: UnidadMedidaUpdate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> UnidadMedida:
    row = session.get(UnidadMedida, unidad_id)
    if row is None or row.negocio_id != ctx.negocio.id:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    data = body.model_dump(exclude_unset=True)
    if "sigla" in data and data["sigla"] is not None:
        data["sigla"] = data["sigla"].strip().upper()
        other = session.exec(
            select(UnidadMedida).where(
                UnidadMedida.negocio_id == ctx.negocio.id,
                UnidadMedida.sigla == data["sigla"],
                UnidadMedida.id != unidad_id,
            )
        ).first()
        if other:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una unidad con esa sigla",
            )
    if "nombre" in data and data["nombre"] is not None:
        data["nombre"] = data["nombre"].strip()

    for key, value in data.items():
        setattr(row, key, value)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
