from datetime import date

from fastapi import HTTPException
from sqlmodel import Session, col, select

from app.models import CajaChica, TransaccionFinanciera, Usuario, Venta
from app.models.enums import (
    EstadoCaja,
    MetodoPago,
    TipoTransaccion,
    utcnow,
)
from app.schemas.caja import (
    CajaOut,
    CuadreOut,
    TransaccionOut,
)


INGRESOS_EFECTIVO = {
    TipoTransaccion.INGRESO_VENTA,
    TipoTransaccion.INYECCION_CAJA,
    TipoTransaccion.COBRO_CREDITO,
}
EGRESOS_EFECTIVO = {
    TipoTransaccion.GASTO_OPERATIVO,
    TipoTransaccion.GASTO_GENERAL,
}


def _usuario_nombre(session: Session | None, usuario_id: int | None) -> str | None:
    if session is None or usuario_id is None:
        return None
    user = session.get(Usuario, usuario_id)
    return user.nombre if user is not None else None


def caja_to_out(
    caja: CajaChica,
    cuadre: CuadreOut | None = None,
    *,
    session: Session | None = None,
) -> CajaOut:
    from app.services.folios import siguiente_numero_venta_caja

    siguiente = (
        siguiente_numero_venta_caja(session, caja_id=caja.id)  # type: ignore[arg-type]
        if session is not None and caja.id is not None
        else 1
    )
    return CajaOut(
        id=caja.id,  # type: ignore[arg-type]
        numero=caja.numero,
        negocio_id=caja.negocio_id,
        fecha=caja.fecha,
        nombre_vendedor=caja.nombre_vendedor,
        monto_apertura=caja.monto_apertura,
        monto_cierre=caja.monto_cierre,
        efectivo_teorico=caja.efectivo_teorico,
        diferencia=caja.diferencia,
        estado=caja.estado,
        abierta_por_usuario_id=caja.abierta_por_usuario_id,
        abierta_por_nombre=_usuario_nombre(session, caja.abierta_por_usuario_id),
        cerrada_por_usuario_id=caja.cerrada_por_usuario_id,
        cerrada_por_nombre=_usuario_nombre(session, caja.cerrada_por_usuario_id),
        creado_en=caja.creado_en,
        cerrada_en=caja.cerrada_en,
        siguiente_orden=siguiente,
        cuadre=cuadre,
    )


def transaccion_to_out(tx: TransaccionFinanciera) -> TransaccionOut:
    return TransaccionOut(
        id=tx.id,  # type: ignore[arg-type]
        caja_chica_id=tx.caja_chica_id,
        tipo_transaccion=tx.tipo_transaccion,
        monto=tx.monto,
        descripcion=tx.descripcion,
        medio_pago=tx.medio_pago,
        venta_id=tx.venta_id,
        fecha_hora=tx.fecha_hora,
    )


def get_caja_abierta(
    session: Session, *, negocio_id: int
) -> CajaChica | None:
    return session.exec(
        select(CajaChica).where(
            CajaChica.negocio_id == negocio_id,
            CajaChica.estado == EstadoCaja.ABIERTA,
        )
    ).first()


def require_caja_abierta(session: Session, *, negocio_id: int) -> CajaChica:
    caja = get_caja_abierta(session, negocio_id=negocio_id)
    if caja is None:
        raise HTTPException(
            status_code=400,
            detail="No hay caja abierta. Abre la caja chica antes de operar.",
        )
    return caja


