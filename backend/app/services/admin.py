from calendar import monthrange
from datetime import date, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import Session, col, func, select

from app.core.security import hash_password
from app.models import Categoria, Membresia, Negocio, UnidadMedida, Usuario
from app.models.config_plataforma import ConfigPlataforma
from app.models.enums import EstadoPagoPlataforma, RolMembresia, utcnow
from app.models.pago_plataforma import PagoPlataforma
from app.catalog.categorias_default import CATEGORIAS_SUPERMERCADO
from app.schemas.admin import (
    AdminConfigOut,
    AdminConfigUpdate,
    AdminCuentaIn,
    AdminNegocioOut,
    AdminOnboardIn,
    AdminOnboardOut,
    AdminPagoCreate,
    AdminPagoOut,
    AdminPagoUpdate,
    AdminProrrateoIn,
    AdminProrrateoOut,
    AdminRecaudacionMes,
    AdminResumenOut,
    AdminUsuarioOut,
)


def calcular_prorrateo(
    cuota_mensual: int, inicio: date, fin: date
) -> AdminProrrateoOut:
    """Monto = cuota_mensual × días_usados / días_base.

    días_base = días del mes calendario del inicio (si el periodo cae en un
    solo mes); si cruza meses, se usa 30 (mes comercial).
    """
    if fin < inicio:
        raise HTTPException(status_code=400, detail="periodo_fin inválido")
    dias_usados = (fin - inicio).days + 1
    if inicio.year == fin.year and inicio.month == fin.month:
        dias_base = monthrange(inicio.year, inicio.month)[1]
    else:
        dias_base = 30
    cuota_diaria = cuota_mensual / dias_base if dias_base else 0
    monto = int(round(cuota_mensual * dias_usados / dias_base)) if dias_base else 0
    return AdminProrrateoOut(
        periodo_inicio=inicio,
        periodo_fin=fin,
        dias_usados=dias_usados,
        dias_base=dias_base,
        cuota_mensual_clp=cuota_mensual,
        cuota_diaria=round(cuota_diaria, 2),
        monto_prorrateado=monto,
        formula=(
            f"{cuota_mensual} × {dias_usados}/{dias_base} = {monto} CLP"
        ),
    )


def get_or_create_config(session: Session) -> ConfigPlataforma:
    cfg = session.get(ConfigPlataforma, 1)
    if cfg is None:
        cfg = ConfigPlataforma(
            id=1,
            nombre_plan="ScaleUpp Negocio",
            cuota_mensual_clp=29990,
            cuota_negocio_extra_clp=2990,
            dias_gracia=5,
            dia_facturacion=1,
            activo=True,
        )
        session.add(cfg)
        session.commit()
        session.refresh(cfg)
    return cfg


def config_out(cfg: ConfigPlataforma) -> AdminConfigOut:
    dias = 30
    diaria = int(round(cfg.cuota_mensual_clp / dias)) if dias else 0
    return AdminConfigOut(
        id=cfg.id,  # type: ignore[arg-type]
        nombre_plan=cfg.nombre_plan,
        cuota_mensual_clp=cfg.cuota_mensual_clp,
        cuota_negocio_extra_clp=cfg.cuota_negocio_extra_clp,
        dias_gracia=cfg.dias_gracia,
        dia_facturacion=cfg.dia_facturacion,
        activo=cfg.activo,
        actualizado_en=cfg.actualizado_en,
        cuota_diaria_aprox=diaria,
    )


def obtener_config(session: Session) -> AdminConfigOut:
    return config_out(get_or_create_config(session))


def actualizar_config(
    session: Session, body: AdminConfigUpdate
) -> AdminConfigOut:
    cfg = get_or_create_config(session)
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(cfg, key, value)
    cfg.actualizado_en = utcnow()
    session.add(cfg)
    session.commit()
    session.refresh(cfg)
    return config_out(cfg)


