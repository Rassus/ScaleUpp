from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NegocioCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    comuna: str = Field(min_length=2, max_length=120)


class NegocioOut(BaseModel):
    id: int
    nombre: str
    slug: str
    comuna: str | None = None
    activo: bool
    creado_en: datetime


class NegocioPerfilOut(BaseModel):
    id: int
    nombre: str
    slug: str
    comuna: Optional[str] = None
    activo: bool


class NegocioPerfilUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=150)
    comuna: Optional[str] = Field(default=None, min_length=2, max_length=120)