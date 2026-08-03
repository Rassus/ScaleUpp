from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum, Numeric, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import MetodoPago, utcnow


class Venta(SQLModel, table=True):
    __tablename__ = "ventas"
    __table_args__ = (
        UniqueConstraint(
            "caja_chica_id", "numero", name="uq_ventas_caja_numero"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    caja_chica_id: Optional[int] = Field(
        default=None, foreign_key="caja_chica.id", index=True
    )
    numero: int = Field(index=True, ge=1)
    usuario_id: Optional[int] = Field(
        default=None, foreign_key="usuarios.id", index=True
    )
    fecha_hora: datetime = Field(default_factory=utcnow, index=True)
    metodo_pago: MetodoPago = Field(
        sa_column=Column(
            SAEnum(
                MetodoPago,
                name="metodopago",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
        )
    )
    cliente_id: Optional[int] = Field(
        default=None, foreign_key="clientes.id", index=True
    )
    # Precio público se asume con IVA incluido
    total_venta: int = Field(ge=0)
    total_neto: int = Field(ge=0)
    total_iva: int = Field(ge=0)
    monto_recargo: int = Field(default=0, ge=0)
    porcentaje_recargo: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(5, 2), nullable=False),
    )
    monto_descuento_promo: int = Field(default=0, ge=0)
    costo_total: int = Field(default=0, ge=0)  # costo real FIFO de componentes
    ganancia: int = Field(default=0)  # total_venta - costo_total (aprox. bruta)
    anulada: bool = Field(default=False)
    creado_en: datetime = Field(default_factory=utcnow)


class VentaItem(SQLModel, table=True):
    """Línea de lo que el cliente compró (SKU escaneado: SIMPLE o KIT)."""

    __tablename__ = "venta_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    venta_id: int = Field(foreign_key="ventas.id", index=True)
    producto_id: int = Field(foreign_key="productos.id", index=True)
    cantidad: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    precio_unitario: int = Field(ge=0)
    subtotal: int = Field(ge=0)


class DetalleVenta(SQLModel, table=True):
    """Consumo FIFO real: de qué lote salió cada componente."""

    __tablename__ = "detalle_ventas"

    id: Optional[int] = Field(default=None, primary_key=True)
    venta_id: int = Field(foreign_key="ventas.id", index=True)
    venta_item_id: int = Field(foreign_key="venta_items.id", index=True)
    producto_vendido_id: int = Field(foreign_key="productos.id", index=True)
    producto_id: int = Field(foreign_key="productos.id", index=True)  # componente
    lote_id: int = Field(foreign_key="lotes_stock.id", index=True)
    cantidad: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    precio_unitario_venta: int = Field(ge=0)  # del SKU vendido (referencia)
    costo_unitario: int = Field(ge=0)