def preview_prorrateo(
    session: Session, body: AdminProrrateoIn
) -> AdminProrrateoOut:
    cfg = get_or_create_config(session)
    cuota = (
        body.cuota_mensual_clp
        if body.cuota_mensual_clp is not None
        else cfg.cuota_mensual_clp
    )
    return calcular_prorrateo(cuota, body.periodo_inicio, body.periodo_fin)


def _periodo_resto_mes(hoy: Optional[date] = None) -> tuple[date, date]:
    hoy = hoy or date.today()
    ultimo = monthrange(hoy.year, hoy.month)[1]
    return hoy, hoy.replace(day=ultimo)


def _enrich_negocio(session: Session, negocio: Negocio) -> AdminNegocioOut:
    num_usuarios = session.exec(
        select(func.count())
        .select_from(Membresia)
        .where(Membresia.negocio_id == negocio.id)
    ).one()
    pendientes = session.exec(
        select(func.count())
        .select_from(PagoPlataforma)
        .where(
            PagoPlataforma.negocio_id == negocio.id,
            PagoPlataforma.estado == EstadoPagoPlataforma.PENDIENTE,
        )
    ).one()
    vencidos = session.exec(
        select(func.count())
        .select_from(PagoPlataforma)
        .where(
            PagoPlataforma.negocio_id == negocio.id,
            PagoPlataforma.estado == EstadoPagoPlataforma.VENCIDO,
        )
    ).one()
    ultimo = session.exec(
        select(PagoPlataforma)
        .where(PagoPlataforma.negocio_id == negocio.id)
        .order_by(col(PagoPlataforma.periodo_fin).desc(), col(PagoPlataforma.id).desc())
    ).first()
    return AdminNegocioOut(
        id=negocio.id,  # type: ignore[arg-type]
        nombre=negocio.nombre,
        slug=negocio.slug,
        comuna=negocio.comuna,
        activo=negocio.activo,
        creado_en=negocio.creado_en,
        num_usuarios=int(num_usuarios or 0),
        pagos_pendientes=int(pendientes or 0),
        pagos_vencidos=int(vencidos or 0),
        ultimo_pago_estado=ultimo.estado.value if ultimo else None,
    )


def listar_negocios_admin(session: Session) -> list[AdminNegocioOut]:
    rows = session.exec(select(Negocio).order_by(Negocio.id)).all()
    return [_enrich_negocio(session, n) for n in rows]


def obtener_negocio_admin(session: Session, negocio_id: int) -> AdminNegocioOut:
    negocio = session.get(Negocio, negocio_id)
    if negocio is None:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    return _enrich_negocio(session, negocio)


def actualizar_negocio(
    session: Session,
    negocio_id: int,
    *,
    nombre: Optional[str] = None,
    comuna: Optional[str] = None,
    activo: Optional[bool] = None,
) -> AdminNegocioOut:
    negocio = session.get(Negocio, negocio_id)
    if negocio is None:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    if nombre is not None:
        negocio.nombre = nombre.strip()
    if comuna is not None:
        negocio.comuna = comuna.strip()
    if activo is not None:
        negocio.activo = activo
    session.add(negocio)
    session.commit()
    session.refresh(negocio)
    return _enrich_negocio(session, negocio)


def _bootstrap_catalogo(session: Session, negocio_id: int) -> None:
    unidades = [
        ("Unidad", "UND"),
        ("Kilogramo", "KG"),
        ("Litro", "L"),
        ("Caja", "CJ"),
        ("Paquete", "PQ"),
    ]
    for nombre, sigla in unidades:
        exists = session.exec(
            select(UnidadMedida).where(
                UnidadMedida.negocio_id == negocio_id,
                UnidadMedida.sigla == sigla,
            )
        ).first()
        if exists is None:
            session.add(
                UnidadMedida(negocio_id=negocio_id, nombre=nombre, sigla=sigla)
            )

    for nombre, descripcion in CATEGORIAS_SUPERMERCADO:
        exists = session.exec(
            select(Categoria).where(
                Categoria.negocio_id == negocio_id,
                Categoria.nombre == nombre,
            )
        ).first()
        if exists is None:
            session.add(
                Categoria(
                    negocio_id=negocio_id,
                    nombre=nombre,
                    descripcion=descripcion,
                )
            )
        elif exists.descripcion is None:
            exists.descripcion = descripcion
            session.add(exists)

