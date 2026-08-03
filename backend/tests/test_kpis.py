"""Smoke test KPIs."""

from sqlmodel import Session, select

from app.db import engine
from app.models import Negocio
from app.services.kpi import obtener_kpis


def test_kpis_shape():
    with Session(engine) as session:
        negocio = session.exec(select(Negocio).where(Negocio.slug == "demo")).first()
        assert negocio is not None
        kpis = obtener_kpis(session, negocio_id=negocio.id)  # type: ignore[arg-type]
        assert kpis.venta_diaria >= 0
        assert kpis.venta_mensual >= 0
        assert kpis.ganancia_mensual == kpis.ganancia_mensual
        assert isinstance(kpis.productos_estrella, list)
        assert isinstance(kpis.productos_impopulares, list)
        assert isinstance(kpis.productos_por_vencer, list)
        assert isinstance(kpis.productos_bajo_stock, list)
        assert isinstance(kpis.productos_sobre_stock, list)
