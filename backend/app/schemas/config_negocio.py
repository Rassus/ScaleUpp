from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ConfigNegocioOut(BaseModel):
    negocio_id: int
    alerta_stock_cantidad: Decimal
    alerta_stock_porcentaje: int
    dias_caducidad_alerta: int
    ingresos_visibles: int = 3
    actualizado_en: datetime


class ConfigNegocioUpdate(BaseModel):
    alerta_stock_cantidad: Decimal = Field(ge=0)
    alerta_stock_porcentaje: int = Field(ge=1, le=100)
    dias_caducidad_alerta: int = Field(ge=1, le=365)
    ingresos_visibles: int = Field(default=3, ge=1, le=50)
