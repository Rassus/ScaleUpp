from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class ConfigPlataforma(SQLModel, table=True):
    """Valores globales de cobro ScaleUpp (fila única id=1)."""

    __tablename__ = "config_plataforma"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre_plan: str = Field(default="ScaleUpp Negocio", max_length=120)
    cuota_mensual_clp: int = Field(default=29990, ge=0)
    dias_gracia: int = Field(default=5, ge=0, le=31)
    """Días extra tras vencimiento antes de sugerir suspensión."""
    dia_facturacion: int = Field(default=1, ge=1, le=28)
    """Día del mes en que inicia el ciclo de cobro."""
    activo: bool = Field(default=True)
    actualizado_en: datetime = Field(default_factory=utcnow)
