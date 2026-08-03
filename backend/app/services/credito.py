from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlmodel import Session, col, func, select

from app.models import Cliente, CreditoMovimiento, TransaccionFinanciera, Venta
from app.models.enums import (
    MetodoPago,
    TipoCreditoMovimiento,
    TipoTransaccion,
    utcnow,
)
from app.schemas.cliente import (
    ClienteCreate,
    ClienteDeudaOut,
    ClienteOut,
    ClienteUpdate,
    CobroCreditoIn,
    CobroCreditoOut,
    CreditoCargoOut,
)


def deuda_cliente(session: Session, *, negocio_id: int, cliente_id: int) -> int:
    total = session.exec(
        select(func.coalesce(func.sum(CreditoMovimiento.saldo), 0)).where(
            CreditoMovimiento.negocio_id == negocio_id,
            CreditoMovimiento.cliente_id == cliente_id,
            CreditoMovimiento.tipo == TipoCreditoMovimiento.CARGO,
            CreditoMovimiento.saldo > 0,
        )
    ).one()
    return int(total)


def cliente_to_out(session: Session, cliente: Cliente) -> ClienteOut:
    deuda = deuda_cliente(
        session, negocio_id=cliente.negocio_id, cliente_id=cliente.id  # type: ignore[arg-type]
    )
    # limite_credito <= 0 = sin tope
    if cliente.limite_credito <= 0:
        disponible = 10**12
    else:
        disponible = max(0, cliente.limite_credito - deuda)
    return ClienteOut(
        id=cliente.id,  # type: ignore[arg-type]
        negocio_id=cliente.negocio_id,
        nombre=cliente.nombre,
        telefono=cliente.telefono,
        rut=cliente.rut,
        limite_credito=cliente.limite_credito,
        porcentaje_recargo=cliente.porcentaje_recargo,
        plazo_dias=cliente.plazo_dias,
        activo=cliente.activo,
        creado_en=cliente.creado_en,
        deuda_actual=deuda,
        disponible=disponible,
    )


def listar_clientes(
    session: Session, *, negocio_id: int, solo_activos: bool = True
) -> list[ClienteOut]:
    q = select(Cliente).where(Cliente.negocio_id == negocio_id)
    if solo_activos:
        q = q.where(Cliente.activo == True)  # noqa: E712
    rows = session.exec(q.order_by(col(Cliente.nombre).asc())).all()
    return [cliente_to_out(session, c) for c in rows]


def crear_cliente(
    session: Session, *, negocio_id: int, data: ClienteCreate, commit: bool = True
) -> ClienteOut:
    row = Cliente(
        negocio_id=negocio_id,
        nombre=data.nombre.strip(),
        telefono=(data.telefono.strip() if data.telefono else None),
        rut=(data.rut.strip() if data.rut else None),
        limite_credito=data.limite_credito,
        porcentaje_recargo=data.porcentaje_recargo.quantize(Decimal("0.01")),
        plazo_dias=data.plazo_dias,
        activo=True,
    )
    session.add(row)
    if commit:
        session.commit()
        session.refresh(row)
    else:
        session.flush()
    return cliente_to_out(session, row)


def actualizar_cliente(
    session: Session,
    *,
    negocio_id: int,
    cliente_id: int,
    data: ClienteUpdate,
    commit: bool = True,
) -> ClienteOut:
    row = session.get(Cliente, cliente_id)
    if row is None or row.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    payload = data.model_dump(exclude_unset=True)
    if "nombre" in payload and payload["nombre"] is not None:
        payload["nombre"] = payload["nombre"].strip()
    if "telefono" in payload and payload["telefono"] is not None:
        payload["telefono"] = payload["telefono"].strip() or None
    if "rut" in payload and payload["rut"] is not None:
        payload["rut"] = payload["rut"].strip() or None
    if "porcentaje_recargo" in payload and payload["porcentaje_recargo"] is not None:
        payload["porcentaje_recargo"] = payload["porcentaje_recargo"].quantize(
            Decimal("0.01")
        )

    for key, value in payload.items():
        setattr(row, key, value)
    session.add(row)
    if commit:
        session.commit()
        session.refresh(row)
    else:
        session.flush()
    return cliente_to_out(session, row)


