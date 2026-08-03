from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import TipoAviso, utcnow


class AvisoEnviado(SQLModel, table=True):
    """Dedupe: 1 aviso por mes (periodo_ym) / negocio / tipo / clave."""

    __tablename__ = "avisos_enviados"
    __table_args__ = (
        UniqueConstraint(
            "negocio_id",
            "tipo",
            "clave",
            "periodo_ym",
            name="uq_aviso_negocio_tipo_clave_mes",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    tipo: TipoAviso = Field(
        sa_column=Column(
            SAEnum(
                TipoAviso,
                name="tipoaviso",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
            index=True,
        )
    )
    clave: str = Field(
        max_length=64,
        description="producto_id o pago_id como string",
    )
    periodo_ym: str = Field(max_length=7, description="YYYY-MM")
    titulo: str = Field(max_length=180)
    cuerpo: str = Field(max_length=500)
    enviado_en: datetime = Field(default_factory=utcnow)
