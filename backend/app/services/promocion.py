from dataclasses import dataclass
from datetime import date
from decimal import ROUND_CEILING, Decimal
from math import ceil
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session, col, select

from app.models import LoteStock, Producto, Promocion, PromocionItem, RecetaComponente
from app.models.enums import TipoProducto, TipoPromo
from app.schemas.promocion import (
    PrecioEfectivoOut,
    PromocionCreate,
    PromocionItemIn,
    PromocionItemOut,
    PromocionOut,
    PromocionUpdate,
)
from app.services.stock import costo_unitario_real


def _hoy() -> date:
    return date.today()


def costo_piso_producto(session: Session, producto: Producto) -> Optional[int]:
    """Mayor costo unitario real entre lotes del producto (o de componentes si es KIT)."""
    if producto.tipo == TipoProducto.KIT:
        comps = session.exec(
            select(RecetaComponente).where(
                RecetaComponente.producto_kit_id == producto.id
            )
        ).all()
        if not comps:
            return None
        total = 0
        for c in comps:
            comp = session.get(Producto, c.producto_componente_id)
            if comp is None:
                return None
            piso = costo_piso_producto(session, comp)
            if piso is None:
                return None
            qty = Decimal(str(c.cantidad))
            total += int(
                (Decimal(piso) * qty).quantize(Decimal("1"), rounding=ROUND_CEILING)
            )
        return total

    lotes = session.exec(
        select(LoteStock)
        .where(
            LoteStock.negocio_id == producto.negocio_id,
            LoteStock.producto_id == producto.id,
            LoteStock.activo == True,  # noqa: E712
        )
        .order_by(col(LoteStock.fecha_ingreso).desc())
    ).all()
    if not lotes:
        return None
    return max(costo_unitario_real(l) for l in lotes)


def calcular_precio_efectivo_item(
    *,
    precio_lista: int,
    tipo: TipoPromo,
    valor: int,
) -> int:
    if tipo == TipoPromo.FIJO:
        return int(valor)
    pct = min(max(int(valor), 0), 80)
    factor = Decimal("1") - (Decimal(pct) / Decimal("100"))
    return int(
        (Decimal(precio_lista) * factor).quantize(Decimal("1"), rounding=ROUND_CEILING)
    )


def minimo_precio_permitido(precio_lista: int, costo_piso: Optional[int]) -> int:
    piso_lista = ceil(precio_lista * 0.20) if precio_lista > 0 else 0
    if costo_piso is None:
        return piso_lista
    return max(int(costo_piso), piso_lista)


def validar_item_promo(
    session: Session,
    *,
    negocio_id: int,
    item: PromocionItemIn,
) -> tuple[Producto, int, Optional[int], int]:
    producto = session.get(Producto, item.producto_id)
    if producto is None or producto.negocio_id != negocio_id or not producto.activo:
        raise HTTPException(
            status_code=404, detail=f"Producto {item.producto_id} no encontrado"
        )
    lista = int(producto.precio_venta)
    costo = costo_piso_producto(session, producto)
    if costo is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No se puede crear promo para '{producto.nombre}': "
                "sin costo de compra de referencia"
            ),
        )
    efectivo = calcular_precio_efectivo_item(
        precio_lista=lista, tipo=item.tipo, valor=item.valor
    )
    minimo = minimo_precio_permitido(lista, costo)
    if efectivo < minimo:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Precio promo de '{producto.nombre}' ({efectivo}) es menor al mínimo "
                f"permitido ({minimo}): costo {costo} y tope 80% descuento "
                f"(piso lista {ceil(lista * 0.20)})"
            ),
        )
    if item.tipo == TipoPromo.FIJO and lista > 0:
        descuento_pct = ((lista - efectivo) / lista) * 100
        if descuento_pct > 80:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El precio fijo de '{producto.nombre}' implica más de 80% de descuento"
                ),
            )
    return producto, lista, costo, efectivo


def _vigente(promo: Promocion, hoy: Optional[date] = None) -> bool:
    d = hoy or _hoy()
    return bool(promo.activa) and promo.fecha_inicio <= d <= promo.fecha_fin


