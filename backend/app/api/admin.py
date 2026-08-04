from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.api.deps import CurrentContext, require_platform_admin
from app.db import get_session
from app.schemas.admin import (
    AdminConfigOut,
    AdminConfigUpdate,
    AdminCuentaIn,
    AdminNegocioOut,
    AdminNegocioUpdate,
    AdminOnboardIn,
    AdminOnboardOut,
    AdminPagoCreate,
    AdminPagoOut,
    AdminPagoUpdate,
    AdminProrrateoIn,
    AdminProrrateoOut,
    AdminResumenOut,
    AdminUsuarioOut,
)
from app.services import admin as admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/config", response_model=AdminConfigOut)
def get_config(
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminConfigOut:
    return admin_service.obtener_config(session)


@router.patch("/config", response_model=AdminConfigOut)
def patch_config(
    body: AdminConfigUpdate,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminConfigOut:
    return admin_service.actualizar_config(session, body)


@router.post("/prorrateo", response_model=AdminProrrateoOut)
def prorrateo(
    body: AdminProrrateoIn,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminProrrateoOut:
    return admin_service.preview_prorrateo(session, body)


@router.get("/resumen", response_model=AdminResumenOut)
def resumen(
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminResumenOut:
    return admin_service.resumen_admin(session)


@router.get("/negocios", response_model=list[AdminNegocioOut])
def listar_negocios(
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[AdminNegocioOut]:
    return admin_service.listar_negocios_admin(session)


@router.post(
    "/negocios/onboard",
    response_model=AdminOnboardOut,
    status_code=status.HTTP_201_CREATED,
)
def onboard(
    body: AdminOnboardIn,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminOnboardOut:
    return admin_service.onboard_negocio(session, body)


@router.get("/negocios/{negocio_id}", response_model=AdminNegocioOut)
def obtener_negocio(
    negocio_id: int,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminNegocioOut:
    return admin_service.obtener_negocio_admin(session, negocio_id)


@router.patch("/negocios/{negocio_id}", response_model=AdminNegocioOut)
def patch_negocio(
    negocio_id: int,
    body: AdminNegocioUpdate,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminNegocioOut:
    return admin_service.actualizar_negocio(
        session,
        negocio_id,
        nombre=body.nombre,
        comuna=body.comuna,
        activo=body.activo,
    )


@router.get(
    "/negocios/{negocio_id}/cuentas",
    response_model=list[AdminUsuarioOut],
)
def listar_cuentas(
    negocio_id: int,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[AdminUsuarioOut]:
    return admin_service.listar_cuentas(session, negocio_id)


@router.post(
    "/negocios/{negocio_id}/cuentas",
    response_model=AdminUsuarioOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_cuenta(
    negocio_id: int,
    body: AdminCuentaIn,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminUsuarioOut:
    return admin_service.agregar_cuenta(session, negocio_id, body)


@router.get("/pagos", response_model=list[AdminPagoOut])
def listar_pagos(
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    negocio_id: Annotated[Optional[int], Query()] = None,
) -> list[AdminPagoOut]:
    return admin_service.listar_pagos(session, negocio_id=negocio_id)


@router.post(
    "/pagos",
    response_model=AdminPagoOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_pago(
    body: AdminPagoCreate,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminPagoOut:
    return admin_service.crear_pago(session, body)


@router.patch("/pagos/{pago_id}", response_model=AdminPagoOut)
def patch_pago(
    pago_id: int,
    body: AdminPagoUpdate,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminPagoOut:
    return admin_service.actualizar_pago(session, pago_id, body)
