"""Tests de ventas con FIFO + KIT."""

from decimal import Decimal

from sqlmodel import Session, select

from app.db import engine
from app.models import Negocio, Producto, UnidadMedida
from app.models.enums import MetodoPago, TipoProducto
from app.schemas.venta import VentaCreate, VentaItemIn
from app.services.caja import abrir_caja, get_caja_abierta
from app.services.receta import reemplazar_receta
from app.services.stock import registrar_entrada_compra, stock_actual_producto
from app.services.venta import registrar_venta


def test_venta_simple_y_kit_fifo():
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
            from datetime import date, timedelta

            # Usar fecha futura única para no chocar con cajas del día
            abrir_caja(
                session,
                negocio_id=negocio.id,  # type: ignore[arg-type]
                usuario_id=None,
                monto_apertura=50000,
                nombre_vendedor="Test Ventas",
                fecha=date.today() + timedelta(days=30),
                commit=True,
            )

        def ensure_simple(code: str, nombre: str, precio: int) -> Producto:
            p = session.exec(
                select(Producto).where(Producto.codigo_barras == code)
            ).first()
            if p is None:
                p = Producto(
                    negocio_id=negocio.id,  # type: ignore[arg-type]
                    nombre=nombre,
                    codigo_barras=code,
                    unidad_medida_id=und.id,  # type: ignore[arg-type]
                    precio_venta=precio,
                    tipo=TipoProducto.SIMPLE,
                )
                session.add(p)
                session.commit()
                session.refresh(p)
            return p

        a = ensure_simple("TEST-SALE-A", "Comp A", 1000)
        b = ensure_simple("TEST-SALE-B", "Comp B", 1500)

        # stock limpio suficiente
        for p, qty, costo in ((a, Decimal("20"), 200), (b, Decimal("20"), 300)):
            actual = stock_actual_producto(
                session,
                negocio_id=negocio.id,  # type: ignore[arg-type]
                producto_id=p.id,  # type: ignore[arg-type]
            )
            if actual < qty:
                registrar_entrada_compra(
                    session,
                    negocio_id=negocio.id,  # type: ignore[arg-type]
                    producto_id=p.id,  # type: ignore[arg-type]
                    cantidad=qty - actual,
                    precio_costo_neto=costo,
                    iva_porcentaje=Decimal("19"),
                    commit=True,
                )

        kit = session.exec(
            select(Producto).where(Producto.codigo_barras == "TEST-SALE-KIT")
        ).first()
        if kit is None:
            kit = Producto(
                negocio_id=negocio.id,  # type: ignore[arg-type]
                nombre="Kit test venta",
                codigo_barras="TEST-SALE-KIT",
                unidad_medida_id=und.id,  # type: ignore[arg-type]
                precio_venta=2200,
                tipo=TipoProducto.KIT,
            )
            session.add(kit)
            session.commit()
            session.refresh(kit)
            reemplazar_receta(
                session,
                kit=kit,
                items=[(a.id, Decimal("1")), (b.id, Decimal("1"))],  # type: ignore[arg-type]
                commit=True,
            )

        stock_a_before = stock_actual_producto(
            session, negocio_id=negocio.id, producto_id=a.id  # type: ignore[arg-type]
        )
        stock_b_before = stock_actual_producto(
            session, negocio_id=negocio.id, producto_id=b.id  # type: ignore[arg-type]
        )

        venta = registrar_venta(
            session,
            negocio_id=negocio.id,  # type: ignore[arg-type]
            usuario_id=None,
            data=VentaCreate(
                metodo_pago=MetodoPago.EFECTIVO,
                items=[
                    VentaItemIn(producto_id=a.id, cantidad=Decimal("2")),  # type: ignore[arg-type]
                    VentaItemIn(producto_id=kit.id, cantidad=Decimal("1")),  # type: ignore[arg-type]
                ],
            ),
            commit=True,
        )

        assert venta.total_venta == 1000 * 2 + 2200
        assert len(venta.items) == 2
        assert len(venta.detalles) >= 3  # 2 de A simple + A y B del kit
        assert venta.costo_total > 0
        assert venta.ganancia == venta.total_venta - venta.costo_total

        stock_a_after = stock_actual_producto(
            session, negocio_id=negocio.id, producto_id=a.id  # type: ignore[arg-type]
        )
        stock_b_after = stock_actual_producto(
            session, negocio_id=negocio.id, producto_id=b.id  # type: ignore[arg-type]
        )
        # 2 (línea simple) + 1 (kit) de A; 1 de B
        assert stock_a_after == stock_a_before - Decimal("3.00")
        assert stock_b_after == stock_b_before - Decimal("1.00")
