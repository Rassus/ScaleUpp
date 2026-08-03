from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import MetodoPago, TipoCreditoMovimiento


class ClienteCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    telefono: Optional[str] = Field(default=None, max_length=40)
    rut: Optional[str] = Field(default=None, max_length=20)
    limite_credito: int = Field(default=0, ge=0)
    porcentaje_recargo: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    plazo_dias: int = Field(default=30, ge=0)


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    telefono: Optional[str] = Field(default=None, max_length=40)
    rut: Optional[str] = Field(default=None, max_length=20)
    limite_credito: Optional[int] = Field(default=None, ge=0)
    porcentaje_recargo: Optional[Decimal] = Field(default=None, ge=0, le=100)
    plazo_dias: Optional[int] = Field(default=None, ge=0)
    activo: Optional[bool] = None


class ClienteOut(BaseModel):
    id: int
    negocio_id: int
    nombre: str
    telefono: Optional[str]
    rut: Optional[str]
    limite_credito: int
    porcentaje_recargo: Decimal
    plazo_dias: int
    activo: bool
    creado_en: datetime
    deuda_actual: int = 0
    disponible: int = 0


class CreditoCargoOut(BaseModel):
    id: int
    venta_id: Optional[int]
    monto: int
    saldo: int
    fecha_vencimiento: Optional[date]
    descripcion: Optional[str]
    creado_en: datetime
    vencido: bool = False


class ClienteDeudaOut(BaseModel):
    cliente_id: int
    cliente_nombre: str
    limite_credito: int
    deuda_actual: int
    disponible: int
    porcentaje_recargo: Decimal
    plazo_dias: int
    cargos_abiertos: list[CreditoCargoOut]


class CobroCreditoIn(BaseModel):
    cliente_id: int
    monto: int = Field(gt=0)
    medio_pago: MetodoPago = MetodoPago.EFECTIVO


class CobroCreditoOut(BaseModel):
    id: int
    cliente_id: int
    monto: int
    medio_pago: MetodoPago
    deuda_restante: int
    transaccion_id: Optional[int]
    creado_en: datetime


class CreditoMovimientoOut(BaseModel):
    id: int
    cliente_id: int
    tipo: TipoCreditoMovimiento
    monto: int
    saldo: int
    venta_id: Optional[int]
    medio_pago: Optional[MetodoPago]
    fecha_vencimiento: Optional[date]
    descripcion: Optional[str]
    creado_en: datetime
