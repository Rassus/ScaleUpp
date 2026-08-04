"""Tickets de soporte: desuscripción y alta de negocio extra (+$2.990)."""

from __future__ import annotations

import re
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import Session, col, select

from app.models import Membresia, Negocio, Usuario
from app.models.enums import (
    EstadoPagoPlataforma,
    EstadoTicket,
    RolMembresia,
    TipoTicket,
    utcnow,
)
from app.models.pago_plataforma import PagoPlataforma
from app.models.ticket import TicketSoporte
from app.schemas.ticket import TicketAdminUpdate, TicketCreate, TicketOut
from app.services import admin as admin_service


def _slugify(nombre: str) -> str:
    s = (
        nombre.lower()
        .strip()
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"^-|-$", "", s)
    return s[:80] or "negocio"


def _ticket_out(session: Session, t: TicketSoporte) -> TicketOut:
    negocio = session.get(Negocio, t.negocio_id)
    usuario = session.get(Usuario, t.usuario_id)
    cfg = admin_service.get_or_create_config(session)
    extra = (
        cfg.cuota_negocio_extra_clp
        if t.tipo == TipoTicket.NUEVO_NEGOCIO
        else None
    )
    return TicketOut(
        id=t.id,  # type: ignore[arg-type]
        negocio_id=t.negocio_id,
        negocio_nombre=negocio.nombre if negocio else "—",
        usuario_id=t.usuario_id,
        usuario_email=usuario.email if usuario else "—",
        usuario_nombre=usuario.nombre if usuario else "—",
        tipo=t.tipo,
        estado=t.estado,
        mensaje=t.mensaje,
        nombre_negocio_solicitado=t.nombre_negocio_solicitado,
        slug_negocio_solicitado=t.slug_negocio_solicitado,
        comuna_negocio_solicitado=t.comuna_negocio_solicitado,
        negocio_creado_id=t.negocio_creado_id,
        respuesta_admin=t.respuesta_admin,
        creado_en=t.creado_en,
        resuelto_en=t.resuelto_en,
        costo_extra_mensual_clp=extra,
    )


def crear_ticket(
    session: Session,
    *,
    negocio_id: int,
    usuario_id: int,
    body: TicketCreate,
) -> TicketOut:
    existentes = session.exec(
        select(TicketSoporte).where(
            TicketSoporte.negocio_id == negocio_id,
            TicketSoporte.usuario_id == usuario_id,
            TicketSoporte.tipo == body.tipo,
        )
    ).all()
    abierto = next(
        (
            x
            for x in existentes
            if x.estado in (EstadoTicket.ABIERTO, EstadoTicket.EN_PROCESO)
        ),
        None,
    )
    if abierto is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya tienes un ticket abierto de este tipo",
        )

    slug: Optional[str] = None
    nombre: Optional[str] = None
    comuna: Optional[str] = None
    if body.tipo == TipoTicket.NUEVO_NEGOCIO:
        nombre = body.nombre_negocio.strip() if body.nombre_negocio else None
        comuna = body.comuna.strip() if body.comuna else None
        slug = (
            body.slug_negocio.strip().lower()
            if body.slug_negocio
            else _slugify(nombre or "")
        )
        if session.exec(select(Negocio).where(Negocio.slug == slug)).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un negocio con ese slug; elige otro nombre",
            )

    ticket = TicketSoporte(
        negocio_id=negocio_id,
        usuario_id=usuario_id,
        tipo=body.tipo,
        estado=EstadoTicket.ABIERTO,
        mensaje=body.mensaje.strip() if body.mensaje else None,
        nombre_negocio_solicitado=nombre,
        slug_negocio_solicitado=slug,
        comuna_negocio_solicitado=comuna,
    )
    session.add(ticket)
    session.commit()
    session.refresh(ticket)
    return _ticket_out(session, ticket)


def listar_tickets_negocio(
    session: Session, *, negocio_id: int
) -> list[TicketOut]:
    rows = session.exec(
        select(TicketSoporte)
        .where(TicketSoporte.negocio_id == negocio_id)
        .order_by(col(TicketSoporte.creado_en).desc())
    ).all()
    return [_ticket_out(session, t) for t in rows]


