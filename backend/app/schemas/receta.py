from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class RecetaItemIn(BaseModel):
    producto_componente_id: int
    cantidad: Decimal = Field(gt=0)

    @field_validator("cantidad")
    @classmethod
    def redondear(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))


class RecetaReplaceIn(BaseModel):
    componentes: list[RecetaItemIn] = Field(min_length=1)


class RecetaItemOut(BaseModel):
    id: int
    producto_componente_id: int
    componente_nombre: str
    componente_codigo_barras: Optional[str]
    cantidad: Decimal


class RecetaOut(BaseModel):
    producto_kit_id: int
    kit_nombre: str
    componentes: list[RecetaItemOut]


class ExpansionItemOut(BaseModel):
    producto_id: int
    nombre: str
    codigo_barras: Optional[str]
    cantidad: Decimal


class ExpansionOut(BaseModel):
    producto_kit_id: int
    kit_nombre: str
    cantidad_kits: Decimal
    componentes: list[ExpansionItemOut]
