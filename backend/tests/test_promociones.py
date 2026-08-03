"""Tests de promociones: costo piso máximo y precio efectivo en cobro."""

from datetime import date, timedelta
from decimal import Decimal

from sqlmodel import Session, select

from app.db import engine
from app.models import Negocio, Producto, Promocion, PromocionItem, UnidadMedida
from app.models.enums import MetodoPago, TipoProducto, TipoPromo
from app.schemas.venta import VentaCreate, VentaItemIn
from app.services.caja import abrir_caja, get_caja_abierta
from app.services.promocion import (
    calcular_precio_efectivo_item,
    costo_piso_producto,
    minimo_precio_permitido,
)
from app.services.stock import registrar_entrada_compra, stock_actual_producto
from app.services.venta import registrar_venta


def test_calculo_efectivo_y_minimo():
    assert (
        calcular_precio_efectivo_item(
            precio_lista=1000, tipo=TipoPromo.PORCENTAJE, valor=20
        )
        == 800
    )
    assert (
        calcular_precio_efectivo_item(
            precio_lista=1000, tipo=TipoPromo.FIJO, valor=750
        )
        == 750
    )
    assert minimo_precio_permitido(1000, 300) == 300
    assert minimo_precio_permitido(1000, 100) == 200


def test_costo_piso_maximo_y_venta_con_promo():
    with Session(engine) as session:
        negocio = session.exec(select(Negocio).where(Negocio.slug == "demo")).first()
        assert negocio is not None
        und = session.exec(
            select(UnidadMedida).where(
                UnidadMedida.negocio_id == negocio.id, UnidadMedida.sigla == "UND"
            )
        ).first()
        assert und is not None

        if get_caja_abierta(session, negocio_id=negocio.id) is None:  # type: ignore[arg-type]
            abrir_caja(
                session,
                negocio_id=negocio.id,  # type: ignore[arg-type]
                usuario_id=None,
                monto_apertura=50000,
                nombre_vendedor="Test Promo",
                fecha=date.today() + timedelta(days=40),
                commit=True,
            )

        code = "TEST-PROMO-A"
        p = session.exec(select(Producto).where(Producto.codigo_barras == code)).first()
        if p is None:
            p = Producto(
                negocio_id=negocio.id,  # type: ignore[arg-type]
                nombre="Promo test A",
                codigo_barras=code,
                unidad_medida_id=und.id,  # type: ignore[arg-type]
                precio_venta=1000,
                tipo=TipoProducto.SIMPLE,
            )
            session.add(p)
            session.commit()
            session.refresh(p)
        else:
            p.precio_venta = 1000
            session.add(p)
            session.commit()
            session.refresh(p)

        actual = stock_actual_producto(
            session,
            negocio_id=negocio.id,  # type: ignore[arg-type]
            producto_id=p.id,  # type: ignore[arg-type]
        )
        if actual < Decimal("5"):
            registrar_entrada_compra(
                session,
                negocio_id=negocio.id,  # type: ignore[arg-type]
                producto_id=p.id,  # type: ignore[arg-type]
                cantidad=Decimal("10"),
                precio_costo_neto=200,
                iva_porcentaje=Decimal("19"),
                commit=True,
            )
            registrar_entrada_compra(
                session,
                negocio_id=negocio.id,  # type: ignore[arg-type]
                producto_id=p.id,  # type: ignore[arg-type]
                cantidad=Decimal("5"),
                precio_costo_neto=400,
                iva_porcentaje=Decimal("19"),
                commit=True,
            )

        session.refresh(p)
        piso = costo_piso_producto(session, p)
        assert piso is not None
        assert piso >= 400  # mayor costo entre lotes

        hoy = date.today()
        promo = Promocion(
            negocio_id=negocio.id,  # type: ignore[arg-type]
            nombre="Promo test 10%",
            fecha_inicio=hoy - timedelta(days=1),
            fecha_fin=hoy + timedelta(days=10),
            activa=True,
        )
        session.add(promo)
        session.flush()
        session.add(
            PromocionItem(
                promocion_id=promo.id,  # type: ignore[arg-type]
                producto_id=p.id,  # type: ignore[arg-type]
                tipo=TipoPromo.PORCENTAJE,
                valor=10,
            )
        )
        session.commit()

        venta = registrar_venta(
            session,
            negocio_id=negocio.id,  # type: ignore[arg-type]
            usuario_id=None,
            data=VentaCreate(
                metodo_pago=MetodoPago.EFECTIVO,
                items=[VentaItemIn(producto_id=p.id, cantidad=Decimal("1"))],  # type: ignore[arg-type]
            ),
        )
        assert venta.items[0].precio_unitario == 900
        assert venta.monto_descuento_promo == 100
        assert venta.total_venta == 900
