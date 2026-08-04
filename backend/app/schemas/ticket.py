from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.models.enums import EstadoTicket, TipoTicket


class TicketCreate(BaseModel):
    tipo: TipoTicket
    mensaje: Optional[str] = Field(default=None, max_length=1000)
    nombre_negocio: Optional[str] = Field(default=None, min_length=2, max_length=150)
    slug_negocio: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=80,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    comuna: Optional[str] = Field(default=None, min_length=2, max_length=120)

    @model_validator(mode="after")
    def validar_tipo(self) -> "TicketCreate":
        if self.tipo == TipoTicket.NUEVO_NEGOCIO:
            if not self.nombre_negocio or not self.nombre_negocio.strip():
                raise ValueError("nombre_negocio es obligatorio para NUEVO_NEGOCIO")
            if not self.comuna or not self.comuna.strip():
                raise ValueError("comuna es obligatoria para NUEVO_NEGOCIO")
        return self


class TicketOut(BaseModel):
    id: int
    negocio_id: int
    negocio_nombre: str
    usuario_id: int
    usuario_email: str
    usuario_nombre: str
    tipo: TipoTicket
    estado: EstadoTicket
    mensaje: Optional[str]
    nombre_negocio_solicitado: Optional[str]
    slug_negocio_solicitado: Optional[str]
    comuna_negocio_solicitado: Optional[str] = None
    negocio_creado_id: Optional[int]
    respuesta_admin: Optional[str]
    creado_en: datetime
    resuelto_en: Optional[datetime]
    costo_extra_mensual_clp: Optional[int] = None


class TicketAdminUpdate(BaseModel):
    estado: EstadoTicket
    respuesta_admin: Optional[str] = Field(default=None, max_length=1000)
    """Si RESUELTO + NUEVO_NEGOCIO, crea el negocio y cuota add-on."""
