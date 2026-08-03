"""Tests del motor FIFO (requiere Postgres de docker-compose)."""

from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlmodel import Session, select

from app.db import engine
from app.models import LoteStock, Producto
from app.models.enums import TipoMovimiento
from app.services.stock import (
    registrar_entrada_compra,
    registrar_salida_fifo,
    stock_actual_producto,
)


@pytest.fixture
def session():
    with Session(engine) as s:
        yield s
        s.rollback()


@pytest.fixture
def bebida(session: Session) -> Producto:
    producto = session.exec(
        select(Producto).where(Producto.codigo_barras == "7801234567890")
    ).first()
    assert producto is not None, "Ejecuta el seed antes de los tests"
    return producto


def test_fifo_consume_lote_mas_viejo(session: Session, bebida: Producto):
    # Aislar: usar solo lotes creados en este test midiendo delta
    before = stock_actual_producto(
        session, negocio_id=bebida.negocio_id, producto_id=bebida.id  # type: ignore[arg-type]
    )

    registrar_entrada_compra(
        session,
        negocio_id=bebida.negocio_id,
        producto_id=bebida.id,  # type: ignore[arg-type]
        cantidad=Decimal("10"),
        precio_costo_neto=100,
        iva_porcentaje=Decimal("19"),
        costo_operacion_total=0,
        motivo="test lote A",
        commit=True,
    )
    registrar_entrada_compra(
        session,
        negocio_id=bebida.negocio_id,
        producto_id=bebida.id,  # type: ignore[arg-type]
        cantidad=Decimal("20"),
        precio_costo_neto=200,
        iva_porcentaje=Decimal("19"),
        motivo="test lote B",
        commit=True,
    )

    salida = registrar_salida_fifo(
        session,
        negocio_id=bebida.negocio_id,
        producto_id=bebida.id,  # type: ignore[arg-type]
        cantidad=Decimal("15"),
        tipo=TipoMovimiento.SALIDA_VENTA,
        motivo="test venta",
        commit=True,
    )

    assert len(salida.consumos) >= 1
    # Los primeros 10 deben salir del lote A (costo 100) si era el más viejo
    # entre los recién creados; como hay stock previo del seed, validamos totales.
    after = stock_actual_producto(
        session, negocio_id=bebida.negocio_id, producto_id=bebida.id  # type: ignore[arg-type]
    )
    assert after == before + Decimal("30") - Decimal("15")
    assert salida.cantidad_solicitada == Decimal("15")
    assert sum((c.cantidad for c in salida.consumos), Decimal("0")) == Decimal("15")


