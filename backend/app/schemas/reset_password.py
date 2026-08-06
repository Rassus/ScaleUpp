from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.enums import EstadoResetPassword


class OlvidePasswordIn(BaseModel):
    email: EmailStr


class OlvidePasswordOut(BaseModel):
    mensaje: str = (
        "Si el correo está registrado, un administrador revisará tu solicitud."
    )


class ResetPasswordOut(BaseModel):
    id: int
    usuario_id: int
    email: str
    usuario_nombre: str
    estado: EstadoResetPassword
    nota_admin: Optional[str] = None
    creado_en: datetime
    resuelto_en: Optional[datetime] = None


class ResetPasswordResolverIn(BaseModel):
    accion: Literal["RESOLVER", "RECHAZAR"]
    password: Optional[str] = Field(
        default=None,
        min_length=64,
        max_length=64,
        pattern=r"^[a-f0-9]{64}$",
    )
    nota: Optional[str] = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def password_si_resuelve(self) -> "ResetPasswordResolverIn":
        if self.accion == "RESOLVER" and not self.password:
            raise ValueError("password es obligatorio al resolver")
        return self
