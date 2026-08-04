from decimal import Decimal

from sqlmodel import Session, col, select

from app.models.config_negocio import ConfigNegocio
from app.models.enums import EstadoPagoPlataforma, utcnow
from app.models.pago_plataforma import PagoPlataforma
from app.schemas.config_negocio import (
    ConfigNegocioOut,
    ConfigNegocioUpdate,
    PlanPagoItemOut,
    PlanResumenOut,
)


def _to_out(cfg: ConfigNegocio) -> ConfigNegocioOut:
    return ConfigNegocioOut(
        negocio_id=cfg.negocio_id,
        alerta_stock_cantidad=cfg.alerta_stock_cantidad,
        alerta_stock_porcentaje=cfg.alerta_stock_porcentaje,
        dias_caducidad_alerta=cfg.dias_caducidad_alerta,
        ingresos_visibles=getattr(cfg, "ingresos_visibles", 3) or 3,
        actualizado_en=cfg.actualizado_en,
    )


def get_or_create_config(session: Session, *, negocio_id: int) -> ConfigNegocio:
    cfg = session.get(ConfigNegocio, negocio_id)
    if cfg is None:
        cfg = ConfigNegocio(
            negocio_id=negocio_id,
            alerta_stock_cantidad=Decimal("5"),
            alerta_stock_porcentaje=15,
            dias_caducidad_alerta=30,
            ingresos_visibles=3,
        )
        session.add(cfg)
        session.commit()
        session.refresh(cfg)
    return cfg


def obtener_config(session: Session, *, negocio_id: int) -> ConfigNegocioOut:
    return _to_out(get_or_create_config(session, negocio_id=negocio_id))


def actualizar_config(
    session: Session, *, negocio_id: int, body: ConfigNegocioUpdate
) -> ConfigNegocioOut:
    cfg = get_or_create_config(session, negocio_id=negocio_id)
    cfg.alerta_stock_cantidad = body.alerta_stock_cantidad.quantize(Decimal("0.01"))
    cfg.alerta_stock_porcentaje = body.alerta_stock_porcentaje
    cfg.dias_caducidad_alerta = body.dias_caducidad_alerta
    cfg.ingresos_visibles = body.ingresos_visibles
    cfg.actualizado_en = utcnow()
    session.add(cfg)
    session.commit()
    session.refresh(cfg)
    return _to_out(cfg)


def resumen_plan(session: Session, *, negocio_id: int) -> PlanResumenOut:
    """Historial de cuotas ScaleUpp visible para el negocio."""
    rows = session.exec(
        select(PagoPlataforma)
        .where(PagoPlataforma.negocio_id == negocio_id)
        .order_by(col(PagoPlataforma.periodo_fin).desc(), col(PagoPlataforma.id).desc())
    ).all()

    pagados = [p for p in rows if p.estado == EstadoPagoPlataforma.PAGADO]
    pendientes = [
        p
        for p in rows
        if p.estado
        in (EstadoPagoPlataforma.PENDIENTE, EstadoPagoPlataforma.VENCIDO)
    ]

    return PlanResumenOut(
        meses_pagados=len(pagados),
        total_pagado_clp=sum(p.monto for p in pagados),
        pagos_pendientes=len(pendientes),
        monto_pendiente_clp=sum(p.monto for p in pendientes),
        pagos=[
            PlanPagoItemOut(
                id=p.id,  # type: ignore[arg-type]
                monto=p.monto,
                periodo_inicio=p.periodo_inicio,
                periodo_fin=p.periodo_fin,
                estado=p.estado,
                pagado_en=p.pagado_en,
                nota=p.nota,
                monto_mensual_ref=p.monto_mensual_ref,
            )
            for p in rows
            if p.estado != EstadoPagoPlataforma.ANULADO
        ],
    )
