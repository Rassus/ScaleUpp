from typing import Annotated, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio
from app.db import get_session
from app.models.enums import TipoTransaccion
from app.schemas.caja import (
    AbrirCajaIn,
    CajaOut,
    CerrarCajaIn,
    CuadreOut,
    GastoIn,
    TransaccionOut,
)
from app.schemas.venta import VentaOut
from app.services import caja as caja_service

router = APIRouter(prefix="/caja", tags=["caja"])


@router.get("/actual", response_model=Optional[CajaOut])
def caja_actual(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> CajaOut | None:
    caja = caja_service.get_caja_abierta(
        session, negocio_id=ctx.negocio.id  # type: ignore[arg-type]
    )
    if caja is None:
        return None
    return caja_service.caja_to_out(
        caja, caja_service.calcular_cuadre(session, caja), session=session
    )


@router.get("", response_model=list[CajaOut])
def listar_cajas(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    fecha: Annotated[Optional[date], Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> list[CajaOut]:
    return caja_service.listar_cajas(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        fecha=fecha,
        limit=limit,
    )


@router.post("/abrir", response_model=CajaOut, status_code=201)
def abrir(
    body: AbrirCajaIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> CajaOut:
    return caja_service.abrir_caja(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        usuario_id=ctx.usuario.id,
        monto_apertura=body.monto_apertura,
        nombre_vendedor=body.nombre_vendedor,
        fecha=body.fecha,
    )


@router.post("/cerrar", response_model=CajaOut)
def cerrar(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    body: Optional[CerrarCajaIn] = None,
) -> CajaOut:
    return caja_service.cerrar_caja(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        usuario_id=ctx.usuario.id,
        monto_cierre=body.monto_cierre if body else None,
    )


@router.get("/cuadre", response_model=CuadreOut)
def cuadre(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> CuadreOut:
    caja = caja_service.require_caja_abierta(
        session, negocio_id=ctx.negocio.id  # type: ignore[arg-type]
    )
    return caja_service.calcular_cuadre(session, caja)


@router.get("/{caja_id}/transacciones", response_model=list[TransaccionOut])
def transacciones(
    caja_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> list[TransaccionOut]:
    return caja_service.listar_transacciones(
        session, caja_id=caja_id, negocio_id=ctx.negocio.id  # type: ignore[arg-type]
    )


@router.get("/{caja_id}/ventas", response_model=list[VentaOut])
def ventas_caja(
    caja_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> list[VentaOut]:
    return caja_service.listar_ventas_caja(
        session, caja_id=caja_id, negocio_id=ctx.negocio.id  # type: ignore[arg-type]
    )


@router.post("/gastos", response_model=TransaccionOut, status_code=201)
def registrar_gasto(
    body: GastoIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> TransaccionOut:
    if body.tipo_transaccion not in (
        TipoTransaccion.GASTO_OPERATIVO,
        TipoTransaccion.GASTO_GENERAL,
        TipoTransaccion.INYECCION_CAJA,
    ):
        raise HTTPException(
            status_code=400,
            detail="Usa GASTO_OPERATIVO, GASTO_GENERAL o INYECCION_CAJA",
        )
    return caja_service.registrar_transaccion(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        tipo=body.tipo_transaccion,
        monto=body.monto,
        descripcion=body.descripcion,
        medio_pago=body.medio_pago,
    )
