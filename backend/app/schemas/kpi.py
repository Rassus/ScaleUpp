from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class ProductoRankingOut(BaseModel):
    producto_id: int
    nombre: str
    codigo_barras: Optional[str] = None
    cantidad_vendida: Decimal
    total_venta: int
    num_lineas: int


class ProductoPorVencerOut(BaseModel):
    producto_id: int
    nombre: str
    lote_id: int
    cantidad_actual: Decimal
    fecha_caducidad: date
    dias_restantes: int


class ProductoStockAlertaOut(BaseModel):
    producto_id: int
    nombre: str
    stock_actual: Decimal
    stock_ideal: Optional[Decimal] = None
    stock_minimo: Optional[Decimal] = None
    tipo_alerta: str  # bajo | sobre


class KpisOut(BaseModel):
    fecha_referencia: date
    # 1-2 ventas
    venta_diaria: int
    venta_mensual: int
    venta_anual: int = 0
    # 6-7 ganancias
    ganancia_diaria: int
    ganancia_mensual: int
    ganancia_anual: int = 0
    num_ventas_dia: int
    num_ventas_mes: int
    num_ventas_anio: int = 0
    gastos_anuales: int = 0
    merma_anual: int = 0
    # 3 por vencer
    productos_por_vencer: list[ProductoPorVencerOut] = Field(default_factory=list)
    # 4-5 ranking (SKU escaneado = venta_items)
    productos_estrella: list[ProductoRankingOut] = Field(default_factory=list)
    productos_impopulares: list[ProductoRankingOut] = Field(default_factory=list)
    # 8-9 stock
    productos_bajo_stock: list[ProductoStockAlertaOut] = Field(default_factory=list)
    productos_sobre_stock: list[ProductoStockAlertaOut] = Field(default_factory=list)
