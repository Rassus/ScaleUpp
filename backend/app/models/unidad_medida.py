from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class UnidadMedida(SQLModel, table=True):
    __tablename__ = "unidades_medida"
    __table_args__ = (
        UniqueConstraint(
            "negocio_id", "sigla", name="uq_unidad_negocio_sigla"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    nombre: str = Field(max_length=50)
    sigla: str = Field(max_length=10)
    activo: bool = Field(default=True)
    creado_en: datetime = Field(default_factory=utcnow)
