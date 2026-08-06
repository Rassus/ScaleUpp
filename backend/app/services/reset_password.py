from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import Session, col, select

from app.core.security import hash_password
from app.models import Usuario
from app.models.enums import EstadoResetPassword, utcnow
from app.models.reset_password import SolicitudResetPassword
from app.schemas.reset_password import (
    OlvidePasswordOut,
    ResetPasswordOut,
    ResetPasswordResolverIn,
)


def _to_out(row: SolicitudResetPassword, usuario: Usuario) -> ResetPasswordOut:
    return ResetPasswordOut(
        id=row.id,  # type: ignore[arg-type]
        usuario_id=row.usuario_id,
        email=row.email,
        usuario_nombre=usuario.nombre,
        estado=row.estado,
        nota_admin=row.nota_admin,
        creado_en=row.creado_en,
        resuelto_en=row.resuelto_en,
    )


def solicitar_reset(session: Session, email: str) -> OlvidePasswordOut:
    """No revela si el email existe. Idempotente si ya hay una PENDIENTE."""
    out = OlvidePasswordOut()
    email_norm = email.strip().lower()
    usuario = session.exec(
        select(Usuario).where(Usuario.email == email_norm)
    ).first()
    if usuario is None or not usuario.activo:
        return out

    pendiente = session.exec(
        select(SolicitudResetPassword).where(
            SolicitudResetPassword.usuario_id == usuario.id,
            SolicitudResetPassword.estado == EstadoResetPassword.PENDIENTE,
        )
    ).first()
    if pendiente is not None:
        return out

    session.add(
        SolicitudResetPassword(
            usuario_id=usuario.id,  # type: ignore[arg-type]
            email=usuario.email,
            estado=EstadoResetPassword.PENDIENTE,
        )
    )
    session.commit()
    return out


def listar_resets(
    session: Session, *, solo_pendientes: bool = False
) -> list[ResetPasswordOut]:
    q = (
        select(SolicitudResetPassword, Usuario)
        .join(Usuario, Usuario.id == SolicitudResetPassword.usuario_id)
        .order_by(col(SolicitudResetPassword.creado_en).desc())
    )
    if solo_pendientes:
        q = q.where(
            SolicitudResetPassword.estado == EstadoResetPassword.PENDIENTE
        )
    rows = session.exec(q).all()
    return [_to_out(s, u) for s, u in rows]


def resolver_reset(
    session: Session,
    solicitud_id: int,
    body: ResetPasswordResolverIn,
    *,
    admin_id: int,
) -> ResetPasswordOut:
    row = session.get(SolicitudResetPassword, solicitud_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if row.estado != EstadoResetPassword.PENDIENTE:
        raise HTTPException(
            status_code=400, detail="La solicitud ya fue atendida"
        )

    usuario = session.get(Usuario, row.usuario_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if body.accion == "RECHAZAR":
        row.estado = EstadoResetPassword.RECHAZADO
        row.nota_admin = body.nota
        row.resuelto_por_id = admin_id
        row.resuelto_en = utcnow()
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_out(row, usuario)

    # RESOLVER
    assert body.password is not None
    usuario.password_hash = hash_password(body.password)
    usuario.debe_cambiar_password = True
    row.estado = EstadoResetPassword.RESUELTO
    row.nota_admin = body.nota
    row.resuelto_por_id = admin_id
    row.resuelto_en = utcnow()
    session.add(usuario)
    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_out(row, usuario)


def contar_pendientes(session: Session) -> int:
    from sqlmodel import func

    n = session.exec(
        select(func.count())
        .select_from(SolicitudResetPassword)
        .where(SolicitudResetPassword.estado == EstadoResetPassword.PENDIENTE)
    ).one()
    return int(n or 0)
