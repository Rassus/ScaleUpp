from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum
from sqlmodel import Field, SQLModel

from app.models.enums import EstadoTicket, TipoTicket, utcnow


class TicketSoporte(SQLModel, table=True):
    """Solicitudes del negocio: desuscripción o alta de negocio extra."""

    __tablename__ = "tickets_soporte"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    usuario_id: int = Field(foreign_key="usuarios.id", index=True)
    tipo: TipoTicket = Field(
        sa_column=Column(
            SAEnum(
                TipoTicket,
                name="tipoticket",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
            index=True,
        )
    )
    estado: EstadoTicket = Field(
        default=EstadoTicket.ABIERTO,
        sa_column=Column(
            SAEnum(
                EstadoTicket,
                name="estadoticket",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
            index=True,
        ),
    )
    mensaje: Optional[str] = Field(default=None, max_length=1000)
    nombre_negocio_solicitado: Optional[str] = Field(default=None, max_length=150)
    slug_negocio_solicitado: Optional[str] = Field(default=None, max_length=80)
    comuna_negocio_solicitado: Optional[str] = Field(default=None, max_length=120)
    negocio_creado_id: Optional[int] = Field(
        default=None, foreign_key="negocios.id"
    )
    respuesta_admin: Optional[str] = Field(default=None, max_length=1000)
    creado_en: datetime = Field(default_factory=utcnow)
    resuelto_en: Optional[datetime] = None
