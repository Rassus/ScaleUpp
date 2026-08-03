from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio, require_negocio_write
from app.db import get_session
from app.schemas.promocion import (
    PrecioEfectivoOut,
    PromocionCreate,
    PromocionItemIn,
    PromocionOut,
    PromocionUpdate,
)
from app.services import promocion as promo_svc

router = APIRouter(prefix="/promociones", tags=["promociones"])


@router.get("", response_model=list[PromocionOut])
def listar(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    solo_activas: bool = False,
) -> list[PromocionOut]:
    return promo_svc.listar_promociones(
        session, negocio_id=ctx.negocio.id, solo_activas=solo_activas  # type: ignore[arg-type]
    )


@router.post("", response_model=PromocionOut, status_code=status.HTTP_201_CREATED)
def crear(
    body: PromocionCreate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> PromocionOut:
    return promo_svc.crear_promocion(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        usuario_id=ctx.usuario.id,
        data=body,
    )


@router.get("/{promocion_id}", response_model=PromocionOut)
def obtener(
    promocion_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> PromocionOut:
    return promo_svc.obtener_promocion(
        session, negocio_id=ctx.negocio.id, promocion_id=promocion_id  # type: ignore[arg-type]
    )


@router.patch("/{promocion_id}", response_model=PromocionOut)
def actualizar(
    promocion_id: int,
    body: PromocionUpdate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> PromocionOut:
    return promo_svc.actualizar_promocion(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        promocion_id=promocion_id,
        data=body,
    )


@router.post("/{promocion_id}/items", response_model=PromocionOut, status_code=201)
def agregar_item(
    promocion_id: int,
    body: PromocionItemIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> PromocionOut:
    return promo_svc.agregar_item_promocion(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        promocion_id=promocion_id,
        item=body,
    )


@router.delete("/{promocion_id}/items/{item_id}", response_model=PromocionOut)
def eliminar_item(
    promocion_id: int,
    item_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> PromocionOut:
    return promo_svc.eliminar_item_promocion(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        promocion_id=promocion_id,
        item_id=item_id,
    )


# Endpoint auxiliar montado también desde productos
precio_router = APIRouter(prefix="/productos", tags=["productos"])


@precio_router.get("/{producto_id}/precio-efectivo", response_model=PrecioEfectivoOut)
def precio_efectivo(
    producto_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> PrecioEfectivoOut:
    return promo_svc.precio_efectivo_out(
        session, negocio_id=ctx.negocio.id, producto_id=producto_id  # type: ignore[arg-type]
    )