def onboard_negocio(session: Session, body: AdminOnboardIn) -> AdminOnboardOut:
    slug = body.slug.lower().strip()
    if session.exec(select(Negocio).where(Negocio.slug == slug)).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un negocio con ese slug",
        )

    email = body.owner.email
    existing_user = session.exec(
        select(Usuario).where(Usuario.email == email)
    ).first()
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email",
        )

    negocio = Negocio(
        nombre=body.nombre.strip(),
        slug=slug,
        comuna=body.comuna.strip(),
        activo=True,
    )
    session.add(negocio)
    session.flush()

    owner = Usuario(
        email=email,
        nombre=body.owner.nombre.strip(),
        password_hash=hash_password(body.owner.password),
        es_platform_admin=False,
        debe_cambiar_password=True,
        activo=True,
    )
    session.add(owner)
    session.flush()

    session.add(
        Membresia(
            usuario_id=owner.id,  # type: ignore[arg-type]
            negocio_id=negocio.id,  # type: ignore[arg-type]
            rol=RolMembresia.OWNER,
            activo=True,
        )
    )
    _bootstrap_catalogo(session, negocio.id)  # type: ignore[arg-type]

    if body.crear_cuota:
        cfg = get_or_create_config(session)
        inicio, fin = _periodo_resto_mes()
        pror = calcular_prorrateo(cfg.cuota_mensual_clp, inicio, fin)
        session.add(
            PagoPlataforma(
                negocio_id=negocio.id,  # type: ignore[arg-type]
                monto=pror.monto_prorrateado,
                periodo_inicio=inicio,
                periodo_fin=fin,
                estado=EstadoPagoPlataforma.PENDIENTE,
                nota=f"Cuota inicial prorrateada ({pror.formula})",
                monto_mensual_ref=pror.cuota_mensual_clp,
                dias_usados=pror.dias_usados,
                dias_base=pror.dias_base,
            )
        )

    session.commit()
    session.refresh(negocio)
    session.refresh(owner)

    return AdminOnboardOut(
        negocio=_enrich_negocio(session, negocio),
        owner_email=owner.email,
        owner_id=owner.id,  # type: ignore[arg-type]
    )


def agregar_cuenta(
    session: Session, negocio_id: int, body: AdminCuentaIn
) -> AdminUsuarioOut:
    negocio = session.get(Negocio, negocio_id)
    if negocio is None:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")

    user = session.exec(
        select(Usuario).where(Usuario.email == body.email)
    ).first()
    if user is None:
        user = Usuario(
            email=body.email,
            nombre=body.nombre.strip(),
            password_hash=hash_password(body.password),
            es_platform_admin=False,
            debe_cambiar_password=True,
            activo=True,
        )
        session.add(user)
        session.flush()
    else:
        # Reutilizar usuario existente: actualizar password si se invita de nuevo
        user.nombre = body.nombre.strip()
        user.password_hash = hash_password(body.password)
        user.debe_cambiar_password = True
        user.activo = True
        session.add(user)

    mem = session.exec(
        select(Membresia).where(
            Membresia.usuario_id == user.id,
            Membresia.negocio_id == negocio_id,
        )
    ).first()
    if mem is None:
        mem = Membresia(
            usuario_id=user.id,  # type: ignore[arg-type]
            negocio_id=negocio_id,
            rol=body.rol,
            activo=True,
        )
        session.add(mem)
    else:
        mem.rol = body.rol
        mem.activo = True
        session.add(mem)

    session.commit()
    session.refresh(user)
    session.refresh(mem)
    return AdminUsuarioOut(
        id=user.id,  # type: ignore[arg-type]
        email=user.email,
        nombre=user.nombre,
        activo=user.activo,
        rol=mem.rol,
        membresia_activa=mem.activo,
    )


