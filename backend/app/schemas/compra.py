from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class CompraItemIn(BaseModel):
    producto_id: int
    cantidad: Decimal = Field(gt=0)
    precio_costo_neto: int = Field(ge=0)
    iva_porcentaje: Decimal = Field(default=Decimal("19.00"), ge=0, le=100)
    fecha_caducidad: Optional[date] = None

    @model_validator(mode="after")
    def cantidad_ok(self) -> "CompraItemIn":
        self.cantidad = self.cantidad.quantize(Decimal("0.01"))
        return self


class CompraCreateIn(BaseModel):
    nota: Optional[str] = Field(default=None, max_length=255)
    costo_operacion_total: int = Field(default=0, ge=0)
    fecha: Optional[date] = None
    items: list[CompraItemIn] = Field(min_length=1)

    @model_validator(mode="after")
    def items_ok(self) -> "CompraCreateIn":
        if not self.items:
            raise ValueError("Debe incluir al menos un ítem")
        return self


class CompraItemOut(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    cantidad: Decimal
    precio_costo_neto: int
    iva_porcentaje: Decimal
    fecha_caducidad: Optional[date]
    monto_linea: int
    lote_stock_id: Optional[int]


class CompraOut(BaseModel):
    id: int
    numero: int
    negocio_id: int
    usuario_id: Optional[int]
    fecha: date
    nota: Optional[str]
    costo_operacion_total: int
    monto_total: int
    creado_en: datetime
    items: list[CompraItemOut]


class CompraListItemOut(BaseModel):
    id: int
    numero: int
    fecha: date
    nota: Optional[str]
    costo_operacion_total: int
    monto_total: int
    num_items: int
    creado_en: datetime


class MovimientoNegocioOut(BaseModel):
    id: int
    tipo: str
    monto: int
    descripcion: str
    compra_id: Optional[int]
    fecha_hora: datetime


class InversionMesOut(BaseModel):
    mes: str
    total: int


class InversionResumenOut(BaseModel):
    total_periodo: int
    por_mes: list[InversionMesOut]
    movimientos: list[MovimientoNegocioOut]
