from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.models.enums import TipoPromo


class PromocionItemIn(BaseModel):
    producto_id: int
    tipo: TipoPromo
    valor: int = Field(ge=1)

    @model_validator(mode="after")
    def validar_valor(self) -> "PromocionItemIn":
        if self.tipo == TipoPromo.PORCENTAJE and self.valor > 80:
            raise ValueError("El descuento porcentual no puede superar 80%")
        return self


class PromocionCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    fecha_inicio: date
    fecha_fin: date
    activa: bool = True
    items: list[PromocionItemIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def fechas(self) -> "PromocionCreate":
        if self.fecha_fin < self.fecha_inicio:
            raise ValueError("fecha_fin no puede ser anterior a fecha_inicio")
        return self


class PromocionUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    activa: Optional[bool] = None
    items: Optional[list[PromocionItemIn]] = None


class PromocionItemOut(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    tipo: TipoPromo
    valor: int
    precio_lista: int
    costo_piso: Optional[int] = None
    precio_efectivo: int


class PromocionOut(BaseModel):
    id: int
    negocio_id: int
    nombre: str
    fecha_inicio: date
    fecha_fin: date
    activa: bool
    creado_en: datetime
    creado_por_usuario_id: Optional[int] = None
    items: list[PromocionItemOut] = []
    vigente: bool = False


class PrecioEfectivoOut(BaseModel):
    producto_id: int
    precio_lista: int
    costo_piso: Optional[int] = None
    promocion_id: Optional[int] = None
    promocion_nombre: Optional[str] = None
    tipo_promo: Optional[TipoPromo] = None
    valor_promo: Optional[int] = None
    precio_efectivo: int
    ahorro_unitario: int = 0
