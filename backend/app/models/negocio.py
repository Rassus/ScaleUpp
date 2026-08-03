from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class Negocio(SQLModel, table=True):
    __tablename__ = "negocios"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=150)
    slug: str = Field(index=True, unique=True, max_length=80)
    activo: bool = Field(default=True)
    creado_en: datetime = Field(default_factory=utcnow)