def obtener_cliente(
    session: Session, *, negocio_id: int, cliente_id: int
) -> Cliente:
    row = session.get(Cliente, cliente_id)
    if row is None or row.negocio_id != negocio_id:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return row


def aplicar_recargo(precio: int, porcentaje: Decimal) -> int:
    factor = Decimal("1") + (porcentaje / Decimal("100"))
    return int(
        (Decimal(precio) * factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


def deuda_detalle(
    session: Session, *, negocio_id: int, cliente_id: int
) -> ClienteDeudaOut:
    cliente = obtener_cliente(session, negocio_id=negocio_id, cliente_id=cliente_id)
    hoy = date.today()
    cargos = session.exec(
        select(CreditoMovimiento)
        .where(
            CreditoMovimiento.negocio_id == negocio_id,
            CreditoMovimiento.cliente_id == cliente_id,
            CreditoMovimiento.tipo == TipoCreditoMovimiento.CARGO,
            CreditoMovimiento.saldo > 0,
        )
        .order_by(
            col(CreditoMovimiento.fecha_vencimiento).asc(),
            col(CreditoMovimiento.creado_en).asc(),
        )
    ).all()
    deuda = sum(c.saldo for c in cargos)
    return ClienteDeudaOut(
        cliente_id=cliente.id,  # type: ignore[arg-type]
        cliente_nombre=cliente.nombre,
        limite_credito=cliente.limite_credito,
        deuda_actual=deuda,
        disponible=(
            10**12
            if cliente.limite_credito <= 0
            else max(0, cliente.limite_credito - deuda)
        ),
        porcentaje_recargo=cliente.porcentaje_recargo,
        plazo_dias=cliente.plazo_dias,
        cargos_abiertos=[
            CreditoCargoOut(
                id=c.id,  # type: ignore[arg-type]
                venta_id=c.venta_id,
                monto=c.monto,
                saldo=c.saldo,
                fecha_vencimiento=c.fecha_vencimiento,
                descripcion=c.descripcion,
                creado_en=c.creado_en,
                vencido=bool(
                    c.fecha_vencimiento is not None and c.fecha_vencimiento < hoy
                ),
            )
            for c in cargos
        ],
    )


def validar_cupo_fiado(
    session: Session,
    *,
    negocio_id: int,
    cliente_id: int,
    monto_nuevo: int,
) -> Cliente:
    cliente = obtener_cliente(session, negocio_id=negocio_id, cliente_id=cliente_id)
    if not cliente.activo:
        raise HTTPException(status_code=400, detail="El cliente está inactivo")
    # 0 = sin límite de crédito
    if cliente.limite_credito <= 0:
        return cliente
    deuda = deuda_cliente(session, negocio_id=negocio_id, cliente_id=cliente_id)
    if deuda + monto_nuevo > cliente.limite_credito:
        disponible = max(0, cliente.limite_credito - deuda)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cupo insuficiente. Disponible ${disponible:,}".replace(",", ".")
                + f", se requiere ${monto_nuevo:,}".replace(",", ".")
            ),
        )
    return cliente


def eliminar_cliente(
    session: Session, *, negocio_id: int, cliente_id: int, commit: bool = True
) -> ClienteOut:
    row = obtener_cliente(session, negocio_id=negocio_id, cliente_id=cliente_id)
    deuda = deuda_cliente(session, negocio_id=negocio_id, cliente_id=cliente_id)
    if deuda > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: el cliente tiene deuda de ${deuda:,}".replace(
                ",", "."
            ),
        )
    row.activo = False
    session.add(row)
    if commit:
        session.commit()
        session.refresh(row)
    else:
        session.flush()
    return cliente_to_out(session, row)


