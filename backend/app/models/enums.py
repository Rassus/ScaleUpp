from datetime import datetime
from enum import Enum


class RolMembresia(str, Enum):
    OWNER = "owner"
    CAJERO = "cajero"


class TipoProducto(str, Enum):
    SIMPLE = "SIMPLE"
    KIT = "KIT"


class TipoMovimiento(str, Enum):
    ENTRADA_COMPRA = "ENTRADA_COMPRA"
    SALIDA_VENTA = "SALIDA_VENTA"
    SALIDA_MERMA = "SALIDA_MERMA"
    AJUSTE_INVENTARIO = "AJUSTE_INVENTARIO"


class MetodoPago(str, Enum):
    EFECTIVO = "EFECTIVO"
    TARJETA = "TARJETA"
    TRANSFERENCIA = "TRANSFERENCIA"
    CREDITO = "CREDITO"


class EstadoCaja(str, Enum):
    ABIERTA = "ABIERTA"
    CERRADA = "CERRADA"


class TipoTransaccion(str, Enum):
    INGRESO_VENTA = "INGRESO_VENTA"
    GASTO_OPERATIVO = "GASTO_OPERATIVO"
    GASTO_GENERAL = "GASTO_GENERAL"
    INYECCION_CAJA = "INYECCION_CAJA"
    COBRO_CREDITO = "COBRO_CREDITO"


class TipoCreditoMovimiento(str, Enum):
    CARGO = "CARGO"
    ABONO = "ABONO"


class EstadoPagoPlataforma(str, Enum):
    PENDIENTE = "PENDIENTE"
    PAGADO = "PAGADO"
    VENCIDO = "VENCIDO"
    ANULADO = "ANULADO"


class TipoAviso(str, Enum):
    STOCK_BAJO = "STOCK_BAJO"
    POR_VENCER = "POR_VENCER"
    PAGO_GRACIA = "PAGO_GRACIA"


class TipoMovimientoNegocio(str, Enum):
    INVERSION_MERCADERIA = "INVERSION_MERCADERIA"


class TipoPromo(str, Enum):
    FIJO = "FIJO"
    PORCENTAJE = "PORCENTAJE"


def utcnow() -> datetime:
    return datetime.utcnow()
