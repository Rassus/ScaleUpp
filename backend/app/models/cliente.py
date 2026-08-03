from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum, Numeric
from sqlmodel import Field, SQLModel

from app.models.enums import MetodoPago, TipoCreditoMovimiento, utcnow


class Cliente(SQLModel, table=True):
    __tablename__ = "clientes"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    nombre: str = Field(max_length=150)
    telefono: Optional[str] = Field(default=None, max_length=40)
    rut: Optional[str] = Field(default=None, max_length=20)
    limite_credito: int = Field(default=0, ge=0)
    porcentaje_recargo: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(5, 2), nullable=False),
    )
    plazo_dias: int = Field(default=30, ge=0)
    activo: bool = Field(default=True)
    creado_en: datetime = Field(default_factory=utcnow)


class CreditoMovimiento(SQLModel, table=True):
    """Cargos (fiado) y abonos (cobros) de crédito."""

    __tablename__ = "credito_movimientos"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    cliente_id: int = Field(foreign_key="clientes.id", index=True)
    tipo: TipoCreditoMovimiento = Field(
        sa_column=Column(
            SAEnum(
                TipoCreditoMovimiento,
                name="tipocreditomovimiento",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
            index=True,
        )
    )
    monto: int = Field(ge=0)
    # Para CARGO: saldo pendiente. Para ABONO: 0.
    saldo: int = Field(default=0, ge=0)
    venta_id: Optional[int] = Field(default=None, foreign_key="ventas.id", index=True)
    medio_pago: Optional[MetodoPago] = Field(
        default=None,
        sa_column=Column(
            SAEnum(
                MetodoPago,
                name="metodopago",
                values_callable=lambda x: [e.value for e in x],
                create_constraint=False,
                native_enum=True,
                create_type=False,
            ),
            nullable=True,
        ),
    )
    fecha_vencimiento: Optional[date] = Field(default=None, index=True)
    transaccion_id: Optional[int] = Field(
        default=None, foreign_key="transacciones_financieras.id", index=True
    )
    descripcion: Optional[str] = Field(default=None, max_length=255)
    creado_en: datetime = Field(default_factory=utcnow, index=True)
