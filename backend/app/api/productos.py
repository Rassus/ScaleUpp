from typing import Annotated, Optional
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, col, select

from app.api.deps import CurrentContext, require_negocio, require_negocio_write
from app.db import get_session
from app.models import Categoria, HistorialPrecioProducto, Producto, UnidadMedida, Usuario
from app.models.enums import TipoProducto
from app.schemas.producto import (
    HistorialPrecioOut,
    ProductoCreate,
    ProductoOut,
    ProductoUpdate,
)

router = APIRouter(prefix="/productos", tags=["productos"])


def _get_producto(
    session: Session, producto_id: int, negocio_id: int
) -> Producto:
    row = session.get(Producto, producto_id)
    if row is None or row.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return row


def _validar_fk(
    session: Session,
    *,
    negocio_id: int,
    unidad_medida_id: Optional[int],
    categoria_id: Optional[int],
) -> None:
    if unidad_medida_id is not None:
        unidad = session.get(UnidadMedida, unidad_medida_id)
        if unidad is None or unidad.negocio_id != negocio_id or not unidad.activo:
            raise HTTPException(
                status_code=400, detail="unidad_medida_id inválida para este negocio"
            )
    if categoria_id is not None:
        cat = session.get(Categoria, categoria_id)
        if cat is None or cat.negocio_id != negocio_id or not cat.activo:
            raise HTTPException(
                status_code=400, detail="categoria_id inválida para este negocio"
            )


def _codigo_existe(session: Session, negocio_id: int, codigo: str) -> bool:
    return (
        session.exec(
            select(Producto).where(
                Producto.negocio_id == negocio_id,
                Producto.codigo_barras == codigo,
            )
        ).first()
        is not None
    )


def generar_codigo_kit(session: Session, negocio_id: int) -> str:
    """Código único escaneable (CODE_39 / CODE_128): KIT{negocio}{hex}."""
    for _ in range(24):
        codigo = f"KIT{negocio_id}{secrets.token_hex(4).upper()}"
        if not _codigo_existe(session, negocio_id, codigo):
            return codigo
    raise HTTPException(
        status_code=500,
        detail="No se pudo generar un código único para el kit",
    )


@router.get("", response_model=list[ProductoOut])
def listar(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    solo_activos: bool = True,
    q: Annotated[Optional[str], Query(description="Busca por nombre o código")] = None,
) -> list[Producto]:
    stmt = select(Producto).where(Producto.negocio_id == ctx.negocio.id)
    if solo_activos:
        stmt = stmt.where(Producto.activo == True)  # noqa: E712
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            (Producto.nombre.ilike(like)) | (Producto.codigo_barras.ilike(like))
        )
    return list(session.exec(stmt.order_by(Producto.nombre)).all())


