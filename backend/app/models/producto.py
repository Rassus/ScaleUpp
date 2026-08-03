from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum, Numeric, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import TipoProducto, utcnow


class Producto(SQLModel, table=True):
    __tablename__ = "productos"
    __table_args__ = (
        UniqueConstraint(
            "negocio_id",
            "codigo_barras",
            name="uq_producto_negocio_codigo_barras",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    codigo_barras: Optional[str] = Field(default=None, max_length=100, index=True)
    nombre: str = Field(max_length=150)
    categoria_id: Optional[int] = Field(
        default=None, foreign_key="categorias.id", index=True
    )
    unidad_medida_id: int = Field(foreign_key="unidades_medida.id", index=True)
    tipo: TipoProducto = Field(
        default=TipoProducto.SIMPLE,
        sa_column=Column(
            SAEnum(
                TipoProducto,
                name="tipoproducto",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
        ),
    )
    precio_venta: int = Field(ge=0)  # CLP entero
    controla_caducidad: bool = Field(default=False)
    porcentaje_emergencia: int = Field(default=15, ge=0, le=100)
    porcentaje_sobrestock: int = Field(default=150, ge=0)
    stock_ideal: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(12, 2), nullable=True),
    )
    stock_minimo: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(12, 2), nullable=True),
    )
    imagen_base64: Optional[str] = Field(
        default=None,
        sa_column=Column(Text, nullable=True),
        description="Data URL base64 de la imagen del producto",
    )
    activo: bool = Field(default=True)
    creado_en: datetime = Field(default_factory=utcnow)
