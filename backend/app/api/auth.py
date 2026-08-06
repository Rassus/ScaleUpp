from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import CurrentContext, get_current_context, get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_login_password,
    verify_password,
)
from app.db import get_session
from app.models import Membresia, Negocio, Usuario
from app.models.enums import RolMembresia
from app.schemas.admin import AdminOnboardIn, AdminOwnerIn
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MembresiaOut,
    RefreshRequest,
    RegistroNegocioIn,
    RegistroNegocioOut,
    TokenResponse,
    UsuarioMe,
)
from app.schemas.reset_password import OlvidePasswordIn, OlvidePasswordOut
from app.services import admin as admin_service
from app.services import reset_password as reset_service

router = APIRouter(prefix="/auth", tags=["auth"])

_MSG_PENDIENTE = "Tu negocio está pendiente de aprobación por ScaleUpp"


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
        debe_cambiar_password=usuario.debe_cambiar_password,
        negocio_id=negocio_id,
        rol=rol,
    )


def _membresias_con_negocio_activo(
    session: Session, usuario_id: int
) -> list[tuple[Membresia, Negocio]]:
    return list(
        session.exec(
            select(Membresia, Negocio)
            .join(Negocio, Negocio.id == Membresia.negocio_id)
            .where(
                Membresia.usuario_id == usuario_id,
                Membresia.activo == True,  # noqa: E712
                Negocio.activo == True,  # noqa: E712
            )
        ).all()
    )


def _raise_si_solo_pendiente(session: Session, usuario: Usuario) -> None:
    """Si el usuario solo tiene negocios inactivos, 403 pendiente."""
    if usuario.es_platform_admin:
        return
    activas = _membresias_con_negocio_activo(session, usuario.id)  # type: ignore[arg-type]
    if activas:
        return
    pendientes = session.exec(
        select(Membresia, Negocio)
        .join(Negocio, Negocio.id == Membresia.negocio_id)
        .where(
            Membresia.usuario_id == usuario.id,
            Membresia.activo == True,  # noqa: E712
            Negocio.activo == False,  # noqa: E712
        )
    ).first()
    if pendientes is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_MSG_PENDIENTE,
        )


@router.post(
    "/registro-negocio",
    response_model=RegistroNegocioOut,
    status_code=status.HTTP_201_CREATED,
)
def registro_negocio(
    body: RegistroNegocioIn,
    session: Annotated[Session, Depends(get_session)],
) -> RegistroNegocioOut:
    onboard = AdminOnboardIn(
        nombre=body.nombre,
        slug=body.slug,
        comuna=body.comuna,
        owner=AdminOwnerIn(
            email=str(body.owner_email).lower(),
            nombre=body.owner_nombre,
            password=body.password,
        ),
        crear_cuota=False,
        activo=False,
    )
    out = admin_service.registro_negocio_publico(session, onboard)
    return RegistroNegocioOut(
        negocio_id=out.negocio.id,
        negocio_nombre=out.negocio.nombre,
        owner_email=out.owner_email,
    )


@router.post("/olvide-password", response_model=OlvidePasswordOut)
def olvide_password(
    body: OlvidePasswordIn,
    session: Annotated[Session, Depends(get_session)],
) -> OlvidePasswordOut:
    return reset_service.solicitar_reset(session, str(body.email))


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
    if not verify_login_password(body.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    negocio_id: Optional[int] = body.negocio_id
    rol = None

    if negocio_id is not None:
        negocio = session.get(Negocio, negocio_id)
        if negocio is None or not negocio.activo:
            if usuario.es_platform_admin:
                negocio_id = None
            elif negocio is not None and not negocio.activo:
                # ¿El usuario pertenece a este negocio pendiente?
                mem = session.exec(
                    select(Membresia).where(
                        Membresia.usuario_id == usuario.id,
                        Membresia.negocio_id == negocio_id,
                        Membresia.activo == True,  # noqa: E712
                    )
                ).first()
                if mem is not None:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=_MSG_PENDIENTE,
                    )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Negocio no encontrado",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Negocio no encontrado",
                )
        elif not usuario.es_platform_admin:
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
        activas = _membresias_con_negocio_activo(session, usuario.id)  # type: ignore[arg-type]
        if len(activas) == 1:
            negocio_id = activas[0][0].negocio_id
            rol = activas[0][0].rol
        elif len(activas) == 0:
            _raise_si_solo_pendiente(session, usuario)

    return _token_response(usuario, negocio_id=negocio_id, rol=rol)


@router.post("/change-password", response_model=UsuarioMe)
def change_password(
    body: ChangePasswordRequest,
    usuario: Annotated[Usuario, Depends(get_current_user)],
    ctx: Annotated[CurrentContext, Depends(get_current_context)],
    session: Annotated[Session, Depends(get_session)],
) -> UsuarioMe:
    if not verify_password(body.password_actual, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual no es correcta",
        )
    usuario.password_hash = hash_password(body.password_nueva)
    usuario.debe_cambiar_password = False
    session.add(usuario)
    session.commit()
    session.refresh(usuario)

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
            negocio_comuna=n.comuna,
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
        debe_cambiar_password=usuario.debe_cambiar_password,
        negocio_activo_id=ctx.negocio.id if ctx.negocio else None,
        rol_activo=ctx.rol,
        membresias=membresias,
    )


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
        negocio = session.get(Negocio, negocio_id)
        if negocio is None or not negocio.activo:
            if negocio is not None and not negocio.activo:
                mem = session.exec(
                    select(Membresia).where(
                        Membresia.usuario_id == usuario.id,
                        Membresia.negocio_id == negocio_id,
                        Membresia.activo == True,  # noqa: E712
                    )
                ).first()
                if mem is not None:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=_MSG_PENDIENTE,
                    )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a este negocio",
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
        rol = membresia.rol

    return _token_response(usuario, negocio_id=negocio_id, rol=rol)


@router.get("/me", response_model=UsuarioMe)
def me(
    usuario: Annotated[Usuario, Depends(get_current_user)],
    ctx: Annotated[CurrentContext, Depends(get_current_context)],
    session: Annotated[Session, Depends(get_session)],
) -> UsuarioMe:
    rows = _membresias_con_negocio_activo(session, usuario.id)  # type: ignore[arg-type]

    membresias = [
        MembresiaOut(
            id=m.id,  # type: ignore[arg-type]
            negocio_id=m.negocio_id,
            negocio_nombre=n.nombre,
            negocio_comuna=n.comuna,
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
        debe_cambiar_password=usuario.debe_cambiar_password,
        negocio_activo_id=ctx.negocio.id if ctx.negocio else None,
        rol_activo=ctx.rol,
        membresias=membresias,
    )
