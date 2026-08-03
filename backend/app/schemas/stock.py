from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class EntradaCompraIn(BaseModel):
    producto_id: int
    cantidad: Decimal = Field(gt=0)
    precio_costo_neto: int = Field(ge=0)
    iva_porcentaje: Decimal = Field(default=Decimal("19.00"), ge=0, le=100)
    costo_operacion_total: int = Field(
        default=0,
        ge=0,
        description="Costo operativo total del ingreso (bencina, flete); se prorratea por unidad",
    )
    fecha_caducidad: Optional[date] = None
    motivo: Optional[str] = Field(default="Entrada por compra", max_length=255)

    @model_validator(mode="after")
    def cantidad_ok(self) -> "EntradaCompraIn":
        self.cantidad = self.cantidad.quantize(Decimal("0.01"))
        return self


class SalidaStockIn(BaseModel):
    producto_id: int
    cantidad: Decimal = Field(gt=0)
    motivo: Optional[str] = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def cantidad_ok(self) -> "SalidaStockIn":
        self.cantidad = self.cantidad.quantize(Decimal("0.01"))
        return self


class AjusteStockIn(BaseModel):
    producto_id: int
    cantidad: Decimal = Field(
        description="Positivo = entra stock (nuevo lote); negativo = sale FIFO"
    )
    motivo: str = Field(min_length=3, max_length=255)
    precio_costo_neto: int = Field(
        default=0,
        ge=0,
        description="Solo para ajuste positivo (costo del lote virtual)",
    )

    @model_validator(mode="after")
    def cantidad_ok(self) -> "AjusteStockIn":
        if self.cantidad == 0:
            raise ValueError("cantidad no puede ser 0")
        self.cantidad = self.cantidad.quantize(Decimal("0.01"))
        return self


class LoteOut(BaseModel):
    id: int
    negocio_id: int
    producto_id: int
    cantidad_inicial: Decimal
    cantidad_actual: Decimal
    cantidad_vendida: Decimal = Decimal("0")
    cantidad_merma: Decimal = Decimal("0")
    precio_costo_neto: int
    iva_porcentaje: Decimal
    costo_operacion_prorrateado: int
    costo_unitario_real: int
    fecha_ingreso: datetime
    fecha_caducidad: Optional[date]
    activo: bool


class ConsumoLoteOut(BaseModel):
    lote_id: int
    cantidad: Decimal
    precio_costo_neto: int
    costo_operacion_prorrateado: int
    costo_unitario_real: int


class MovimientoOut(BaseModel):
    id: int
    producto_id: int
    lote_id: int
    tipo_movimiento: str
    cantidad: Decimal
    costo_unitario_aplicado: int
    motivo: Optional[str]
    fecha_hora: datetime


class StockProductoOut(BaseModel):
    producto_id: int
    producto_nombre: str
    codigo_barras: Optional[str]
    stock_actual: Decimal
    stock_ideal: Optional[Decimal]
    stock_minimo: Optional[Decimal]
    porcentaje_emergencia: int
    porcentaje_sobrestock: int
    alerta_bajo_stock: bool
    alerta_sobrestock: bool
    lotes_abiertos: int


class EntradaCompraOut(BaseModel):
    lote: LoteOut
    movimiento: MovimientoOut


class SalidaStockOut(BaseModel):
    producto_id: int
    cantidad_solicitada: Decimal
    consumos: list[ConsumoLoteOut]
    costo_total: int
    movimientos: list[MovimientoOut]
