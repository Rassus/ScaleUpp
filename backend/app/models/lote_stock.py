from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Date, Numeric
from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class LoteStock(SQLModel, table=True):
    __tablename__ = "lotes_stock"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    producto_id: int = Field(foreign_key="productos.id", index=True)
    cantidad_inicial: Decimal = Field(
        sa_column=Column(Numeric(12, 2), nullable=False),
    )
    cantidad_actual: Decimal = Field(
        sa_column=Column(Numeric(12, 2), nullable=False),
    )
    precio_costo_neto: int = Field(ge=0)  # CLP por unidad
    iva_porcentaje: Decimal = Field(
        default=Decimal("19.00"),
        sa_column=Column(Numeric(5, 2), nullable=False),
    )
    costo_operacion_prorrateado: int = Field(default=0, ge=0)  # CLP por unidad
    fecha_ingreso: datetime = Field(default_factory=utcnow, index=True)
    fecha_caducidad: Optional[date] = Field(
        default=None,
        sa_column=Column(Date, nullable=True),
    )
    activo: bool = Field(default=True)
    creado_en: datetime = Field(default_factory=utcnow)