def calcular_cuadre(session: Session, caja: CajaChica) -> CuadreOut:
    txs = session.exec(
        select(TransaccionFinanciera).where(
            TransaccionFinanciera.caja_chica_id == caja.id
        )
    ).all()

    ingresos_efectivo = 0
    egresos_efectivo = 0
    inyecciones_efectivo = 0
    ventas_efectivo = 0
    ventas_tarjeta = 0
    ventas_transferencia = 0
    ventas_credito = 0
    cobros_credito = 0

    for tx in txs:
        if tx.tipo_transaccion == TipoTransaccion.COBRO_CREDITO:
            cobros_credito += tx.monto
            if tx.medio_pago == MetodoPago.EFECTIVO:
                ingresos_efectivo += tx.monto
            continue

        if tx.medio_pago == MetodoPago.EFECTIVO:
            if tx.tipo_transaccion == TipoTransaccion.INGRESO_VENTA:
                ingresos_efectivo += tx.monto
                ventas_efectivo += tx.monto
            elif tx.tipo_transaccion == TipoTransaccion.INYECCION_CAJA:
                ingresos_efectivo += tx.monto
                inyecciones_efectivo += tx.monto
            elif tx.tipo_transaccion in EGRESOS_EFECTIVO:
                egresos_efectivo += tx.monto
        else:
            if tx.tipo_transaccion == TipoTransaccion.INGRESO_VENTA:
                if tx.medio_pago == MetodoPago.TARJETA:
                    ventas_tarjeta += tx.monto
                elif tx.medio_pago == MetodoPago.TRANSFERENCIA:
                    ventas_transferencia += tx.monto
                elif tx.medio_pago == MetodoPago.CREDITO:
                    ventas_credito += tx.monto

    teorico = caja.monto_apertura + ingresos_efectivo - egresos_efectivo
    diferencia = None
    if caja.monto_cierre is not None:
        diferencia = caja.monto_cierre - teorico

    return CuadreOut(
        caja_id=caja.id,  # type: ignore[arg-type]
        fecha=caja.fecha,
        estado=caja.estado,
        monto_apertura=caja.monto_apertura,
        ingresos_efectivo=ingresos_efectivo,
        egresos_efectivo=egresos_efectivo,
        inyecciones_efectivo=inyecciones_efectivo,
        efectivo_teorico=teorico,
        monto_cierre=caja.monto_cierre,
        diferencia=diferencia,
        ventas_efectivo=ventas_efectivo,
        ventas_tarjeta=ventas_tarjeta,
        ventas_transferencia=ventas_transferencia,
        ventas_credito=ventas_credito,
        total_ventas=(
            ventas_efectivo
            + ventas_tarjeta
            + ventas_transferencia
            + ventas_credito
        ),
        cobros_credito=cobros_credito,
    )


def abrir_caja(
    session: Session,
    *,
    negocio_id: int,
    usuario_id: int | None,
    monto_apertura: int,
    nombre_vendedor: str,
    fecha: date | None = None,
    commit: bool = True,
) -> CajaOut:
    if get_caja_abierta(session, negocio_id=negocio_id) is not None:
        raise HTTPException(status_code=409, detail="Ya existe una caja abierta")

    vendedor = nombre_vendedor.strip()
    if not vendedor:
        raise HTTPException(
            status_code=400, detail="El nombre del vendedor es obligatorio"
        )

    dia = fecha or date.today()
    from app.services.folios import siguiente_numero

    caja = CajaChica(
        negocio_id=negocio_id,
        numero=siguiente_numero(session, model=CajaChica, negocio_id=negocio_id),
        fecha=dia,
        nombre_vendedor=vendedor,
        monto_apertura=monto_apertura,
        estado=EstadoCaja.ABIERTA,
        abierta_por_usuario_id=usuario_id,
    )
    session.add(caja)
    if commit:
        session.commit()
        session.refresh(caja)
    else:
        session.flush()

    return caja_to_out(caja, calcular_cuadre(session, caja), session=session)


def cerrar_caja(
    session: Session,
    *,
    negocio_id: int,
    usuario_id: int | None,
    monto_cierre: int | None = None,
    commit: bool = True,
) -> CajaOut:
    caja = require_caja_abierta(session, negocio_id=negocio_id)
    cuadre = calcular_cuadre(session, caja)
    # Sin monto contado: cierra con el teórico (diferencia 0).
    cierre = monto_cierre if monto_cierre is not None else cuadre.efectivo_teorico
    caja.monto_cierre = cierre
    caja.efectivo_teorico = cuadre.efectivo_teorico
    caja.diferencia = cierre - cuadre.efectivo_teorico
    caja.estado = EstadoCaja.CERRADA
    caja.cerrada_por_usuario_id = usuario_id
    caja.cerrada_en = utcnow()
    session.add(caja)
    if commit:
        session.commit()
        session.refresh(caja)
    else:
        session.flush()

    return caja_to_out(caja, calcular_cuadre(session, caja), session=session)