def listar_cuentas(session: Session, negocio_id: int) -> list[AdminUsuarioOut]:
    if session.get(Negocio, negocio_id) is None:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    rows = session.exec(
        select(Membresia, Usuario)
        .join(Usuario, Usuario.id == Membresia.usuario_id)
        .where(Membresia.negocio_id == negocio_id)
        .order_by(Usuario.email)
    ).all()
    out: list[AdminUsuarioOut] = []
    for mem, user in rows:
        out.append(
            AdminUsuarioOut(
                id=user.id,  # type: ignore[arg-type]
                email=user.email,
                nombre=user.nombre,
                activo=user.activo,
                rol=mem.rol,
                membresia_activa=mem.activo,
            )
        )
    return out


def _pago_out(session: Session, pago: PagoPlataforma) -> AdminPagoOut:
    negocio = session.get(Negocio, pago.negocio_id)
    return AdminPagoOut(
        id=pago.id,  # type: ignore[arg-type]
        negocio_id=pago.negocio_id,
        negocio_nombre=negocio.nombre if negocio else "—",
        negocio_activo=negocio.activo if negocio else False,
        monto=pago.monto,
        periodo_inicio=pago.periodo_inicio,
        periodo_fin=pago.periodo_fin,
        estado=pago.estado,
        nota=pago.nota,
        pagado_en=pago.pagado_en,
        creado_en=pago.creado_en,
        monto_mensual_ref=pago.monto_mensual_ref,
        dias_usados=pago.dias_usados,
        dias_base=pago.dias_base,
    )


def marcar_vencidos(session: Session) -> int:
    """Pasa PENDIENTE → VENCIDO si periodo_fin + gracia < hoy."""
    cfg = get_or_create_config(session)
    hoy = date.today()
    rows = session.exec(
        select(PagoPlataforma).where(
            PagoPlataforma.estado == EstadoPagoPlataforma.PENDIENTE,
        )
    ).all()
    changed = 0
    for p in rows:
        limite = p.periodo_fin + timedelta(days=cfg.dias_gracia)
        if limite < hoy:
            p.estado = EstadoPagoPlataforma.VENCIDO
            session.add(p)
            changed += 1
    if changed:
        session.commit()
    return changed


def listar_pagos(
    session: Session, *, negocio_id: Optional[int] = None
) -> list[AdminPagoOut]:
    marcar_vencidos(session)
    q = select(PagoPlataforma)
    if negocio_id is not None:
        q = q.where(PagoPlataforma.negocio_id == negocio_id)
    rows = session.exec(
        q.order_by(col(PagoPlataforma.periodo_fin).desc(), col(PagoPlataforma.id).desc())
    ).all()
    return [_pago_out(session, p) for p in rows]


def crear_pago(session: Session, body: AdminPagoCreate) -> AdminPagoOut:
    if session.get(Negocio, body.negocio_id) is None:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")

    cfg = get_or_create_config(session)
    monto_ref = cfg.cuota_mensual_clp
    dias_usados: Optional[int] = None
    dias_base: Optional[int] = None
    nota = body.nota

    if body.prorratear:
        pror = calcular_prorrateo(monto_ref, body.periodo_inicio, body.periodo_fin)
        monto = pror.monto_prorrateado
        dias_usados = pror.dias_usados
        dias_base = pror.dias_base
        if not nota:
            nota = f"Prorrateo ({pror.formula})"
    elif body.monto is not None:
        monto = body.monto
    else:
        raise HTTPException(
            status_code=400,
            detail="Indica monto o activa prorratear",
        )

    pago = PagoPlataforma(
        negocio_id=body.negocio_id,
        monto=monto,
        periodo_inicio=body.periodo_inicio,
        periodo_fin=body.periodo_fin,
        estado=body.estado,
        nota=nota,
        pagado_en=utcnow() if body.estado == EstadoPagoPlataforma.PAGADO else None,
        monto_mensual_ref=monto_ref,
        dias_usados=dias_usados,
        dias_base=dias_base,
    )
    session.add(pago)
    session.commit()
    session.refresh(pago)
    return _pago_out(session, pago)


