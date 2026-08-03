from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.models.enums import TipoProducto


class ProductoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    codigo_barras: Optional[str] = Field(default=None, max_length=100)
    categoria_id: Optional[int] = None
    unidad_medida_id: int
    tipo: TipoProducto = TipoProducto.SIMPLE
    precio_venta: int = Field(ge=0)
    controla_caducidad: bool = False
    porcentaje_emergencia: int = Field(default=15, ge=0, le=100)
    porcentaje_sobrestock: int = Field(default=150, ge=0)
    stock_ideal: Optional[Decimal] = Field(default=None, ge=0)
    stock_minimo: Optional[Decimal] = Field(default=None, ge=0)
    imagen_base64: Optional[str] = Field(
        default=None,
        description="Data URL (data:image/...;base64,...)",
        max_length=2_500_000,
    )

    @model_validator(mode="after")
    def validar_stocks(self) -> "ProductoCreate":
        if (
            self.stock_ideal is not None
            and self.stock_minimo is not None
            and self.stock_minimo > self.stock_ideal
        ):
            raise ValueError("stock_minimo no puede ser mayor que stock_ideal")
        return self


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    codigo_barras: Optional[str] = Field(default=None, max_length=100)
    categoria_id: Optional[int] = None
    unidad_medida_id: Optional[int] = None
    tipo: Optional[TipoProducto] = None
    precio_venta: Optional[int] = Field(default=None, ge=0)
    controla_caducidad: Optional[bool] = None
    porcentaje_emergencia: Optional[int] = Field(default=None, ge=0, le=100)
    porcentaje_sobrestock: Optional[int] = Field(default=None, ge=0)
    stock_ideal: Optional[Decimal] = Field(default=None, ge=0)
    stock_minimo: Optional[Decimal] = Field(default=None, ge=0)
    imagen_base64: Optional[str] = Field(
        default=None,
        max_length=2_500_000,
    )
    activo: Optional[bool] = None


class ProductoOut(BaseModel):
    id: int
    negocio_id: int
    codigo_barras: Optional[str]
    nombre: str
    categoria_id: Optional[int]
    unidad_medida_id: int
    tipo: TipoProducto
    precio_venta: int
    controla_caducidad: bool
    porcentaje_emergencia: int
    porcentaje_sobrestock: int
    stock_ideal: Optional[Decimal]
    stock_minimo: Optional[Decimal]
    imagen_base64: Optional[str] = None
    activo: bool
    creado_en: datetime


class HistorialPrecioOut(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    precio_anterior: int
    precio_nuevo: int
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None
    fecha_hora: datetime
