from datetime import date, datetime
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import EstadoCaja, MetodoPago, TipoTransaccion, utcnow


class CajaChica(SQLModel, table=True):
    __tablename__ = "caja_chica"
    __table_args__ = (
        UniqueConstraint(
            "negocio_id", "numero", name="uq_caja_chica_negocio_numero"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    numero: int = Field(index=True, ge=1)
    fecha: date = Field(index=True)
    nombre_vendedor: str = Field(max_length=120, default="Sin nombre")
    monto_apertura: int = Field(ge=0)
    monto_cierre: Optional[int] = Field(default=None, ge=0)
    efectivo_teorico: Optional[int] = Field(default=None)
    diferencia: Optional[int] = Field(default=None)
    estado: EstadoCaja = Field(
        default=EstadoCaja.ABIERTA,
        sa_column=Column(
            SAEnum(
                EstadoCaja,
                name="estadocaja",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
            index=True,
        ),
    )
    abierta_por_usuario_id: Optional[int] = Field(
        default=None, foreign_key="usuarios.id"
    )
    cerrada_por_usuario_id: Optional[int] = Field(
        default=None, foreign_key="usuarios.id"
    )
    creado_en: datetime = Field(default_factory=utcnow)
    cerrada_en: Optional[datetime] = Field(default=None)


class TransaccionFinanciera(SQLModel, table=True):
    __tablename__ = "transacciones_financieras"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    caja_chica_id: int = Field(foreign_key="caja_chica.id", index=True)
    tipo_transaccion: TipoTransaccion = Field(
        sa_column=Column(
            SAEnum(
                TipoTransaccion,
                name="tipotransaccion",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
            index=True,
        )
    )
    monto: int = Field(ge=0)
    descripcion: str = Field(max_length=255)
    medio_pago: MetodoPago = Field(
        sa_column=Column(
            SAEnum(
                MetodoPago,
                name="metodopago",
                values_callable=lambda x: [e.value for e in x],
                create_constraint=False,
                native_enum=True,
                create_type=False,
            ),
            nullable=False,
        )
    )
    venta_id: Optional[int] = Field(default=None, foreign_key="ventas.id", index=True)
    fecha_hora: datetime = Field(default_factory=utcnow, index=True)
