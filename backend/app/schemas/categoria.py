from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CategoriaCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    acceso_rapido: bool = False


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    acceso_rapido: Optional[bool] = None
    activo: Optional[bool] = None


class CategoriaOut(BaseModel):
    id: int
    negocio_id: int
    nombre: str
    descripcion: Optional[str]
    acceso_rapido: bool
    activo: bool
    creado_en: datetime
