from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, col, select

from app.api.deps import CurrentContext, require_negocio, require_negocio_write
from app.db import get_session
from app.models import Categoria
from app.schemas.categoria import CategoriaCreate, CategoriaOut, CategoriaUpdate

router = APIRouter(prefix="/categorias", tags=["categorias"])


@router.get("", response_model=list[CategoriaOut])
def listar(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    solo_activos: bool = True,
) -> list[Categoria]:
    q = select(Categoria).where(Categoria.negocio_id == ctx.negocio.id)
    if solo_activos:
        q = q.where(Categoria.activo == True)  # noqa: E712
    return list(
        session.exec(
            q.order_by(
                col(Categoria.acceso_rapido).desc(),
                Categoria.nombre,
            )
        ).all()
    )


@router.post("", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
def crear(
    body: CategoriaCreate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> Categoria:
    nombre = body.nombre.strip()
    exists = session.exec(
        select(Categoria).where(
            Categoria.negocio_id == ctx.negocio.id,
            Categoria.nombre == nombre,
        )
    ).first()
    if exists:
        if not exists.activo:
            exists.activo = True
            exists.descripcion = body.descripcion
            exists.acceso_rapido = body.acceso_rapido
            session.add(exists)
            session.commit()
            session.refresh(exists)
            return exists
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una categoría con ese nombre",
        )
    row = Categoria(
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        nombre=nombre,
        descripcion=body.descripcion,
        acceso_rapido=body.acceso_rapido,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.patch("/{categoria_id}", response_model=CategoriaOut)
def actualizar(
    categoria_id: int,
    body: CategoriaUpdate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> Categoria:
    row = session.get(Categoria, categoria_id)
    if row is None or row.negocio_id != ctx.negocio.id:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    data = body.model_dump(exclude_unset=True)
    if "nombre" in data and data["nombre"] is not None:
        data["nombre"] = data["nombre"].strip()
        other = session.exec(
            select(Categoria).where(
                Categoria.negocio_id == ctx.negocio.id,
                Categoria.nombre == data["nombre"],
                Categoria.id != categoria_id,
            )
        ).first()
        if other:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una categoría con ese nombre",
            )

    for key, value in data.items():
        setattr(row, key, value)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.delete("/{categoria_id}", response_model=CategoriaOut)
def eliminar(
    categoria_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> Categoria:
    """Baja lógica: la categoría deja de listarse pero se conserva el histórico."""
    row = session.get(Categoria, categoria_id)
    if row is None or row.negocio_id != ctx.negocio.id:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    row.activo = False
    row.acceso_rapido = False
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
