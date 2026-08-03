from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Numeric
from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class ConfigNegocio(SQLModel, table=True):
    """Umbrales de alertas e inventario por negocio."""

    __tablename__ = "config_negocio"

    negocio_id: int = Field(foreign_key="negocios.id", primary_key=True)
    alerta_stock_cantidad: Decimal = Field(
        default=Decimal("5"),
        sa_column=Column(Numeric(12, 2), nullable=False),
        description="Alerta si stock <= esta cantidad",
    )
    alerta_stock_porcentaje: int = Field(
        default=15,
        ge=1,
        le=100,
        description="% del stock ideal para alerta de bajo stock",
    )
    dias_caducidad_alerta: int = Field(
        default=30,
        ge=1,
        le=365,
        description="Días previos a caducidad para avisar",
    )
    ingresos_visibles: int = Field(
        default=3,
        ge=1,
        le=50,
        description="Cuántos ingresos recientes mostrar en detalle de producto",
    )
    actualizado_en: datetime = Field(default_factory=utcnow)
