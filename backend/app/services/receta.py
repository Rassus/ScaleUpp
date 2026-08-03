from decimal import Decimal

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models import Producto, RecetaComponente
from app.models.enums import TipoProducto
from app.schemas.receta import ExpansionItemOut, ExpansionOut, RecetaItemOut, RecetaOut


def get_kit_or_404(session: Session, kit_id: int, negocio_id: int) -> Producto:
    kit = session.get(Producto, kit_id)
    if kit is None or kit.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if kit.tipo != TipoProducto.KIT:
        raise HTTPException(
            status_code=400,
            detail="El producto no es un KIT; solo los kits tienen receta",
        )
    return kit


def listar_receta(session: Session, kit: Producto) -> RecetaOut:
    rows = session.exec(
        select(RecetaComponente, Producto)
        .join(Producto, Producto.id == RecetaComponente.producto_componente_id)
        .where(RecetaComponente.producto_kit_id == kit.id)
        .order_by(Producto.nombre)
    ).all()
    return RecetaOut(
        producto_kit_id=kit.id,  # type: ignore[arg-type]
        kit_nombre=kit.nombre,
        componentes=[
            RecetaItemOut(
                id=rc.id,  # type: ignore[arg-type]
                producto_componente_id=rc.producto_componente_id,
                componente_nombre=comp.nombre,
                componente_codigo_barras=comp.codigo_barras,
                cantidad=rc.cantidad,
            )
            for rc, comp in rows
        ],
    )


def validar_componente(
    session: Session,
    *,
    negocio_id: int,
    kit_id: int,
    componente_id: int,
) -> Producto:
    if componente_id == kit_id:
        raise HTTPException(
            status_code=400,
            detail="Un kit no puede incluirase a sí mismo",
        )
    comp = session.get(Producto, componente_id)
    if comp is None or comp.negocio_id != negocio_id or not comp.activo:
        raise HTTPException(
            status_code=400,
            detail=f"Componente {componente_id} inválido para este negocio",
        )
    # MVP: solo componentes SIMPLE (evita ciclos / kits anidados)
    if comp.tipo != TipoProducto.SIMPLE:
        raise HTTPException(
            status_code=400,
            detail="En MVP los componentes deben ser productos SIMPLE (no kits anidados)",
        )
    return comp


def reemplazar_receta(
    session: Session,
    *,
    kit: Producto,
    items: list[tuple[int, Decimal]],
    commit: bool = True,
) -> RecetaOut:
    if not items:
        raise HTTPException(status_code=400, detail="La receta no puede estar vacía")

    vistos: set[int] = set()
    for componente_id, cantidad in items:
        if componente_id in vistos:
            raise HTTPException(
                status_code=400,
                detail=f"Componente {componente_id} duplicado en la receta",
            )
        vistos.add(componente_id)
        validar_componente(
            session,
            negocio_id=kit.negocio_id,
            kit_id=kit.id,  # type: ignore[arg-type]
            componente_id=componente_id,
        )
        if cantidad <= 0:
            raise HTTPException(status_code=400, detail="cantidad debe ser > 0")

    existentes = session.exec(
        select(RecetaComponente).where(RecetaComponente.producto_kit_id == kit.id)
    ).all()
    for row in existentes:
        session.delete(row)
    session.flush()

    for componente_id, cantidad in items:
        session.add(
            RecetaComponente(
                producto_kit_id=kit.id,  # type: ignore[arg-type]
                producto_componente_id=componente_id,
                cantidad=cantidad,
            )
        )
    if commit:
        session.commit()
    else:
        session.flush()
    return listar_receta(session, kit)


def expandir_kit(
    session: Session,
    *,
    kit: Producto,
    cantidad_kits: Decimal,
) -> ExpansionOut:
    if cantidad_kits <= 0:
        raise HTTPException(status_code=400, detail="cantidad debe ser > 0")

    receta = listar_receta(session, kit)
    if not receta.componentes:
        raise HTTPException(
            status_code=400,
            detail="El kit no tiene receta configurada",
        )

    return ExpansionOut(
        producto_kit_id=kit.id,  # type: ignore[arg-type]
        kit_nombre=kit.nombre,
        cantidad_kits=cantidad_kits,
        componentes=[
            ExpansionItemOut(
                producto_id=item.producto_componente_id,
                nombre=item.componente_nombre,
                codigo_barras=item.componente_codigo_barras,
                cantidad=(item.cantidad * cantidad_kits).quantize(Decimal("0.01")),
            )
            for item in receta.componentes
        ],
    )
