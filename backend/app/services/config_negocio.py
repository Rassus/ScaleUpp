from decimal import Decimal

from sqlmodel import Session

from app.models.config_negocio import ConfigNegocio
from app.models.enums import utcnow
from app.schemas.config_negocio import ConfigNegocioOut, ConfigNegocioUpdate


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
