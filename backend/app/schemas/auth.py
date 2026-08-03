from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import RolMembresia


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    negocio_id: Optional[int] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    usuario_id: int
    email: EmailStr
    nombre: str
    es_platform_admin: bool
    negocio_id: Optional[int] = None
    rol: Optional[RolMembresia] = None


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class MembresiaOut(BaseModel):
    id: int
    negocio_id: int
    negocio_nombre: str
    rol: RolMembresia
    activo: bool


class UsuarioMe(BaseModel):
    id: int
    email: EmailStr
    nombre: str
    es_platform_admin: bool
    activo: bool
    negocio_activo_id: Optional[int] = None
    rol_activo: Optional[RolMembresia] = None
    membresias: list[MembresiaOut] = []
