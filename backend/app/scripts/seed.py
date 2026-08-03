"""Seed inicial: platform_admin + negocio demo + catálogo básico.

Uso (desde backend/ con venv activo):
    python -m app.scripts.seed
"""

from datetime import date, timedelta
from decimal import Decimal

from sqlmodel import Session, select

from app.core.security import hash_password
from app.db import engine
from app.catalog.categorias_default import CATEGORIAS_SUPERMERCADO
from app.models import (
    Categoria,
    Membresia,
    Negocio,
    Producto,
    RecetaComponente,
    UnidadMedida,
    Usuario,
)
from app.models.enums import RolMembresia, TipoProducto
from app.services.receta import reemplazar_receta
from app.services.stock import registrar_entrada_compra, stock_actual_producto



def seed() -> None:
    with Session(engine) as session:
        admin = session.exec(
            select(Usuario).where(Usuario.email == "admin@scaleupp.com")
        ).first()
        if admin is None:
            admin = Usuario(
                email="admin@scaleupp.com",
                nombre="Platform Admin",
                password_hash=hash_password("admin123"),
                es_platform_admin=True,
            )
            session.add(admin)
            session.flush()
            print(f"Creado platform_admin id={admin.id}")
        else:
            print(f"platform_admin ya existe id={admin.id}")

        negocio = session.exec(
            select(Negocio).where(Negocio.slug == "demo")
        ).first()
        if negocio is None:
            negocio = Negocio(nombre="Negocio Demo", slug="demo")
            session.add(negocio)
            session.flush()
            print(f"Creado negocio demo id={negocio.id}")
        else:
            print(f"negocio demo ya existe id={negocio.id}")

        def ensure_user(
            email: str, nombre: str, password: str, rol: RolMembresia
        ) -> None:
            user = session.exec(select(Usuario).where(Usuario.email == email)).first()
            if user is None:
                user = Usuario(
                    email=email,
                    nombre=nombre,
                    password_hash=hash_password(password),
                    es_platform_admin=False,
                )
                session.add(user)
                session.flush()
                print(f"Creado usuario {email} id={user.id}")
            else:
                print(f"usuario {email} ya existe id={user.id}")

            mem = session.exec(
                select(Membresia).where(
                    Membresia.usuario_id == user.id,
                    Membresia.negocio_id == negocio.id,
                )
            ).first()
            if mem is None:
                session.add(
                    Membresia(
                        usuario_id=user.id,  # type: ignore[arg-type]
                        negocio_id=negocio.id,  # type: ignore[arg-type]
                        rol=rol,
                    )
                )
                print(f"  membresia {rol.value} en negocio {negocio.id}")
            else:
                print(f"  membresia ya existe id={mem.id}")

        ensure_user("owner@demo.com", "Owner Demo", "owner123", RolMembresia.OWNER)
        ensure_user("cajero@demo.com", "Cajero Demo", "cajero123", RolMembresia.CAJERO)

        unidades_default = [
            ("Unidad", "UND"),
            ("Kilogramo", "KG"),
            ("Litro", "L"),
            ("Caja", "CJ"),
            ("Paquete", "PQ"),
        ]
        unidades: dict[str, UnidadMedida] = {}
        for nombre, sigla in unidades_default:
            row = session.exec(
                select(UnidadMedida).where(
                    UnidadMedida.negocio_id == negocio.id,
                    UnidadMedida.sigla == sigla,
                )
            ).first()
            if row is None:
                row = UnidadMedida(
                    negocio_id=negocio.id,  # type: ignore[arg-type]
                    nombre=nombre,
                    sigla=sigla,
                )
                session.add(row)
                session.flush()
                print(f"Creada unidad {sigla}")
            unidades[sigla] = row

        categorias_default = list(CATEGORIAS_SUPERMERCADO)
        categorias: dict[str, Categoria] = {}
        for nombre, desc in categorias_default:
            row = session.exec(
                select(Categoria).where(
                    Categoria.negocio_id == negocio.id,
                    Categoria.nombre == nombre,
                )
            ).first()
            if row is None:
                row = Categoria(
                    negocio_id=negocio.id,  # type: ignore[arg-type]
                    nombre=nombre,
                    descripcion=desc,
                )
                session.add(row)
                session.flush()
                print(f"Creada categoría {nombre}")
            else:
                if row.descripcion != desc:
                    row.descripcion = desc
                    session.add(row)
            categorias[nombre] = row

        # Reasigna productos de categorías legacy y las desactiva.
        legacy_map = {
            "Bebidas": "Aguas y Bebidas Analcohólicas",
            "Snacks": "Snacks y Confitería",
            "Abarrotes": "Arroz, Legumbres y Pastas",
            "Lácteos": "Leches y Alternativas",
            "Congelados": "Verduras Congeladas",
            "Limpieza": "Limpieza de Superficies",
        }
        for old_name, new_name in legacy_map.items():
            old_cat = session.exec(
                select(Categoria).where(
                    Categoria.negocio_id == negocio.id,
                    Categoria.nombre == old_name,
                )
            ).first()
            new_cat = categorias.get(new_name)
            if old_cat is None or new_cat is None:
                continue
            prods = session.exec(
                select(Producto).where(
                    Producto.negocio_id == negocio.id,
                    Producto.categoria_id == old_cat.id,
                )
            ).all()
            for prod in prods:
                prod.categoria_id = new_cat.id
                session.add(prod)
            if prods:
                print(
                    f"Reasignados {len(prods)} producto(s) de '{old_name}' -> '{new_name}'"
                )
            if old_cat.activo:
                old_cat.activo = False
                session.add(old_cat)
                print(f"Desactivada categoría legacy '{old_name}'")

        productos_demo = [
            {
                "nombre": "Bebida cola 500ml",
                "codigo_barras": "7801234567890",
                "categoria": "Aguas y Bebidas Analcohólicas",
                "unidad": "UND",
                "precio_venta": 1200,
                "stock_ideal": Decimal("50"),
                "stock_minimo": Decimal("10"),
            },
            {
                "nombre": "Nachos queso 150g",
                "codigo_barras": "7809876543210",
                "categoria": "Snacks y Confitería",
                "unidad": "UND",
                "precio_venta": 1800,
                "stock_ideal": Decimal("30"),
                "stock_minimo": Decimal("5"),
            },
            {
                "nombre": "Arroz 1kg",
                "codigo_barras": "7801111222333",
                "categoria": "Arroz, Legumbres y Pastas",
                "unidad": "KG",
                "precio_venta": 1500,
                "controla_caducidad": True,
                "stock_ideal": Decimal("100"),
                "stock_minimo": Decimal("20"),
            },
        ]
        for p in productos_demo:
            exists = session.exec(
                select(Producto).where(
                    Producto.negocio_id == negocio.id,
                    Producto.codigo_barras == p["codigo_barras"],
                )
            ).first()
            if exists:
                print(f"Producto {p['nombre']} ya existe")
                continue
            session.add(
                Producto(
                    negocio_id=negocio.id,  # type: ignore[arg-type]
                    nombre=p["nombre"],
                    codigo_barras=p["codigo_barras"],
                    categoria_id=categorias[p["categoria"]].id,
                    unidad_medida_id=unidades[p["unidad"]].id,  # type: ignore[arg-type]
                    tipo=TipoProducto.SIMPLE,
                    precio_venta=p["precio_venta"],
                    controla_caducidad=p.get("controla_caducidad", False),
                    stock_ideal=p.get("stock_ideal"),
                    stock_minimo=p.get("stock_minimo"),
                )
            )
            print(f"Creado producto {p['nombre']}")

        session.flush()

        bebida = session.exec(
            select(Producto).where(
                Producto.negocio_id == negocio.id,
                Producto.codigo_barras == "7801234567890",
            )
        ).first()
        nachos = session.exec(
            select(Producto).where(
                Producto.negocio_id == negocio.id,
                Producto.codigo_barras == "7809876543210",
            )
        ).first()

        kit = session.exec(
            select(Producto).where(
                Producto.negocio_id == negocio.id,
                Producto.codigo_barras == "PROMO-BEBIDA-NACHOS",
            )
        ).first()
        if kit is None and bebida and nachos:
            kit = Producto(
                negocio_id=negocio.id,  # type: ignore[arg-type]
                nombre="Promo bebida + nachos",
                codigo_barras="PROMO-BEBIDA-NACHOS",
                categoria_id=categorias["Snacks y Confitería"].id,
                unidad_medida_id=unidades["UND"].id,  # type: ignore[arg-type]
                tipo=TipoProducto.KIT,
                precio_venta=2500,
                controla_caducidad=False,
            )
            session.add(kit)
            session.flush()
            print(f"Creado kit {kit.nombre} id={kit.id}")

        if kit and bebida and nachos:
            tiene = session.exec(
                select(RecetaComponente).where(
                    RecetaComponente.producto_kit_id == kit.id
                )
            ).first()
            if tiene is None:
                reemplazar_receta(
                    session,
                    kit=kit,
                    items=[
                        (bebida.id, Decimal("1")),  # type: ignore[arg-type]
                        (nachos.id, Decimal("1")),  # type: ignore[arg-type]
                    ],
                    commit=False,
                )
                print("Receta kit: 1 bebida + 1 nachos")
            else:
                print("Receta kit ya existe")

        # Stock demo FIFO: dos lotes de bebida con costos distintos
        if bebida:
            stock_bebida = stock_actual_producto(
                session,
                negocio_id=negocio.id,  # type: ignore[arg-type]
                producto_id=bebida.id,  # type: ignore[arg-type]
            )
            if stock_bebida == 0:
                registrar_entrada_compra(
                    session,
                    negocio_id=negocio.id,  # type: ignore[arg-type]
                    producto_id=bebida.id,  # type: ignore[arg-type]
                    cantidad=Decimal("10"),
                    precio_costo_neto=500,
                    iva_porcentaje=Decimal("19.00"),
                    costo_operacion_total=1000,  # $100/u
                    motivo="Lote viejo demo",
                    commit=False,
                )
                registrar_entrada_compra(
                    session,
                    negocio_id=negocio.id,  # type: ignore[arg-type]
                    producto_id=bebida.id,  # type: ignore[arg-type]
                    cantidad=Decimal("20"),
                    precio_costo_neto=550,
                    iva_porcentaje=Decimal("19.00"),
                    costo_operacion_total=0,
                    motivo="Lote nuevo demo",
                    commit=False,
                )
                print("Stock bebida: lotes 10@600 + 20@550 (FIFO)")
            else:
                print(f"Stock bebida ya existe ({stock_bebida})")

        if nachos:
            stock_nachos = stock_actual_producto(
                session,
                negocio_id=negocio.id,  # type: ignore[arg-type]
                producto_id=nachos.id,  # type: ignore[arg-type]
            )
            if stock_nachos == 0:
                registrar_entrada_compra(
                    session,
                    negocio_id=negocio.id,  # type: ignore[arg-type]
                    producto_id=nachos.id,  # type: ignore[arg-type]
                    cantidad=Decimal("15"),
                    precio_costo_neto=800,
                    iva_porcentaje=Decimal("19.00"),
                    motivo="Entrada nachos demo",
                    commit=False,
                )
                print("Stock nachos: 15 unidades")

        arroz = session.exec(
            select(Producto).where(
                Producto.negocio_id == negocio.id,
                Producto.codigo_barras == "7801111222333",
            )
        ).first()
        if arroz:
            stock_arroz = stock_actual_producto(
                session,
                negocio_id=negocio.id,  # type: ignore[arg-type]
                producto_id=arroz.id,  # type: ignore[arg-type]
            )
            if stock_arroz == 0:
                registrar_entrada_compra(
                    session,
                    negocio_id=negocio.id,  # type: ignore[arg-type]
                    producto_id=arroz.id,  # type: ignore[arg-type]
                    cantidad=Decimal("40"),
                    precio_costo_neto=900,
                    iva_porcentaje=Decimal("19.00"),
                    fecha_caducidad=date.today() + timedelta(days=180),
                    motivo="Entrada arroz demo",
                    commit=False,
                )
                print("Stock arroz: 40 kg con caducidad")

        session.commit()
        print("Seed OK")


if __name__ == "__main__":
    seed()