def actualizar_pago(
    session: Session, pago_id: int, body: AdminPagoUpdate
) -> AdminPagoOut:
    pago = session.get(PagoPlataforma, pago_id)
    if pago is None:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    data = body.model_dump(exclude_unset=True)
    if "estado" in data and data["estado"] is not None:
        nuevo = data["estado"]
        pago.estado = nuevo
        if nuevo == EstadoPagoPlataforma.PAGADO and pago.pagado_en is None:
            pago.pagado_en = utcnow()
        if nuevo != EstadoPagoPlataforma.PAGADO:
            pago.pagado_en = None
    if "nota" in data:
        pago.nota = data["nota"]
    if "monto" in data and data["monto"] is not None:
        pago.monto = data["monto"]
    session.add(pago)
    session.commit()
    session.refresh(pago)
    return _pago_out(session, pago)


def resumen_admin(session: Session) -> AdminResumenOut:
    marcar_vencidos(session)
    activos = session.exec(
        select(func.count()).select_from(Negocio).where(Negocio.activo == True)  # noqa: E712
    ).one()
    suspendidos = session.exec(
        select(func.count()).select_from(Negocio).where(Negocio.activo == False)  # noqa: E712
    ).one()
    pend = session.exec(
        select(PagoPlataforma).where(
            PagoPlataforma.estado == EstadoPagoPlataforma.PENDIENTE
        )
    ).all()
    venc = session.exec(
        select(PagoPlataforma).where(
            PagoPlataforma.estado == EstadoPagoPlataforma.VENCIDO
        )
    ).all()
    pagados_rows = session.exec(
        select(PagoPlataforma).where(
            PagoPlataforma.estado == EstadoPagoPlataforma.PAGADO
        )
    ).all()

    hoy = date.today()
    monto_total = sum(p.monto for p in pagados_rows)
    monto_mes = 0
    por_mes: dict[tuple[int, int], list[int]] = {}
    for p in pagados_rows:
        ref = p.pagado_en.date() if p.pagado_en else p.periodo_fin
        key = (ref.year, ref.month)
        por_mes.setdefault(key, []).append(p.monto)
        if ref.year == hoy.year and ref.month == hoy.month:
            monto_mes += p.monto

    meses_es = (
        "",
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
    )
    recaudacion = [
        AdminRecaudacionMes(
            anio=y,
            mes=m,
            etiqueta=f"{meses_es[m]} {y}",
            monto_clp=sum(montos),
            num_pagos=len(montos),
        )
        for (y, m), montos in sorted(por_mes.items(), reverse=True)
    ]

    from app.models.ticket import TicketSoporte
    from app.models.enums import EstadoTicket

    tickets_rows = session.exec(select(TicketSoporte)).all()
    tickets_abiertos = sum(
        1
        for t in tickets_rows
        if t.estado in (EstadoTicket.ABIERTO, EstadoTicket.EN_PROCESO)
    )

    return AdminResumenOut(
        negocios_activos=int(activos or 0),
        negocios_suspendidos=int(suspendidos or 0),
        pagos_pendientes=len(pend),
        pagos_vencidos=len(venc),
        pagos_pagados=len(pagados_rows),
        monto_pendiente_clp=sum(p.monto for p in pend) + sum(p.monto for p in venc),
        monto_recaudado_total_clp=monto_total,
        monto_recaudado_mes_clp=monto_mes,
        recaudacion_por_mes=recaudacion,
        tickets_abiertos=tickets_abiertos,
    )