def promocion_to_out(session: Session, promo: Promocion) -> PromocionOut:
    items_rows = session.exec(
        select(PromocionItem, Producto)
        .join(Producto, Producto.id == PromocionItem.producto_id)
        .where(PromocionItem.promocion_id == promo.id)
        .order_by(col(PromocionItem.id).asc())
    ).all()
    items: list[PromocionItemOut] = []
    for it, prod in items_rows:
        lista = int(prod.precio_venta)
        costo = costo_piso_producto(session, prod)
        efectivo = calcular_precio_efectivo_item(
            precio_lista=lista, tipo=it.tipo, valor=it.valor
        )
        items.append(
            PromocionItemOut(
                id=it.id,  # type: ignore[arg-type]
                producto_id=it.producto_id,
                producto_nombre=prod.nombre,
                tipo=it.tipo,
                valor=it.valor,
                precio_lista=lista,
                costo_piso=costo,
                precio_efectivo=efectivo,
            )
        )
    return PromocionOut(
        id=promo.id,  # type: ignore[arg-type]
        negocio_id=promo.negocio_id,
        nombre=promo.nombre,
        fecha_inicio=promo.fecha_inicio,
        fecha_fin=promo.fecha_fin,
        activa=promo.activa,
        creado_en=promo.creado_en,
        creado_por_usuario_id=promo.creado_por_usuario_id,
        items=items,
        vigente=_vigente(promo),
    )


def _replace_items(
    session: Session,
    *,
    negocio_id: int,
    promocion_id: int,
    items: list[PromocionItemIn],
) -> None:
    seen: set[int] = set()
    for raw in items:
        if raw.producto_id in seen:
            raise HTTPException(
                status_code=400,
                detail=f"Producto {raw.producto_id} duplicado en la promoción",
            )
        seen.add(raw.producto_id)
        validar_item_promo(session, negocio_id=negocio_id, item=raw)

    existentes = session.exec(
        select(PromocionItem).where(PromocionItem.promocion_id == promocion_id)
    ).all()
    for e in existentes:
        session.delete(e)
    session.flush()

    for raw in items:
        session.add(
            PromocionItem(
                promocion_id=promocion_id,
                producto_id=raw.producto_id,
                tipo=raw.tipo,
                valor=raw.valor,
            )
        )


def crear_promocion(
    session: Session,
    *,
    negocio_id: int,
    usuario_id: Optional[int],
    data: PromocionCreate,
) -> PromocionOut:
    promo = Promocion(
        negocio_id=negocio_id,
        nombre=data.nombre.strip(),
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        activa=data.activa,
        creado_por_usuario_id=usuario_id,
    )
    session.add(promo)
    session.flush()
    _replace_items(
        session, negocio_id=negocio_id, promocion_id=promo.id, items=data.items  # type: ignore[arg-type]
    )
    session.commit()
    session.refresh(promo)
    return promocion_to_out(session, promo)


def listar_promociones(
    session: Session, *, negocio_id: int, solo_activas: bool = False
) -> list[PromocionOut]:
    q = select(Promocion).where(Promocion.negocio_id == negocio_id)
    if solo_activas:
        q = q.where(Promocion.activa == True)  # noqa: E712
    rows = session.exec(q.order_by(col(Promocion.fecha_inicio).desc())).all()
    return [promocion_to_out(session, p) for p in rows]


def obtener_promocion(
    session: Session, *, negocio_id: int, promocion_id: int
) -> PromocionOut:
    promo = session.get(Promocion, promocion_id)
    if promo is None or promo.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    return promocion_to_out(session, promo)


def actualizar_promocion(
    session: Session,
    *,
    negocio_id: int,
    promocion_id: int,
    data: PromocionUpdate,
) -> PromocionOut:
    promo = session.get(Promocion, promocion_id)
    if promo is None or promo.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")

    payload = data.model_dump(exclude_unset=True)
    items = payload.pop("items", None)
    if "nombre" in payload and payload["nombre"] is not None:
        payload["nombre"] = str(payload["nombre"]).strip()

    for key, value in payload.items():
        setattr(promo, key, value)

    inicio = promo.fecha_inicio
    fin = promo.fecha_fin
    if fin < inicio:
        raise HTTPException(
            status_code=400, detail="fecha_fin no puede ser anterior a fecha_inicio"
        )

    session.add(promo)
    session.flush()

    if items is not None:
        parsed = [PromocionItemIn.model_validate(i) for i in items]
        _replace_items(
            session,
            negocio_id=negocio_id,
            promocion_id=promocion_id,
            items=parsed,
        )

    session.commit()
    session.refresh(promo)
    return promocion_to_out(session, promo)


