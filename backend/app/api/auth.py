from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import CurrentContext, get_current_context, get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.db import get_session
from app.models import Membresia, Negocio, Usuario
from app.models.enums import RolMembresia
from app.schemas.auth import (
    LoginRequest,
    MembresiaOut,
    RefreshRequest,
    TokenResponse,
    UsuarioMe,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(
    usuario: Usuario,
    *,
    negocio_id: Optional[int],
    rol: Optional[RolMembresia],
) -> TokenResponse:
    rol_value = rol.value if rol else None
    access = create_access_token(
        subject=str(usuario.id),
        es_platform_admin=usuario.es_platform_admin,
        negocio_id=negocio_id,
        rol=rol_value,
    )
    refresh = create_refresh_token(
        subject=str(usuario.id),
        es_platform_admin=usuario.es_platform_admin,
        negocio_id=negocio_id,
        rol=rol_value,
    )
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        usuario_id=usuario.id,  # type: ignore[arg-type]
        email=usuario.email,
        nombre=usuario.nombre,
        es_platform_admin=usuario.es_platform_admin,
        negocio_id=negocio_id,
        rol=rol,
    )


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    session: Annotated[Session, Depends(get_session)],
) -> TokenResponse:
    usuario = session.exec(
        select(Usuario).where(Usuario.email == body.email.lower())
    ).first()
    if usuario is None or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    if not verify_password(body.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    negocio_id: Optional[int] = body.negocio_id
    rol = None

    if negocio_id is not None:
        negocio = session.get(Negocio, negocio_id)
        if negocio is None or not negocio.activo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Negocio no encontrado",
            )
        if not usuario.es_platform_admin:
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
            rol = membresia.rol
        else:
            rol = None
    elif not usuario.es_platform_admin:
        membresias = session.exec(
            select(Membresia).where(
                Membresia.usuario_id == usuario.id,
                Membresia.activo == True,  # noqa: E712
            )
        ).all()
        if len(membresias) == 1:
            negocio_id = membresias[0].negocio_id
            rol = membresias[0].rol

    return _token_response(usuario, negocio_id=negocio_id, rol=rol)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    body: RefreshRequest,
    session: Annotated[Session, Depends(get_session)],
) -> TokenResponse:
    try:
        payload = decode_token(body.refresh_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado",
        ) from exc
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        )
    try:
        usuario_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        ) from exc

    usuario = session.get(Usuario, usuario_id)
    if usuario is None or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no disponible",
        )

    negocio_id = payload.get("negocio_id")
    rol_raw = payload.get("rol")
    rol: Optional[RolMembresia] = None
    if rol_raw:
        try:
            rol = RolMembresia(rol_raw)
        except ValueError:
            rol = None

    if negocio_id is not None and not usuario.es_platform_admin:
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
        rol = membresia.rol

    return _token_response(usuario, negocio_id=negocio_id, rol=rol)


@router.get("/me", response_model=UsuarioMe)
def me(
    usuario: Annotated[Usuario, Depends(get_current_user)],
    ctx: Annotated[CurrentContext, Depends(get_current_context)],
    session: Annotated[Session, Depends(get_session)],
) -> UsuarioMe:
    rows = session.exec(
        select(Membresia, Negocio)
        .join(Negocio, Negocio.id == Membresia.negocio_id)
        .where(
            Membresia.usuario_id == usuario.id,
            Membresia.activo == True,  # noqa: E712
        )
    ).all()

    membresias = [
        MembresiaOut(
            id=m.id,  # type: ignore[arg-type]
            negocio_id=m.negocio_id,
            negocio_nombre=n.nombre,
            rol=m.rol,
            activo=m.activo,
        )
        for m, n in rows
    ]

    return UsuarioMe(
        id=usuario.id,  # type: ignore[arg-type]
        email=usuario.email,
        nombre=usuario.nombre,
        es_platform_admin=usuario.es_platform_admin,
        activo=usuario.activo,
        negocio_activo_id=ctx.negocio.id if ctx.negocio else None,
        rol_activo=ctx.rol,
        membresias=membresias,
    )
