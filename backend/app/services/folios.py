"""Folios consecutivos visibles al usuario (no el id de BD)."""

from sqlmodel import Session, func, select


def siguiente_numero(
    session: Session,
    *,
    model: type,
    negocio_id: int,
) -> int:
    """Siguiente entero para `model.numero` dentro del negocio."""
    actual = session.exec(
        select(func.coalesce(func.max(model.numero), 0)).where(
            model.negocio_id == negocio_id
        )
    ).one()
    return int(actual) + 1


def siguiente_numero_venta_caja(session: Session, *, caja_id: int) -> int:
    """Siguiente orden dentro de un turno de caja (cada caja parte en 1)."""
    from app.models.venta import Venta

    actual = session.exec(
        select(func.coalesce(func.max(Venta.numero), 0)).where(
            Venta.caja_chica_id == caja_id
        )
    ).one()
    return int(actual) + 1
