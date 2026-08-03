from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class Usuario(SQLModel, table=True):
    __tablename__ = "usuarios"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True, max_length=255)
    nombre: str = Field(max_length=150)
    password_hash: str = Field(max_length=255)
    es_platform_admin: bool = Field(default=False)
    activo: bool = Field(default=True)
    creado_en: datetime = Field(default_factory=utcnow)
