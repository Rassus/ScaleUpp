from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.deps import CurrentContext, require_negocio_write, require_platform_admin
from app.db import get_session
from app.models.enums import EstadoTicket
from app.schemas.ticket import TicketAdminUpdate, TicketCreate, TicketOut
from app.services import ticket as ticket_service

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("", response_model=list[TicketOut])
def listar(
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> list[TicketOut]:
    return ticket_service.listar_tickets_negocio(
        session, negocio_id=ctx.negocio.id  # type: ignore[arg-type]
    )


@router.post("", response_model=TicketOut, status_code=201)
def crear(
    body: TicketCreate,
    ctx: Annotated[CurrentContext, Depends(require_negocio_write)],
    session: Annotated[Session, Depends(get_session)],
) -> TicketOut:
    return ticket_service.crear_ticket(
        session,
        negocio_id=ctx.negocio.id,  # type: ignore[arg-type]
        usuario_id=ctx.usuario.id,  # type: ignore[arg-type]
        body=body,
    )


admin_tickets_router = APIRouter(prefix="/admin/tickets", tags=["admin-tickets"])


@admin_tickets_router.get("", response_model=list[TicketOut])
def listar_admin(
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    estado: Annotated[Optional[EstadoTicket], Query()] = None,
) -> list[TicketOut]:
    return ticket_service.listar_tickets_admin(session, estado=estado)


@admin_tickets_router.patch("/{ticket_id}", response_model=TicketOut)
def patch_admin(
    ticket_id: int,
    body: TicketAdminUpdate,
    ctx: Annotated[CurrentContext, Depends(require_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> TicketOut:
    return ticket_service.actualizar_ticket_admin(session, ticket_id, body)
