from datetime import date, timedelta

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models.aviso import AvisoEnviado
from app.models.config_plataforma import ConfigPlataforma
from app.models.enums import EstadoPagoPlataforma, TipoAviso
from app.models.pago_plataforma import PagoPlataforma
from app.schemas.aviso import AvisoAckIn, AvisoPendienteOut
from app.services.kpi import obtener_kpis


def _periodo_ym(hoy: date | None = None) -> str:
    d = hoy or date.today()
    return f"{d.year:04d}-{d.month:02d}"


def _ya_enviado(
    session: Session,
    *,
    negocio_id: int,
    tipo: TipoAviso,
    clave: str,
    periodo_ym: str,
) -> bool:
    row = session.exec(
        select(AvisoEnviado).where(
            AvisoEnviado.negocio_id == negocio_id,
            AvisoEnviado.tipo == tipo,
            AvisoEnviado.clave == clave,
            AvisoEnviado.periodo_ym == periodo_ym,
        )
    ).first()
    return row is not None


def _get_config(session: Session) -> ConfigPlataforma:
    cfg = session.get(ConfigPlataforma, 1)
    if cfg is None:
        cfg = ConfigPlataforma(id=1)
        session.add(cfg)
        session.commit()
        session.refresh(cfg)
    return cfg


def listar_pendientes(
    session: Session, *, negocio_id: int
) -> list[AvisoPendienteOut]:
    hoy = date.today()
    ym = _periodo_ym(hoy)
    out: list[AvisoPendienteOut] = []
    seen_productos_vencer: set[int] = set()

    kpis = obtener_kpis(session, negocio_id=negocio_id)

    for p in kpis.productos_bajo_stock:
        clave = str(p.producto_id)
        if _ya_enviado(
            session,
            negocio_id=negocio_id,
            tipo=TipoAviso.STOCK_BAJO,
            clave=clave,
            periodo_ym=ym,
        ):
            continue
        out.append(
            AvisoPendienteOut(
                tipo=TipoAviso.STOCK_BAJO,
                clave=clave,
                titulo="Stock bajo",
                cuerpo=(
                    f"{p.nombre}: quedan {p.stock_actual} unidades. "
                    "Revisa reposición."
                ),
                periodo_ym=ym,
                producto_id=p.producto_id,
            )
        )

    for p in kpis.productos_por_vencer:
        # 1 aviso/mes por producto (aunque haya varios lotes)
        if p.producto_id in seen_productos_vencer:
            continue
        seen_productos_vencer.add(p.producto_id)
        clave = str(p.producto_id)
        if _ya_enviado(
            session,
            negocio_id=negocio_id,
            tipo=TipoAviso.POR_VENCER,
            clave=clave,
            periodo_ym=ym,
        ):
            continue
        dias = p.dias_restantes
        if dias < 0:
            detalle = f"venció hace {abs(dias)} día(s)"
        elif dias == 0:
            detalle = "vence hoy"
        else:
            detalle = f"vence en {dias} día(s)"
        out.append(
            AvisoPendienteOut(
                tipo=TipoAviso.POR_VENCER,
                clave=clave,
                titulo="Producto por vencer",
                cuerpo=f"{p.nombre}: {detalle} ({p.fecha_caducidad}).",
                periodo_ym=ym,
                producto_id=p.producto_id,
            )
        )

    cfg = _get_config(session)
    gracia = max(0, cfg.dias_gracia)
    pagos = session.exec(
        select(PagoPlataforma).where(
            PagoPlataforma.negocio_id == negocio_id,
            PagoPlataforma.estado == EstadoPagoPlataforma.PENDIENTE,
        )
    ).all()
    for pago in pagos:
        # Dentro de días de gracia: después del periodo_fin y hasta +gracia
        if pago.periodo_fin >= hoy:
            continue
        limite_gracia = pago.periodo_fin + timedelta(days=gracia)
        if hoy > limite_gracia:
            continue
        clave = str(pago.id)
        if _ya_enviado(
            session,
            negocio_id=negocio_id,
            tipo=TipoAviso.PAGO_GRACIA,
            clave=clave,
            periodo_ym=ym,
        ):
            continue
        dias_restantes = (limite_gracia - hoy).days
        out.append(
            AvisoPendienteOut(
                tipo=TipoAviso.PAGO_GRACIA,
                clave=clave,
                titulo="Recordatorio de pago",
                cuerpo=(
                    f"Tienes una cuota pendiente de "
                    f"${pago.monto:,} CLP "
                    f"(periodo {pago.periodo_inicio} → {pago.periodo_fin}). "
                    f"Quedan {dias_restantes} día(s) de gracia."
                ).replace(",", "."),
                periodo_ym=ym,
                pago_id=pago.id,  # type: ignore[arg-type]
            )
        )

    return out


def ack_avisos(
    session: Session, *, negocio_id: int, body: AvisoAckIn
) -> int:
    ym = _periodo_ym()
    marcados = 0
    for item in body.avisos:
        if _ya_enviado(
            session,
            negocio_id=negocio_id,
            tipo=item.tipo,
            clave=item.clave,
            periodo_ym=ym,
        ):
            continue
        session.add(
            AvisoEnviado(
                negocio_id=negocio_id,
                tipo=item.tipo,
                clave=item.clave,
                periodo_ym=ym,
                titulo=item.titulo[:180],
                cuerpo=item.cuerpo[:500],
            )
        )
        marcados += 1
    if marcados:
        try:
            session.commit()
        except Exception as exc:
            session.rollback()
            raise HTTPException(
                status_code=409,
                detail="No se pudieron marcar los avisos (posible duplicado)",
            ) from exc
    return marcados
