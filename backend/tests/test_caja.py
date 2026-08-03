"""Tests de caja chica y cuadre."""

from datetime import date, timedelta
from decimal import Decimal

from sqlmodel import Session, select

from app.db import engine
from app.models import Negocio, Producto, UnidadMedida
from app.models.enums import MetodoPago, TipoTransaccion
from app.schemas.venta import VentaCreate, VentaItemIn
from app.services.caja import (
    abrir_caja,
    calcular_cuadre,
    cerrar_caja,
    get_caja_abierta,
    registrar_transaccion,
)
from app.services.stock import registrar_entrada_compra, stock_actual_producto
from app.services.venta import registrar_venta


def test_cuadre_efectivo_vs_tarjeta():
    with Session(engine) as session:
        negocio = session.exec(select(Negocio).where(Negocio.slug == "demo")).first()
        assert negocio is not None

        # Cerrar caja abierta previa si existe (test isolation light)
        abierta = get_caja_abierta(session, negocio_id=negocio.id)  # type: ignore[arg-type]
        if abierta:
            cerrar_caja(
                session,
                negocio_id=negocio.id,  # type: ignore[arg-type]
                usuario_id=None,
                monto_cierre=abierta.monto_apertura,
                commit=True,
            )

        fecha = date.today() + timedelta(days=60)
        caja = abrir_caja(
            session,
            negocio_id=negocio.id,  # type: ignore[arg-type]
            usuario_id=None,
            monto_apertura=10000,
            nombre_vendedor="Test Cajero",
            fecha=fecha,
            commit=True,
        )

        und = session.exec(
            select(UnidadMedida).where(
                UnidadMedida.negocio_id == negocio.id, UnidadMedida.sigla == "UND"
            )
        ).first()
        prod = session.exec(
            select(Producto).where(Producto.codigo_barras == "TEST-CAJA-P")
        ).first()
        if prod is None:
            prod = Producto(
                negocio_id=negocio.id,  # type: ignore[arg-type]
                nombre="Prod caja",
                codigo_barras="TEST-CAJA-P",
                unidad_medida_id=und.id,  # type: ignore[arg-type]
                precio_venta=2000,
            )
            session.add(prod)
            session.commit()
            session.refresh(prod)

        stock = stock_actual_producto(
            session, negocio_id=negocio.id, producto_id=prod.id  # type: ignore[arg-type]
        )
        if stock < 5:
            registrar_entrada_compra(
                session,
                negocio_id=negocio.id,  # type: ignore[arg-type]
                producto_id=prod.id,  # type: ignore[arg-type]
                cantidad=Decimal("10"),
                precio_costo_neto=500,
                iva_porcentaje=Decimal("19"),
                commit=True,
            )

        # Venta efectivo
        registrar_venta(
            session,
            negocio_id=negocio.id,  # type: ignore[arg-type]
            usuario_id=None,
            data=VentaCreate(
                metodo_pago=MetodoPago.EFECTIVO,
                items=[VentaItemIn(producto_id=prod.id, cantidad=Decimal("1"))],  # type: ignore[arg-type]
            ),
            commit=True,
        )
        # Venta tarjeta (no suma a efectivo teórico)
        registrar_venta(
            session,
            negocio_id=negocio.id,  # type: ignore[arg-type]
            usuario_id=None,
            data=VentaCreate(
                metodo_pago=MetodoPago.TARJETA,
                items=[VentaItemIn(producto_id=prod.id, cantidad=Decimal("1"))],  # type: ignore[arg-type]
            ),
            commit=True,
        )

        registrar_transaccion(
            session,
            negocio_id=negocio.id,  # type: ignore[arg-type]
            tipo=TipoTransaccion.GASTO_OPERATIVO,
            monto=1500,
            descripcion="Bencina test",
            medio_pago=MetodoPago.EFECTIVO,
            commit=True,
        )

        from app.models import CajaChica

        caja_db = session.get(CajaChica, caja.id)
        assert caja_db is not None
        cuadre = calcular_cuadre(session, caja_db)

        # 10000 + 2000 efectivo - 1500 gasto = 10500
        assert cuadre.ventas_efectivo == 2000
        assert cuadre.ventas_tarjeta == 2000
        assert cuadre.egresos_efectivo == 1500
        assert cuadre.efectivo_teorico == 10500

        cerrada = cerrar_caja(
            session,
            negocio_id=negocio.id,  # type: ignore[arg-type]
            usuario_id=None,
            monto_cierre=10400,  # descuadre -100
            commit=True,
        )
        assert cerrada.estado.value == "CERRADA"
        assert cerrada.diferencia == -100
