from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.models.enums import MetodoPago


class VentaItemIn(BaseModel):
    producto_id: int
    cantidad: Decimal = Field(gt=0)
    precio_unitario: Optional[int] = Field(
        default=None,
        ge=0,
        description="Si se omite, usa precio_venta del producto",
    )

    @model_validator(mode="after")
    def qty(self) -> "VentaItemIn":
        self.cantidad = self.cantidad.quantize(Decimal("0.01"))
        return self


class VentaCreate(BaseModel):
    metodo_pago: MetodoPago
    items: list[VentaItemIn] = Field(min_length=1)
    iva_porcentaje: Decimal = Field(default=Decimal("19.00"), ge=0, le=100)
    cliente_id: Optional[int] = Field(
        default=None,
        description="Obligatorio si metodo_pago es CREDITO",
    )

    @model_validator(mode="after")
    def credito_requiere_cliente(self) -> "VentaCreate":
        if self.metodo_pago == MetodoPago.CREDITO and self.cliente_id is None:
            raise ValueError("cliente_id es obligatorio para ventas a crédito")
        if self.metodo_pago != MetodoPago.CREDITO and self.cliente_id is not None:
            # Permitir asociar cliente opcionalmente en el futuro; v1 solo crédito
            pass
        return self


class DetalleVentaOut(BaseModel):
    id: int
    venta_item_id: int
    producto_vendido_id: int
    producto_id: int
    lote_id: int
    cantidad: Decimal
    precio_unitario_venta: int
    costo_unitario: int


class VentaItemOut(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    cantidad: Decimal
    precio_unitario: int
    subtotal: int


class VentaOut(BaseModel):
    id: int
    numero: int
    negocio_id: int
    caja_chica_id: Optional[int] = None
    usuario_id: Optional[int]
    cliente_id: Optional[int] = None
    fecha_hora: datetime
    metodo_pago: MetodoPago
    total_venta: int
    total_neto: int
    total_iva: int
    monto_recargo: int = 0
    porcentaje_recargo: Decimal = Decimal("0.00")
    monto_descuento_promo: int = 0
    costo_total: int
    ganancia: int
    anulada: bool
    items: list[VentaItemOut] = []
    detalles: list[DetalleVentaOut] = []