def listar_tickets_admin(
    session: Session, *, estado: Optional[EstadoTicket] = None
) -> list[TicketOut]:
    q = select(TicketSoporte)
    if estado is not None:
        q = q.where(TicketSoporte.estado == estado)
    rows = session.exec(
        q.order_by(col(TicketSoporte.creado_en).desc())
    ).all()
    return [_ticket_out(session, t) for t in rows]


def _aprobar_nuevo_negocio(session: Session, ticket: TicketSoporte) -> Negocio:
    nombre = (ticket.nombre_negocio_solicitado or "").strip()
    if not nombre:
        raise HTTPException(
            status_code=400, detail="El ticket no tiene nombre de negocio"
        )
    slug = (ticket.slug_negocio_solicitado or _slugify(nombre)).lower()
    if session.exec(select(Negocio).where(Negocio.slug == slug)).first():
        # sufijo único
        base = slug[:70]
        for i in range(2, 100):
            candidate = f"{base}-{i}"
            if not session.exec(
                select(Negocio).where(Negocio.slug == candidate)
            ).first():
                slug = candidate
                break

    negocio = Negocio(
        nombre=nombre,
        slug=slug,
        comuna=(ticket.comuna_negocio_solicitado or "").strip() or None,
        activo=True,
    )
    session.add(negocio)
    session.flush()

    session.add(
        Membresia(
            usuario_id=ticket.usuario_id,
            negocio_id=negocio.id,  # type: ignore[arg-type]
            rol=RolMembresia.OWNER,
            activo=True,
        )
    )
    admin_service._bootstrap_catalogo(session, negocio.id)  # type: ignore[arg-type]

    cfg = admin_service.get_or_create_config(session)
    cuota = cfg.cuota_negocio_extra_clp
    inicio, fin = admin_service._periodo_resto_mes()
    pror = admin_service.calcular_prorrateo(cuota, inicio, fin)
    session.add(
        PagoPlataforma(
            negocio_id=negocio.id,  # type: ignore[arg-type]
            monto=pror.monto_prorrateado,
            periodo_inicio=inicio,
            periodo_fin=fin,
            estado=EstadoPagoPlataforma.PENDIENTE,
            nota=(
                f"Add-on negocio extra +${cuota}/mes "
                f"(prorrateo: {pror.formula})"
            ),
            monto_mensual_ref=cuota,
            dias_usados=pror.dias_usados,
            dias_base=pror.dias_base,
        )
    )
    ticket.negocio_creado_id = negocio.id
    return negocio


def actualizar_ticket_admin(
    session: Session, ticket_id: int, body: TicketAdminUpdate
) -> TicketOut:
    ticket = session.get(TicketSoporte, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    if ticket.estado in (EstadoTicket.RESUELTO, EstadoTicket.RECHAZADO):
        raise HTTPException(
            status_code=400, detail="El ticket ya está cerrado"
        )

    nuevo = body.estado
    ticket.estado = nuevo
    if body.respuesta_admin is not None:
        ticket.respuesta_admin = body.respuesta_admin.strip() or None

    if nuevo == EstadoTicket.RESUELTO:
        ticket.resuelto_en = utcnow()
        if ticket.tipo == TipoTicket.DESUSCRIPCION:
            negocio = session.get(Negocio, ticket.negocio_id)
            if negocio is not None:
                negocio.activo = False
                session.add(negocio)
                if not ticket.respuesta_admin:
                    ticket.respuesta_admin = (
                        "Plan desuscrito: negocio suspendido."
                    )
        elif ticket.tipo == TipoTicket.NUEVO_NEGOCIO:
            creado = _aprobar_nuevo_negocio(session, ticket)
            if not ticket.respuesta_admin:
                cfg = admin_service.get_or_create_config(session)
                ticket.respuesta_admin = (
                    f"Negocio «{creado.nombre}» creado. "
                    f"Se suma ${cfg.cuota_negocio_extra_clp}/mes al plan."
                )
    elif nuevo == EstadoTicket.RECHAZADO:
        ticket.resuelto_en = utcnow()

    session.add(ticket)
    session.commit()
    session.refresh(ticket)
    return _ticket_out(session, ticket)
