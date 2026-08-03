from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import EstadoCaja, MetodoPago, TipoTransaccion


class AbrirCajaIn(BaseModel):
    monto_apertura: int = Field(ge=0)
    nombre_vendedor: str = Field(min_length=1, max_length=120)
    fecha: Optional[date] = None  # default: hoy


class CerrarCajaIn(BaseModel):
    """Cuerpo opcional. Si no hay monto, el cierre usa el efectivo teórico."""

    monto_cierre: Optional[int] = Field(
        default=None,
        ge=0,
        description="Opcional. Si se omite, cierra con el efectivo teórico (sin descuadre).",
    )


class GastoIn(BaseModel):
    tipo_transaccion: TipoTransaccion = Field(
        description="GASTO_OPERATIVO, GASTO_GENERAL o INYECCION_CAJA"
    )
    monto: int = Field(gt=0)
    descripcion: str = Field(min_length=3, max_length=255)
    medio_pago: MetodoPago = MetodoPago.EFECTIVO


class TransaccionOut(BaseModel):
    id: int
    caja_chica_id: int
    tipo_transaccion: TipoTransaccion
    monto: int
    descripcion: str
    medio_pago: MetodoPago
    venta_id: Optional[int]
    fecha_hora: datetime


class CuadreOut(BaseModel):
    caja_id: int
    fecha: date
    estado: EstadoCaja
    monto_apertura: int
    ingresos_efectivo: int
    egresos_efectivo: int
    inyecciones_efectivo: int
    efectivo_teorico: int
    monto_cierre: Optional[int]
    diferencia: Optional[int]
    ventas_efectivo: int
    ventas_tarjeta: int
    ventas_transferencia: int
    ventas_credito: int = 0
    total_ventas: int
    cobros_credito: int = 0


class CajaOut(BaseModel):
    id: int
    numero: int
    negocio_id: int
    fecha: date
    nombre_vendedor: str
    monto_apertura: int
    monto_cierre: Optional[int]
    efectivo_teorico: Optional[int]
    diferencia: Optional[int]
    estado: EstadoCaja
    abierta_por_usuario_id: Optional[int]
    abierta_por_nombre: Optional[str] = None
    cerrada_por_usuario_id: Optional[int]
    cerrada_por_nombre: Optional[str] = None
    creado_en: datetime
    cerrada_en: Optional[datetime]
    siguiente_orden: int = 1
    cuadre: Optional[CuadreOut] = None
