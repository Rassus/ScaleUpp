from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import EstadoPagoPlataforma


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


class PlanPagoItemOut(BaseModel):
    id: int
    monto: int
    periodo_inicio: date
    periodo_fin: date
    estado: EstadoPagoPlataforma
    pagado_en: Optional[datetime] = None
    nota: Optional[str] = None
    monto_mensual_ref: Optional[int] = None


class PlanResumenOut(BaseModel):
    meses_pagados: int
    total_pagado_clp: int
    pagos_pendientes: int
    monto_pendiente_clp: int
    pagos: list[PlanPagoItemOut] = []
