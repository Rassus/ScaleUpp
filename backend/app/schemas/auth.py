from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.enums import RolMembresia

# Digest SHA-256 hex del cliente (64 chars)
_PASSWORD_DIGEST = Field(min_length=64, max_length=64, pattern=r"^[a-f0-9]{64}$")
# Login: digest (cliente) o plano legado
_PASSWORD_LOGIN = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = _PASSWORD_LOGIN
    negocio_id: Optional[int] = None


class ChangePasswordRequest(BaseModel):
    password_actual: str = _PASSWORD_DIGEST
    password_nueva: str = _PASSWORD_DIGEST

    @model_validator(mode="after")
    def distintas(self) -> "ChangePasswordRequest":
        if self.password_actual == self.password_nueva:
            raise ValueError("La nueva contraseña debe ser distinta")
        return self


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    usuario_id: int
    email: EmailStr
    nombre: str
    es_platform_admin: bool
    debe_cambiar_password: bool = False
    negocio_id: Optional[int] = None
    rol: Optional[RolMembresia] = None


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class MembresiaOut(BaseModel):
    id: int
    negocio_id: int
    negocio_nombre: str
    negocio_comuna: Optional[str] = None
    rol: RolMembresia
    activo: bool


class RegistroNegocioIn(BaseModel):
    """Alta pública: negocio + owner; queda pendiente (activo=False)."""

    nombre: str = Field(min_length=2, max_length=150)
    slug: str = Field(
        min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
    )
    comuna: str = Field(min_length=2, max_length=120)
    owner_nombre: str = Field(min_length=2, max_length=150)
    owner_email: EmailStr
    password: str = _PASSWORD_DIGEST


class RegistroNegocioOut(BaseModel):
    negocio_id: int
    negocio_nombre: str
    owner_email: EmailStr
    mensaje: str = (
        "Solicitud enviada. Te avisaremos cuando el negocio esté aprobado."
    )


class UsuarioMe(BaseModel):
    id: int
    email: EmailStr
    nombre: str
    es_platform_admin: bool
    activo: bool
    debe_cambiar_password: bool = False
    negocio_activo_id: Optional[int] = None
    rol_activo: Optional[RolMembresia] = None
    membresias: list[MembresiaOut] = []
