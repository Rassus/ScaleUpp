from dataclasses import dataclass
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.core.security import decode_access_token
from app.db import get_session
from app.models import Membresia, Negocio, Usuario
from app.models.enums import RolMembresia

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentContext:
    usuario: Usuario
    negocio: Optional[Negocio]
    rol: Optional[RolMembresia]
    membresia: Optional[Membresia]


def get_current_user(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)
    ],
    session: Annotated[Session, Depends(get_session)],
) -> Usuario:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    usuario = session.get(Usuario, user_id)
    if usuario is None or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo o inexistente",
        )
    return usuario


def get_current_context(
    usuario: Annotated[Usuario, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)
    ],
    x_negocio_id: Annotated[Optional[int], Header(alias="X-Negocio-Id")] = None,
) -> CurrentContext:
    negocio_id = x_negocio_id
    rol_token: Optional[str] = None

    if credentials is not None:
        try:
            payload = decode_access_token(credentials.credentials)
            if negocio_id is None and payload.get("negocio_id") is not None:
                negocio_id = int(payload["negocio_id"])
            rol_token = payload.get("rol")
        except ValueError:
            pass

    if negocio_id is None:
        return CurrentContext(
            usuario=usuario, negocio=None, rol=None, membresia=None
        )

    negocio = session.get(Negocio, negocio_id)
    if negocio is None or not negocio.activo:
        # Platform admin puede operar sin negocio (panel admin)
        if usuario.es_platform_admin:
            return CurrentContext(
                usuario=usuario, negocio=None, rol=None, membresia=None
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negocio no encontrado o inactivo",
        )

    if usuario.es_platform_admin:
        rol = RolMembresia(rol_token) if rol_token else RolMembresia.OWNER
        return CurrentContext(
            usuario=usuario, negocio=negocio, rol=rol, membresia=None
        )

    membresia = session.exec(
        select(Membresia).where(
            Membresia.usuario_id == usuario.id,
            Membresia.negocio_id == negocio_id,
            Membresia.activo == True,  # noqa: E712
        )
    ).first()
    if membresia is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este negocio",
        )

    return CurrentContext(
        usuario=usuario,
        negocio=negocio,
        rol=membresia.rol,
        membresia=membresia,
    )


def require_platform_admin(
    ctx: Annotated[CurrentContext, Depends(get_current_context)],
) -> CurrentContext:
    if not ctx.usuario.es_platform_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere platform_admin",
        )
    return ctx


def require_negocio(
    ctx: Annotated[CurrentContext, Depends(get_current_context)],
) -> CurrentContext:
    if ctx.negocio is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes indicar un negocio (login con negocio_id o header X-Negocio-Id)",
        )
    return ctx


def require_negocio_write(
    ctx: Annotated[CurrentContext, Depends(require_negocio)],
) -> CurrentContext:
    """Altas/edición de catálogo: owner o platform_admin."""
    if ctx.usuario.es_platform_admin:
        return ctx
    if ctx.rol != RolMembresia.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol owner para modificar el catálogo",
        )
    return ctx
