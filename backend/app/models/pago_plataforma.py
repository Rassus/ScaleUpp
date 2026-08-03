from datetime import date, datetime
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum
from sqlmodel import Field, SQLModel

from app.models.enums import EstadoPagoPlataforma, utcnow


class PagoPlataforma(SQLModel, table=True):
    """Cobros de ScaleUpp a un negocio (suscripción / cuota)."""

    __tablename__ = "pagos_plataforma"

    id: Optional[int] = Field(default=None, primary_key=True)
    negocio_id: int = Field(foreign_key="negocios.id", index=True)
    monto: int = Field(ge=0, description="Monto en CLP")
    periodo_inicio: date
    periodo_fin: date
    estado: EstadoPagoPlataforma = Field(
        default=EstadoPagoPlataforma.PENDIENTE,
        sa_column=Column(
            SAEnum(
                EstadoPagoPlataforma,
                name="estadopagoplataforma",
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=False,
        ),
    )
    nota: Optional[str] = Field(default=None, max_length=255)
    pagado_en: Optional[datetime] = Field(default=None)
    creado_en: datetime = Field(default_factory=utcnow)
    # Prorrateo (auditoría)
    monto_mensual_ref: Optional[int] = Field(
        default=None, description="Cuota mensual usada como base"
    )
    dias_usados: Optional[int] = Field(default=None)
    dias_base: Optional[int] = Field(
        default=None, description="Días del mes / base del prorrateo"
    )