def agregar_item_promocion(
    session: Session,
    *,
    negocio_id: int,
    promocion_id: int,
    item: PromocionItemIn,
) -> PromocionOut:
    promo = session.get(Promocion, promocion_id)
    if promo is None or promo.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    validar_item_promo(session, negocio_id=negocio_id, item=item)
    exists = session.exec(
        select(PromocionItem).where(
            PromocionItem.promocion_id == promocion_id,
            PromocionItem.producto_id == item.producto_id,
        )
    ).first()
    if exists:
        raise HTTPException(
            status_code=409, detail="El producto ya está en esta promoción"
        )
    session.add(
        PromocionItem(
            promocion_id=promocion_id,
            producto_id=item.producto_id,
            tipo=item.tipo,
            valor=item.valor,
        )
    )
    session.commit()
    session.refresh(promo)
    return promocion_to_out(session, promo)


def eliminar_item_promocion(
    session: Session,
    *,
    negocio_id: int,
    promocion_id: int,
    item_id: int,
) -> PromocionOut:
    promo = session.get(Promocion, promocion_id)
    if promo is None or promo.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    item = session.get(PromocionItem, item_id)
    if item is None or item.promocion_id != promocion_id:
        raise HTTPException(status_code=404, detail="Ítem de promoción no encontrado")
    session.delete(item)
    session.commit()
    session.refresh(promo)
    return promocion_to_out(session, promo)


@dataclass
class PrecioResuelto:
    precio_lista: int
    precio_efectivo: int
    ahorro_unitario: int
    promocion_id: Optional[int]
    promocion_nombre: Optional[str]
    tipo_promo: Optional[TipoPromo]
    valor_promo: Optional[int]
    costo_piso: Optional[int]


def resolver_precio_efectivo(
    session: Session,
    *,
    negocio_id: int,
    producto: Producto,
    hoy: Optional[date] = None,
) -> PrecioResuelto:
    """Si hay promo vigente para el SKU, usa ese precio; si no, precio lista."""
    lista = int(producto.precio_venta)
    costo = costo_piso_producto(session, producto)
    d = hoy or _hoy()

    rows = session.exec(
        select(PromocionItem, Promocion)
        .join(Promocion, Promocion.id == PromocionItem.promocion_id)
        .where(
            Promocion.negocio_id == negocio_id,
            Promocion.activa == True,  # noqa: E712
            Promocion.fecha_inicio <= d,
            Promocion.fecha_fin >= d,
            PromocionItem.producto_id == producto.id,
        )
        .order_by(col(Promocion.id).desc())
    ).all()

    if not rows:
        return PrecioResuelto(
            precio_lista=lista,
            precio_efectivo=lista,
            ahorro_unitario=0,
            promocion_id=None,
            promocion_nombre=None,
            tipo_promo=None,
            valor_promo=None,
            costo_piso=costo,
        )

    item, promo = rows[0]
    efectivo = calcular_precio_efectivo_item(
        precio_lista=lista, tipo=item.tipo, valor=item.valor
    )
    minimo = minimo_precio_permitido(lista, costo)
    # Si la promo quedó inválida (subió el costo / bajó lista), no aplicar
    if efectivo < minimo:
        return PrecioResuelto(
            precio_lista=lista,
            precio_efectivo=lista,
            ahorro_unitario=0,
            promocion_id=None,
            promocion_nombre=None,
            tipo_promo=None,
            valor_promo=None,
            costo_piso=costo,
        )

    ahorro = max(0, lista - efectivo)
    return PrecioResuelto(
        precio_lista=lista,
        precio_efectivo=efectivo,
        ahorro_unitario=ahorro,
        promocion_id=promo.id,
        promocion_nombre=promo.nombre,
        tipo_promo=item.tipo,
        valor_promo=item.valor,
        costo_piso=costo,
    )


def precio_efectivo_out(
    session: Session, *, negocio_id: int, producto_id: int
) -> PrecioEfectivoOut:
    producto = session.get(Producto, producto_id)
    if producto is None or producto.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    r = resolver_precio_efectivo(
        session, negocio_id=negocio_id, producto=producto
    )
    return PrecioEfectivoOut(
        producto_id=producto_id,
        precio_lista=r.precio_lista,
        costo_piso=r.costo_piso,
        promocion_id=r.promocion_id,
        promocion_nombre=r.promocion_nombre,
        tipo_promo=r.tipo_promo,
        valor_promo=r.valor_promo,
        precio_efectivo=r.precio_efectivo,
        ahorro_unitario=r.ahorro_unitario,
    )
