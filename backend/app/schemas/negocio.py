from datetime import datetime

from pydantic import BaseModel, Field


class NegocioCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class NegocioOut(BaseModel):
    id: int
    nombre: str
    slug: str
    activo: bool
    creado_en: datetime
