from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import RolMembresia, utcnow


class Membresia(SQLModel, table=True):
    __tablename__ = "membresias"
    __table_args__ = (
        UniqueConstraint("usuario_id", "negocio_id", name="uq_membresia_usuario_negocio"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id", index=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    rol: RolMembresia = Field(
        sa_column=Column(
            SAEnum(
                RolMembresia,
                name="rolmembresia",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
        )
    )
    activo: bool = Field(default=True)
    creado_en: datetime = Field(default_factory=utcnow)
