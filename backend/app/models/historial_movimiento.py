from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum, Numeric
from sqlmodel import Field, SQLModel

from app.models.enums import TipoMovimiento, utcnow


class HistorialMovimiento(SQLModel, table=True):
    __tablename__ = "historial_movimientos"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    producto_id: int = Field(foreign_key="productos.id", index=True)
    lote_id: int = Field(foreign_key="lotes_stock.id", index=True)
    tipo_movimiento: TipoMovimiento = Field(
        sa_column=Column(
            SAEnum(
                TipoMovimiento,
                name="tipomovimiento",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
            index=True,
        )
    )
    cantidad: Decimal = Field(
        sa_column=Column(Numeric(12, 2), nullable=False),
    )
    costo_unitario_aplicado: int = Field(default=0, ge=0)
    motivo: Optional[str] = Field(default=None, max_length=255)
    fecha_hora: datetime = Field(default_factory=utcnow, index=True)
