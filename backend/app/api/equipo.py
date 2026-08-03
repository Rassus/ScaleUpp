"""Equipo del negocio: listar y crear cajeros (owner)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio_write
from app.db import get_session
from app.models.enums import RolMembresia
from app.schemas.admin import AdminCuentaIn, AdminUsuarioOut
from app.services import admin as admin_service

router = APIRouter(prefix="/equipo", tags=["equipo"])


class EquipoCuentaIn(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    nombre: str = Field(min_length=2, max_length=150)
    password: str = Field(min_length=6, max_length=100)

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str) -> str:
        value = v.strip().lower()
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("email inválido")
        return value


@router.get("", response_model=list[AdminUsuarioOut])
def listar_equipo(
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> list[AdminUsuarioOut]:
    return admin_service.listar_cuentas(
        session, negocio_id=ctx.negocio.id  # type: ignore[arg-type]
    )


@router.post("", response_model=AdminUsuarioOut, status_code=201)
def crear_cajero(
    body: EquipoCuentaIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminUsuarioOut:
    """El dueño solo puede crear cuentas con rol cajero."""
    return admin_service.agregar_cuenta(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        body=AdminCuentaIn(
            email=body.email,
            nombre=body.nombre,
            password=body.password,
            rol=RolMembresia.CAJERO,
        ),
    )