@router.get("/codigo/{codigo_barras}", response_model=ProductoOut)
def por_codigo(
    codigo_barras: str,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> Producto:
    row = session.exec(
        select(Producto).where(
            Producto.negocio_id == ctx.negocio.id,
            Producto.codigo_barras == codigo_barras.strip(),
            Producto.activo == True,  # noqa: E712
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return row


def _historial_to_out(
    session: Session, row: HistorialPrecioProducto, producto_nombre: str
) -> HistorialPrecioOut:
    usuario_nombre = None
    if row.usuario_id is not None:
        user = session.get(Usuario, row.usuario_id)
        usuario_nombre = user.nombre if user is not None else None
    return HistorialPrecioOut(
        id=row.id,  # type: ignore[arg-type]
        producto_id=row.producto_id,
        producto_nombre=producto_nombre,
        precio_anterior=row.precio_anterior,
        precio_nuevo=row.precio_nuevo,
        usuario_id=row.usuario_id,
        usuario_nombre=usuario_nombre,
        fecha_hora=row.fecha_hora,
    )


@router.get("/historial-precios", response_model=list[HistorialPrecioOut])
def listar_historial_precios(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    producto_id: Annotated[Optional[int], Query()] = None,
) -> list[HistorialPrecioOut]:
    stmt = (
        select(HistorialPrecioProducto, Producto)
        .join(Producto, Producto.id == HistorialPrecioProducto.producto_id)
        .where(HistorialPrecioProducto.negocio_id == ctx.negocio.id)
    )
    if producto_id is not None:
        stmt = stmt.where(HistorialPrecioProducto.producto_id == producto_id)
    rows = session.exec(
        stmt.order_by(col(HistorialPrecioProducto.fecha_hora).desc()).limit(limit)
    ).all()
    return [_historial_to_out(session, h, p.nombre) for h, p in rows]


@router.get("/{producto_id}/historial-precios", response_model=list[HistorialPrecioOut])
def historial_precios_producto(
    producto_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[HistorialPrecioOut]:
    producto = _get_producto(session, producto_id, ctx.negocio.id)  # type: ignore[arg-type]
    rows = session.exec(
        select(HistorialPrecioProducto)
        .where(
            HistorialPrecioProducto.negocio_id == ctx.negocio.id,
            HistorialPrecioProducto.producto_id == producto_id,
        )
        .order_by(col(HistorialPrecioProducto.fecha_hora).desc())
        .limit(limit)
    ).all()
    return [_historial_to_out(session, h, producto.nombre) for h in rows]


@router.get("/{producto_id}", response_model=ProductoOut)
def obtener(
    producto_id: int,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> Producto:
    return _get_producto(session, producto_id, ctx.negocio.id)  # type: ignore[arg-type]

@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
def crear(
    body: ProductoCreate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> Producto:
    negocio_id = ctx.negocio.id  # type: ignore[assignment]
    _validar_fk(
        session,
        negocio_id=negocio_id,
        unidad_medida_id=body.unidad_medida_id,
        categoria_id=body.categoria_id,
    )

    codigo = body.codigo_barras.strip() if body.codigo_barras else None
    if body.tipo == TipoProducto.KIT and not codigo:
        codigo = generar_codigo_kit(session, negocio_id)
    if codigo:
        exists = session.exec(
            select(Producto).where(
                Producto.negocio_id == negocio_id,
                Producto.codigo_barras == codigo,
            )
        ).first()
        if exists:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un producto con ese código de barras",
            )

    row = Producto(
        negocio_id=negocio_id,
        codigo_barras=codigo,
        nombre=body.nombre.strip(),
        categoria_id=body.categoria_id,
        unidad_medida_id=body.unidad_medida_id,
        tipo=body.tipo,
        precio_venta=body.precio_venta,
        controla_caducidad=body.controla_caducidad,
        porcentaje_emergencia=body.porcentaje_emergencia,
        porcentaje_sobrestock=body.porcentaje_sobrestock,
        stock_ideal=body.stock_ideal,
        stock_minimo=body.stock_minimo,
        imagen_base64=body.imagen_base64,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.patch("/{producto_id}", response_model=ProductoOut)
def actualizar(
    producto_id: int,
    body: ProductoUpdate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> Producto:
    negocio_id = ctx.negocio.id  # type: ignore[assignment]
    row = _get_producto(session, producto_id, negocio_id)
    data = body.model_dump(exclude_unset=True)

    unidad_id = data.get("unidad_medida_id", row.unidad_medida_id)
    categoria_id = data.get("categoria_id", row.categoria_id)
    if "unidad_medida_id" in data or "categoria_id" in data:
        _validar_fk(
            session,
            negocio_id=negocio_id,
            unidad_medida_id=unidad_id,
            categoria_id=categoria_id,
        )

    if "codigo_barras" in data:
        codigo = data["codigo_barras"]
        if codigo is not None:
            codigo = codigo.strip() or None
        data["codigo_barras"] = codigo
        if codigo:
            other = session.exec(
                select(Producto).where(
                    Producto.negocio_id == negocio_id,
                    Producto.codigo_barras == codigo,
                    Producto.id != producto_id,
                )
            ).first()
            if other:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe un producto con ese código de barras",
                )

    if "nombre" in data and data["nombre"] is not None:
        data["nombre"] = data["nombre"].strip()

    precio_anterior = row.precio_venta
    precio_nuevo = data.get("precio_venta", precio_anterior)

    for key, value in data.items():
        setattr(row, key, value)
    session.add(row)

    if "precio_venta" in data and int(precio_nuevo) != int(precio_anterior):
        session.add(
            HistorialPrecioProducto(
                negocio_id=negocio_id,
                producto_id=producto_id,
                precio_anterior=int(precio_anterior),
                precio_nuevo=int(precio_nuevo),
                usuario_id=ctx.usuario.id,
            )
        )

    session.commit()
    session.refresh(row)
    return row
