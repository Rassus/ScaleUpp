from datetime import date, datetime
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import TipoPromo, utcnow


class Promocion(SQLModel, table=True):
    __tablename__ = "promociones"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    nombre: str = Field(max_length=150)
    fecha_inicio: date
    fecha_fin: date
    activa: bool = Field(default=True)
    creado_en: datetime = Field(default_factory=utcnow)
    creado_por_usuario_id: Optional[int] = Field(
        default=None, foreign_key="usuarios.id", index=True
    )


class PromocionItem(SQLModel, table=True):
    __tablename__ = "promocion_items"
    __table_args__ = (
        UniqueConstraint(
            "promocion_id",
            "producto_id",
            name="uq_promocion_items_promocion_producto",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    promocion_id: int = Field(foreign_key="promociones.id", index=True)
    producto_id: int = Field(foreign_key="productos.id", index=True)
    tipo: TipoPromo = Field(
        sa_column=Column(
            SAEnum(
                TipoPromo,
                name="tipopromo",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
        )
    )
    valor: int = Field(ge=1)  # CLP si FIJO; 1–80 si PORCENTAJE