def registrar_transaccion(
    session: Session,
    *,
    negocio_id: int,
    tipo: TipoTransaccion,
    monto: int,
    descripcion: str,
    medio_pago: MetodoPago,
    venta_id: int | None = None,
    caja: CajaChica | None = None,
    commit: bool = True,
) -> TransaccionOut:
    if monto <= 0:
        raise HTTPException(status_code=400, detail="monto debe ser > 0")
    if tipo not in (
        TipoTransaccion.INGRESO_VENTA,
        TipoTransaccion.GASTO_OPERATIVO,
        TipoTransaccion.GASTO_GENERAL,
        TipoTransaccion.INYECCION_CAJA,
    ):
        raise HTTPException(status_code=400, detail="tipo_transaccion inválido")

    caja_ref = caja or require_caja_abierta(session, negocio_id=negocio_id)
    if caja_ref.estado != EstadoCaja.ABIERTA:
        raise HTTPException(status_code=400, detail="La caja no está abierta")

    tx = TransaccionFinanciera(
        negocio_id=negocio_id,
        caja_chica_id=caja_ref.id,  # type: ignore[arg-type]
        tipo_transaccion=tipo,
        monto=monto,
        descripcion=descripcion,
        medio_pago=medio_pago,
        venta_id=venta_id,
    )
    session.add(tx)
    if commit:
        session.commit()
        session.refresh(tx)
    else:
        session.flush()
    return transaccion_to_out(tx)


def registrar_ingreso_venta(
    session: Session,
    *,
    negocio_id: int,
    venta: Venta,
    commit: bool = False,
) -> TransaccionOut:
    """Enlaza una venta a la caja abierta (todos los medios; el cuadre filtra efectivo)."""
    caja = require_caja_abierta(session, negocio_id=negocio_id)
    return registrar_transaccion(
        session,
        negocio_id=negocio_id,
        tipo=TipoTransaccion.INGRESO_VENTA,
        monto=venta.total_venta,
        descripcion=f"Venta #{venta.numero}",
        medio_pago=venta.metodo_pago,
        venta_id=venta.id,  # type: ignore[arg-type]
        caja=caja,
        commit=commit,
    )


def listar_cajas(
    session: Session,
    *,
    negocio_id: int,
    fecha: date | None = None,
    limit: int = 30,
) -> list[CajaOut]:
    stmt = select(CajaChica).where(CajaChica.negocio_id == negocio_id)
    if fecha is not None:
        stmt = stmt.where(CajaChica.fecha == fecha)
    rows = session.exec(
        stmt.order_by(col(CajaChica.creado_en).desc()).limit(limit)
    ).all()
    return [
        caja_to_out(c, calcular_cuadre(session, c), session=session) for c in rows
    ]


def listar_transacciones(
    session: Session, *, caja_id: int, negocio_id: int
) -> list[TransaccionOut]:
    caja = session.get(CajaChica, caja_id)
    if caja is None or caja.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    rows = session.exec(
        select(TransaccionFinanciera)
        .where(TransaccionFinanciera.caja_chica_id == caja_id)
        .order_by(col(TransaccionFinanciera.fecha_hora).desc())
    ).all()
    return [transaccion_to_out(r) for r in rows]


def listar_ventas_caja(
    session: Session, *, caja_id: int, negocio_id: int
) -> list:
    """Ventas (órdenes) asociadas a un turno de caja, con ítems."""
    from app.services.venta import venta_to_out

    caja = session.get(CajaChica, caja_id)
    if caja is None or caja.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Caja no encontrada")

    txs = session.exec(
        select(TransaccionFinanciera)
        .where(
            TransaccionFinanciera.caja_chica_id == caja_id,
            TransaccionFinanciera.tipo_transaccion == TipoTransaccion.INGRESO_VENTA,
            col(TransaccionFinanciera.venta_id).is_not(None),
        )
        .order_by(col(TransaccionFinanciera.fecha_hora).desc())
    ).all()

    ventas: list = []
    seen: set[int] = set()
    for tx in txs:
        if tx.venta_id is None or tx.venta_id in seen:
            continue
        seen.add(tx.venta_id)
        venta = session.get(Venta, tx.venta_id)
        if venta is None or venta.negocio_id != negocio_id:
            continue
        ventas.append(venta_to_out(session, venta, include_details=False))
    return ventas