def test_fifo_parcial_dos_lotes_limpios(session: Session):
    """Crea producto temporal vía SQL no — usa bebida y verifica orden por fecha."""
    from datetime import datetime, timedelta

    from app.models import Negocio

    negocio = session.exec(select(Negocio).where(Negocio.slug == "demo")).first()
    assert negocio is not None

    # Producto de prueba aislado
    from app.models import UnidadMedida

    und = session.exec(
        select(UnidadMedida).where(
            UnidadMedida.negocio_id == negocio.id, UnidadMedida.sigla == "UND"
        )
    ).first()
    assert und is not None

    prod = Producto(
        negocio_id=negocio.id,  # type: ignore[arg-type]
        nombre="FIFO Test Product",
        codigo_barras="TEST-FIFO-001",
        unidad_medida_id=und.id,  # type: ignore[arg-type]
        precio_venta=1000,
    )
    # limpiar si existe
    old = session.exec(
        select(Producto).where(Producto.codigo_barras == "TEST-FIFO-001")
    ).first()
    if old:
        # No borrar lotes con historial: reutilizar producto
        prod = old
    else:
        session.add(prod)
        session.commit()
        session.refresh(prod)

    # Asegurar stock limpio sumando entradas nuevas (no borrar historial)
    # Reset cantidad_actual de lotes abiertos a 0 sin borrar filas
    for lote in session.exec(
        select(LoteStock).where(LoteStock.producto_id == prod.id)
    ).all():
        lote.cantidad_actual = Decimal("0")
        session.add(lote)
    session.commit()

    e1 = registrar_entrada_compra(
        session,
        negocio_id=negocio.id,  # type: ignore[arg-type]
        producto_id=prod.id,  # type: ignore[arg-type]
        cantidad=Decimal("10"),
        precio_costo_neto=100,
        iva_porcentaje=Decimal("19"),
        commit=True,
    )
    e2 = registrar_entrada_compra(
        session,
        negocio_id=negocio.id,  # type: ignore[arg-type]
        producto_id=prod.id,  # type: ignore[arg-type]
        cantidad=Decimal("20"),
        precio_costo_neto=200,
        iva_porcentaje=Decimal("19"),
        commit=True,
    )

    # Forzar orden FIFO por fecha
    lote1 = session.get(LoteStock, e1.lote.id)
    lote2 = session.get(LoteStock, e2.lote.id)
    assert lote1 and lote2
    lote1.fecha_ingreso = datetime.utcnow() - timedelta(days=2)
    lote2.fecha_ingreso = datetime.utcnow() - timedelta(days=1)
    session.add(lote1)
    session.add(lote2)
    session.commit()

    salida = registrar_salida_fifo(
        session,
        negocio_id=negocio.id,  # type: ignore[arg-type]
        producto_id=prod.id,  # type: ignore[arg-type]
        cantidad=Decimal("15"),
        tipo=TipoMovimiento.SALIDA_VENTA,
        commit=True,
    )

    assert len(salida.consumos) == 2
    assert salida.consumos[0].lote_id == e1.lote.id
    assert salida.consumos[0].cantidad == Decimal("10.00")
    assert salida.consumos[0].costo_unitario_real == 100
    assert salida.consumos[1].lote_id == e2.lote.id
    assert salida.consumos[1].cantidad == Decimal("5.00")
    assert salida.consumos[1].costo_unitario_real == 200
    assert salida.costo_total == 100 * 10 + 200 * 5

    lote1 = session.get(LoteStock, e1.lote.id)
    lote2 = session.get(LoteStock, e2.lote.id)
    assert lote1 and lote1.cantidad_actual == Decimal("0.00")
    assert lote2 and lote2.cantidad_actual == Decimal("15.00")


def test_stock_insuficiente(session: Session):
    from app.models import Negocio, UnidadMedida

    negocio = session.exec(select(Negocio).where(Negocio.slug == "demo")).first()
    und = session.exec(
        select(UnidadMedida).where(
            UnidadMedida.negocio_id == negocio.id, UnidadMedida.sigla == "UND"
        )
    ).first()
    prod = session.exec(
        select(Producto).where(Producto.codigo_barras == "TEST-FIFO-002")
    ).first()
    if prod is None:
        prod = Producto(
            negocio_id=negocio.id,  # type: ignore[arg-type]
            nombre="FIFO Insufficient",
            codigo_barras="TEST-FIFO-002",
            unidad_medida_id=und.id,  # type: ignore[arg-type]
            precio_venta=500,
        )
        session.add(prod)
        session.commit()
        session.refresh(prod)

    # reset stock
    for lote in session.exec(
        select(LoteStock).where(LoteStock.producto_id == prod.id)
    ).all():
        lote.cantidad_actual = Decimal("0")
        session.add(lote)
    session.commit()

    registrar_entrada_compra(
        session,
        negocio_id=negocio.id,  # type: ignore[arg-type]
        producto_id=prod.id,  # type: ignore[arg-type]
        cantidad=Decimal("5"),
        precio_costo_neto=50,
        iva_porcentaje=Decimal("19"),
        commit=True,
    )

    with pytest.raises(HTTPException) as exc:
        registrar_salida_fifo(
            session,
            negocio_id=negocio.id,  # type: ignore[arg-type]
            producto_id=prod.id,  # type: ignore[arg-type]
            cantidad=Decimal("6"),
            commit=True,
        )
    assert exc.value.status_code == 409
