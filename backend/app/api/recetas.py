from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio, require_negocio_write
from app.db import get_session
from app.schemas.receta import ExpansionOut, RecetaOut, RecetaReplaceIn
from app.services import receta as receta_service

router = APIRouter(prefix="/productos", tags=["recetas"])


@router.get("/{producto_id}/receta", response_model=RecetaOut)
def obtener_receta(
    producto_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> RecetaOut:
    kit = receta_service.get_kit_or_404(
        session, producto_id, ctx.negocio.id  # type: ignore[arg-type]
    )
    return receta_service.listar_receta(session, kit)


@router.put("/{producto_id}/receta", response_model=RecetaOut)
def reemplazar_receta(
    producto_id: int,
    body: RecetaReplaceIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> RecetaOut:
    kit = receta_service.get_kit_or_404(
        session, producto_id, ctx.negocio.id  # type: ignore[arg-type]
    )
    items = [
        (item.producto_componente_id, item.cantidad) for item in body.componentes
    ]
    return receta_service.reemplazar_receta(session, kit=kit, items=items)


@router.get("/{producto_id}/expandir", response_model=ExpansionOut)
def expandir(
    producto_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    cantidad: Annotated[Decimal, Query(gt=0)] = Decimal("1"),
) -> ExpansionOut:
    kit = receta_service.get_kit_or_404(
        session, producto_id, ctx.negocio.id  # type: ignore[arg-type]
    )
    return receta_service.expandir_kit(
        session, kit=kit, cantidad_kits=cantidad
    )
