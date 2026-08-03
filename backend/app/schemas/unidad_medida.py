from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UnidadMedidaCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    sigla: str = Field(min_length=1, max_length=10)


class UnidadMedidaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=50)
    sigla: Optional[str] = Field(default=None, min_length=1, max_length=10)
    activo: Optional[bool] = None


class UnidadMedidaOut(BaseModel):
    id: int
    negocio_id: int
    nombre: str
    sigla: str
    activo: bool
    creado_en: datetime
