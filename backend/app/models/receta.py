from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Numeric, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class RecetaComponente(SQLModel, table=True):
    """BOM virtual: un KIT consume componentes SIMPLE (Opción A)."""

    __tablename__ = "receta_componentes"
    __table_args__ = (
        UniqueConstraint(
            "producto_kit_id",
            "producto_componente_id",
            name="uq_receta_kit_componente",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    producto_kit_id: int = Field(foreign_key="productos.id", index=True)
    producto_componente_id: int = Field(foreign_key="productos.id", index=True)
    cantidad: Decimal = Field(
        sa_column=Column(Numeric(12, 2), nullable=False),
    )
    creado_en: datetime = Field(default_factory=utcnow)