def crear_cargo_fiado(
    session: Session,
    *,
    negocio_id: int,
    cliente: Cliente,
    venta: Venta,
    commit: bool = False,
) -> CreditoMovimiento:
    vencimiento = date.today() + timedelta(days=cliente.plazo_dias)
    cargo = CreditoMovimiento(
        negocio_id=negocio_id,
        cliente_id=cliente.id,  # type: ignore[arg-type]
        tipo=TipoCreditoMovimiento.CARGO,
        monto=venta.total_venta,
        saldo=venta.total_venta,
        venta_id=venta.id,
        fecha_vencimiento=vencimiento,
        descripcion=f"Fiado venta #{venta.numero}",
    )
    session.add(cargo)
    if commit:
        session.commit()
        session.refresh(cargo)
    else:
        session.flush()
    return cargo


def revertir_cargo_venta(
    session: Session, *, negocio_id: int, venta_id: int
) -> None:
    cargo = session.exec(
        select(CreditoMovimiento).where(
            CreditoMovimiento.negocio_id == negocio_id,
            CreditoMovimiento.venta_id == venta_id,
            CreditoMovimiento.tipo == TipoCreditoMovimiento.CARGO,
        )
    ).first()
    if cargo is None:
        return
    if cargo.saldo < cargo.monto:
        raise HTTPException(
            status_code=409,
            detail="No se puede anular: el fiado ya tiene abonos aplicados",
        )
    session.delete(cargo)


def registrar_cobro(
    session: Session,
    *,
    negocio_id: int,
    data: CobroCreditoIn,
    commit: bool = True,
) -> CobroCreditoOut:
    from app.services.caja import require_caja_abierta

    if data.medio_pago == MetodoPago.CREDITO:
        raise HTTPException(
            status_code=400,
            detail="El cobro no puede ser a crédito",
        )

    cliente = obtener_cliente(
        session, negocio_id=negocio_id, cliente_id=data.cliente_id
    )
    deuda = deuda_cliente(
        session, negocio_id=negocio_id, cliente_id=data.cliente_id
    )
    if data.monto > deuda:
        raise HTTPException(
            status_code=400,
            detail=f"El monto supera la deuda (${deuda})",
        )
    if deuda <= 0:
        raise HTTPException(status_code=400, detail="El cliente no tiene deuda")

    caja = require_caja_abierta(session, negocio_id=negocio_id)

    # FIFO sobre cargos abiertos
    restante = data.monto
    cargos = session.exec(
        select(CreditoMovimiento)
        .where(
            CreditoMovimiento.negocio_id == negocio_id,
            CreditoMovimiento.cliente_id == data.cliente_id,
            CreditoMovimiento.tipo == TipoCreditoMovimiento.CARGO,
            CreditoMovimiento.saldo > 0,
        )
        .order_by(
            col(CreditoMovimiento.fecha_vencimiento).asc(),
            col(CreditoMovimiento.creado_en).asc(),
        )
    ).all()
    for cargo in cargos:
        if restante <= 0:
            break
        aplicar = min(cargo.saldo, restante)
        cargo.saldo -= aplicar
        session.add(cargo)
        restante -= aplicar

    tx = TransaccionFinanciera(
        negocio_id=negocio_id,
        caja_chica_id=caja.id,  # type: ignore[arg-type]
        tipo_transaccion=TipoTransaccion.COBRO_CREDITO,
        monto=data.monto,
        descripcion=f"Cobro crédito: {cliente.nombre}",
        medio_pago=data.medio_pago,
        venta_id=None,
        fecha_hora=utcnow(),
    )
    session.add(tx)
    session.flush()

    abono = CreditoMovimiento(
        negocio_id=negocio_id,
        cliente_id=data.cliente_id,
        tipo=TipoCreditoMovimiento.ABONO,
        monto=data.monto,
        saldo=0,
        medio_pago=data.medio_pago,
        transaccion_id=tx.id,
        descripcion=f"Abono {cliente.nombre}",
    )
    session.add(abono)

    if commit:
        session.commit()
        session.refresh(abono)
    else:
        session.flush()

    deuda_restante = deuda_cliente(
        session, negocio_id=negocio_id, cliente_id=data.cliente_id
    )
    return CobroCreditoOut(
        id=abono.id,  # type: ignore[arg-type]
        cliente_id=data.cliente_id,
        monto=data.monto,
        medio_pago=data.medio_pago,
        deuda_restante=deuda_restante,
        transaccion_id=tx.id,
        creado_en=abono.creado_en,
    )
