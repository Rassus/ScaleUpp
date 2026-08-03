from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class Categoria(SQLModel, table=True):
    __tablename__ = "categorias"
    __table_args__ = (
        UniqueConstraint(
            "negocio_id", "nombre", name="uq_categoria_negocio_nombre"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    nombre: str = Field(max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    acceso_rapido: bool = Field(default=False)
    activo: bool = Field(default=True)
    creado_en: datetime = Field(default_factory=utcnow)
