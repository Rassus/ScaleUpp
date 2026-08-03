from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.enums import utcnow


class HistorialPrecioProducto(SQLModel, table=True):
    """Cada cambio de precio_venta de un producto."""

    __tablename__ = "historial_precios_producto"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    producto_id: int = Field(foreign_key="productos.id", index=True)
    precio_anterior: int = Field(ge=0)
    precio_nuevo: int = Field(ge=0)
    usuario_id: Optional[int] = Field(
        default=None, foreign_key="usuarios.id", index=True
    )
    fecha_hora: datetime = Field(default_factory=utcnow, index=True)
