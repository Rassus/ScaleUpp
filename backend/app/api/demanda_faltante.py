from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, func, select

from app.api.deps import CurrentContext, require_negocio
from app.db import get_session
from app.models import Producto
from app.models.demanda_faltante import DemandaFaltante
from app.schemas.demanda_faltante import (
    DemandaFaltanteBatchIn,
    DemandaFaltanteOut,
    DemandaFaltanteResumenProducto,
)

router = APIRouter(prefix="/demanda-faltante", tags=["demanda-faltante"])


@router.post("", response_model=list[DemandaFaltanteOut], status_code=201)
def registrar_faltantes(
    body: DemandaFaltanteBatchIn,
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> list[DemandaFaltanteOut]:
    """Cualquier miembro del negocio (igual que ventas) puede registrar demanda faltante."""
    negocio_id = ctx.negocio.id  # type: ignore[arg-type]
    out: list[DemandaFaltanteOut] = []
    for item in body.items:
        prod = session.get(Producto, item.producto_id)
        if prod is None or prod.negocio_id != negocio_id or not prod.activo:
            continue
        row = DemandaFaltante(
            negocio_id=negocio_id,
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_ref=item.precio_ref,
            usuario_id=ctx.usuario.id,
            caja_chica_id=body.caja_chica_id,
        )
        session.add(row)
        session.flush()
        out.append(
            DemandaFaltanteOut(
                id=row.id,  # type: ignore[arg-type]
                producto_id=prod.id,  # type: ignore[arg-type]
                producto_nombre=prod.nombre,
                cantidad=row.cantidad,
                precio_ref=row.precio_ref,
                monto_ref=int(round(float(row.cantidad) * row.precio_ref)),
                creado_en=row.creado_en,
            )
        )
    if not out:
        raise HTTPException(
            status_code=400,
            detail="No se pudo registrar ningún producto faltante",
        )
    session.commit()
    return out


@router.get("", response_model=list[DemandaFaltanteOut])
def listar_faltantes(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[DemandaFaltanteOut]:
    negocio_id = ctx.negocio.id  # type: ignore[arg-type]
    rows = session.exec(
        select(DemandaFaltante, Producto)
        .join(Producto, Producto.id == DemandaFaltante.producto_id)
        .where(DemandaFaltante.negocio_id == negocio_id)
        .order_by(col(DemandaFaltante.creado_en).desc())
        .limit(limit)
    ).all()
    return [
        DemandaFaltanteOut(
            id=d.id,  # type: ignore[arg-type]
            producto_id=p.id,  # type: ignore[arg-type]
            producto_nombre=p.nombre,
            cantidad=d.cantidad,
            precio_ref=d.precio_ref,
            monto_ref=int(round(float(d.cantidad) * d.precio_ref)),
            creado_en=d.creado_en,
        )
        for d, p in rows
    ]


@router.get("/resumen", response_model=list[DemandaFaltanteResumenProducto])
def resumen_faltantes(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
    session: Annotated[Session, Depends(get_session)],
) -> list[DemandaFaltanteResumenProducto]:
    negocio_id = ctx.negocio.id  # type: ignore[arg-type]
    rows = session.exec(
        select(
            DemandaFaltante.producto_id,
            Producto.nombre,
            func.count(DemandaFaltante.id),
            func.coalesce(func.sum(DemandaFaltante.cantidad), 0),
            func.coalesce(
                func.sum(DemandaFaltante.cantidad * DemandaFaltante.precio_ref),
                0,
            ),
        )
        .join(Producto, Producto.id == DemandaFaltante.producto_id)
        .where(DemandaFaltante.negocio_id == negocio_id)
        .group_by(DemandaFaltante.producto_id, Producto.nombre)
        .order_by(func.count(DemandaFaltante.id).desc())
    ).all()
    return [
        DemandaFaltanteResumenProducto(
            producto_id=pid,  # type: ignore[arg-type]
            producto_nombre=nombre,
            veces=int(veces),
            cantidad_total=Decimal(str(cant)),
            monto_ref_total=int(round(float(monto))),
        )
        for pid, nombre, veces, cant, monto in rows
    ]
