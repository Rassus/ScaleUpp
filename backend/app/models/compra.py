from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Date, Numeric, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class CompraMercaderia(SQLModel, table=True):
    __tablename__ = "compras_mercaderia"
    __table_args__ = (
        UniqueConstraint(
            "negocio_id",
            "numero",
            name="uq_compras_mercaderia_negocio_numero",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    numero: int = Field(index=True, ge=1)
    usuario_id: Optional[int] = Field(default=None, foreign_key="usuarios.id")
    fecha: date = Field(index=True)
    nota: Optional[str] = Field(default=None, max_length=255)
    costo_operacion_total: int = Field(default=0, ge=0)
    monto_total: int = Field(ge=0)
    creado_en: datetime = Field(default_factory=utcnow, index=True)


class CompraMercaderiaItem(SQLModel, table=True):
    __tablename__ = "compras_mercaderia_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    compra_id: int = Field(foreign_key="compras_mercaderia.id", index=True)
    producto_id: int = Field(foreign_key="productos.id", index=True)
    cantidad: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    precio_costo_neto: int = Field(ge=0)
    iva_porcentaje: Decimal = Field(
        default=Decimal("19.00"),
        sa_column=Column(Numeric(5, 2), nullable=False),
    )
    fecha_caducidad: Optional[date] = Field(
        default=None,
        sa_column=Column(Date, nullable=True),
    )
    monto_linea: int = Field(ge=0)
    lote_stock_id: Optional[int] = Field(
        default=None, foreign_key="lotes_stock.id", index=True
    )
