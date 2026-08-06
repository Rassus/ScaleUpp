from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Numeric
from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class DemandaFaltante(SQLModel, table=True):
    """Pedido/consulta de producto sin stock (demanda no satisfecha)."""

    __tablename__ = "demanda_faltantes"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    producto_id: int = Field(foreign_key="productos.id", index=True)
    cantidad: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    precio_ref: int = Field(default=0, ge=0, description="Precio unitario de referencia CLP")
    usuario_id: Optional[int] = Field(default=None, foreign_key="usuarios.id")
    caja_chica_id: Optional[int] = Field(default=None, foreign_key="caja_chica.id")
    creado_en: datetime = Field(default_factory=utcnow, index=True)
