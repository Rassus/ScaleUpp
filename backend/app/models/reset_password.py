from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String
from sqlmodel import Field, SQLModel

from app.models.enums import EstadoResetPassword, utcnow


class SolicitudResetPassword(SQLModel, table=True):
    """Pedido de recuperación de contraseña (aprobación manual por admin)."""

    __tablename__ = "solicitudes_reset_password"

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id", index=True)
    email: str = Field(max_length=255, index=True)
    estado: EstadoResetPassword = Field(
        default=EstadoResetPassword.PENDIENTE,
        sa_column=Column(String(20), nullable=False, index=True),
    )
    nota_admin: Optional[str] = Field(default=None, max_length=255)
    resuelto_por_id: Optional[int] = Field(default=None, foreign_key="usuarios.id")
    creado_en: datetime = Field(default_factory=utcnow, index=True)
    resuelto_en: Optional[datetime] = Field(default=None)
