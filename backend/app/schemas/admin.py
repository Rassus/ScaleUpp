from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import EstadoPagoPlataforma, RolMembresia


class AdminNegocioUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=150)
    comuna: Optional[str] = Field(default=None, min_length=2, max_length=120)
    activo: Optional[bool] = None


class AdminOwnerIn(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    nombre: str = Field(min_length=2, max_length=150)
    password: str = Field(
        min_length=64,
        max_length=64,
        pattern=r"^[a-f0-9]{64}$",
        description="SHA-256 hex de la contraseña (hasheada en el cliente)",
    )

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str) -> str:
        value = v.strip().lower()
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("email inválido")
        return value


class AdminOnboardIn(BaseModel):
    """Crea negocio + cuenta owner (+ catálogo base) en un solo paso."""

    nombre: str = Field(min_length=2, max_length=150)
    slug: str = Field(
        min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
    )
    comuna: str = Field(min_length=2, max_length=120)
    owner: AdminOwnerIn
    crear_cuota: bool = Field(
        default=True,
        description="Si true, crea cuota prorrateada desde hoy a fin de mes",
    )
    activo: bool = Field(
        default=True,
        description="False = pendiente de aprobación (alta pública)",
    )


class AdminCuentaIn(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    nombre: str = Field(min_length=2, max_length=150)
    password: str = Field(
        min_length=64,
        max_length=64,
        pattern=r"^[a-f0-9]{64}$",
        description="SHA-256 hex de la contraseña (hasheada en el cliente)",
    )
    rol: RolMembresia = RolMembresia.OWNER

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str) -> str:
        value = v.strip().lower()
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("email inválido")
        return value


class AdminUsuarioOut(BaseModel):
    id: int
    email: str
    nombre: str
    activo: bool
    rol: RolMembresia
    membresia_activa: bool


class AdminNegocioOut(BaseModel):
    id: int
    nombre: str
    slug: str
    comuna: Optional[str] = None
    activo: bool
    creado_en: datetime
    num_usuarios: int = 0
    pagos_pendientes: int = 0
    pagos_vencidos: int = 0
    ultimo_pago_estado: Optional[str] = None


class AdminOnboardOut(BaseModel):
    negocio: AdminNegocioOut
    owner_email: str
    owner_id: int


class AdminPagoCreate(BaseModel):
    negocio_id: int
    periodo_inicio: date
    periodo_fin: date
    estado: EstadoPagoPlataforma = EstadoPagoPlataforma.PENDIENTE
    nota: Optional[str] = Field(default=None, max_length=255)
    monto: Optional[int] = Field(
        default=None,
        ge=0,
        description="Si se omite, se prorratea con la cuota mensual de config",
    )
    prorratear: bool = Field(
        default=True,
        description="Calcular monto = cuota × días_usados / días_base",
    )

    @model_validator(mode="after")
    def fechas_ok(self) -> "AdminPagoCreate":
        if self.periodo_fin < self.periodo_inicio:
            raise ValueError("periodo_fin no puede ser anterior a periodo_inicio")
        return self


class AdminPagoUpdate(BaseModel):
    estado: Optional[EstadoPagoPlataforma] = None
    nota: Optional[str] = Field(default=None, max_length=255)
    monto: Optional[int] = Field(default=None, ge=0)


class AdminPagoOut(BaseModel):
    id: int
    negocio_id: int
    negocio_nombre: str
    negocio_activo: bool
    monto: int
    periodo_inicio: date
    periodo_fin: date
    estado: EstadoPagoPlataforma
    nota: Optional[str]
    pagado_en: Optional[datetime]
    creado_en: datetime
    monto_mensual_ref: Optional[int] = None
    dias_usados: Optional[int] = None
    dias_base: Optional[int] = None


class AdminRecaudacionMes(BaseModel):
    anio: int
    mes: int
    etiqueta: str
    monto_clp: int
    num_pagos: int


class AdminResumenOut(BaseModel):
    negocios_activos: int
    negocios_suspendidos: int
    pagos_pendientes: int
    pagos_vencidos: int
    pagos_pagados: int
    monto_pendiente_clp: int
    monto_recaudado_total_clp: int = 0
    monto_recaudado_mes_clp: int = 0
    recaudacion_por_mes: list[AdminRecaudacionMes] = []
    tickets_abiertos: int = 0
    resets_pendientes: int = 0


class AdminConfigOut(BaseModel):
    id: int
    nombre_plan: str
    cuota_mensual_clp: int
    cuota_negocio_extra_clp: int = 2990
    dias_gracia: int
    dia_facturacion: int
    activo: bool
    actualizado_en: datetime
    cuota_diaria_aprox: int


class AdminConfigUpdate(BaseModel):
    nombre_plan: Optional[str] = Field(default=None, min_length=2, max_length=120)
    cuota_mensual_clp: Optional[int] = Field(default=None, ge=0)
    cuota_negocio_extra_clp: Optional[int] = Field(default=None, ge=0)
    dias_gracia: Optional[int] = Field(default=None, ge=0, le=31)
    dia_facturacion: Optional[int] = Field(default=None, ge=1, le=28)
    activo: Optional[bool] = None


class AdminProrrateoIn(BaseModel):
    periodo_inicio: date
    periodo_fin: date
    cuota_mensual_clp: Optional[int] = Field(
        default=None,
        ge=0,
        description="Si se omite, usa la cuota de configuración",
    )

    @model_validator(mode="after")
    def fechas_ok(self) -> "AdminProrrateoIn":
        if self.periodo_fin < self.periodo_inicio:
            raise ValueError("periodo_fin no puede ser anterior a periodo_inicio")
        return self


class AdminProrrateoOut(BaseModel):
    periodo_inicio: date
    periodo_fin: date
    dias_usados: int
    dias_base: int
    cuota_mensual_clp: int
    cuota_diaria: float
    monto_prorrateado: int
    formula: str
