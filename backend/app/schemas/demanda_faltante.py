from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class DemandaFaltanteItemIn(BaseModel):
    producto_id: int
    cantidad: Decimal = Field(gt=0)
    precio_ref: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def cantidad_ok(self) -> "DemandaFaltanteItemIn":
        self.cantidad = self.cantidad.quantize(Decimal("0.01"))
        return self


class DemandaFaltanteBatchIn(BaseModel):
    items: list[DemandaFaltanteItemIn] = Field(min_length=1)
    caja_chica_id: Optional[int] = None


class DemandaFaltanteOut(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    cantidad: Decimal
    precio_ref: int
    monto_ref: int
    creado_en: datetime


class DemandaFaltanteResumenProducto(BaseModel):
    producto_id: int
    producto_nombre: str
    veces: int
    cantidad_total: Decimal
    monto_ref_total: int
