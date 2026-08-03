from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import TipoAviso


class AvisoPendienteOut(BaseModel):
    tipo: TipoAviso
    clave: str
    titulo: str
    cuerpo: str
    periodo_ym: str
    producto_id: Optional[int] = None
    pago_id: Optional[int] = None


class AvisoAckItem(BaseModel):
    tipo: TipoAviso
    clave: str
    titulo: str = Field(max_length=180)
    cuerpo: str = Field(max_length=500)


class AvisoAckIn(BaseModel):
    avisos: list[AvisoAckItem] = Field(min_length=1)


class AvisoAckOut(BaseModel):
    marcados: int
