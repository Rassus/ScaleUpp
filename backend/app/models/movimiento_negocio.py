from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum
from sqlmodel import Field, SQLModel

from app.models.enums import TipoMovimientoNegocio, utcnow


class MovimientoNegocio(SQLModel, table=True):
    __tablename__ = "movimientos_negocio"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    usuario_id: Optional[int] = Field(default=None, foreign_key="usuarios.id")
    tipo: TipoMovimientoNegocio = Field(
        sa_column=Column(
            SAEnum(
                TipoMovimientoNegocio,
                name="tipomovimientonegocio",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
            index=True,
        )
    )
    monto: int = Field(ge=0)
    descripcion: str = Field(max_length=255)
    compra_id: Optional[int] = Field(
        default=None, foreign_key="compras_mercaderia.id", index=True
    )
    fecha_hora: datetime = Field(default_factory=utcnow, index=True)
