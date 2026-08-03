"""fase6_caja_finanzas

Revision ID: 99b4911c04ca
Revises: 1509f2049f95
Create Date: 2026-07-23 16:30:35.460924

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "99b4911c04ca"
down_revision: Union[str, None] = "1509f2049f95"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

metodopago = postgresql.ENUM(
    "EFECTIVO",
    "TARJETA",
    "TRANSFERENCIA",
    name="metodopago",
    create_type=False,
)


def upgrade() -> None:
    op.create_table(
        "caja_chica",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("monto_apertura", sa.Integer(), nullable=False),
        sa.Column("monto_cierre", sa.Integer(), nullable=True),
        sa.Column("efectivo_teorico", sa.Integer(), nullable=True),
        sa.Column("diferencia", sa.Integer(), nullable=True),
        sa.Column(
            "estado",
            sa.Enum("ABIERTA", "CERRADA", name="estadocaja"),
            nullable=False,
        ),
        sa.Column("abierta_por_usuario_id", sa.Integer(), nullable=True),
        sa.Column("cerrada_por_usuario_id", sa.Integer(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.Column("cerrada_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["abierta_por_usuario_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["cerrada_por_usuario_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("negocio_id", "fecha", name="uq_caja_negocio_fecha"),
    )
    op.create_index(op.f("ix_caja_chica_estado"), "caja_chica", ["estado"], unique=False)
    op.create_index(op.f("ix_caja_chica_fecha"), "caja_chica", ["fecha"], unique=False)
    op.create_index(
        op.f("ix_caja_chica_negocio_id"), "caja_chica", ["negocio_id"], unique=False
    )

    op.create_table(
        "transacciones_financieras",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("caja_chica_id", sa.Integer(), nullable=False),
        sa.Column(
            "tipo_transaccion",
            sa.Enum(
                "INGRESO_VENTA",
                "GASTO_OPERATIVO",
                "GASTO_GENERAL",
                "INYECCION_CAJA",
                name="tipotransaccion",
            ),
            nullable=False,
        ),
        sa.Column("monto", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=False),
        sa.Column("medio_pago", metodopago, nullable=False),
        sa.Column("venta_id", sa.Integer(), nullable=True),
        sa.Column("fecha_hora", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["caja_chica_id"], ["caja_chica.id"]),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.ForeignKeyConstraint(["venta_id"], ["ventas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_transacciones_financieras_caja_chica_id"),
        "transacciones_financieras",
        ["caja_chica_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transacciones_financieras_fecha_hora"),
        "transacciones_financieras",
        ["fecha_hora"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transacciones_financieras_negocio_id"),
        "transacciones_financieras",
        ["negocio_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transacciones_financieras_tipo_transaccion"),
        "transacciones_financieras",
        ["tipo_transaccion"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transacciones_financieras_venta_id"),
        "transacciones_financieras",
        ["venta_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_transacciones_financieras_venta_id"),
        table_name="transacciones_financieras",
    )
    op.drop_index(
        op.f("ix_transacciones_financieras_tipo_transaccion"),
        table_name="transacciones_financieras",
    )
    op.drop_index(
        op.f("ix_transacciones_financieras_negocio_id"),
        table_name="transacciones_financieras",
    )
    op.drop_index(
        op.f("ix_transacciones_financieras_fecha_hora"),
        table_name="transacciones_financieras",
    )
    op.drop_index(
        op.f("ix_transacciones_financieras_caja_chica_id"),
        table_name="transacciones_financieras",
    )
    op.drop_table("transacciones_financieras")
    op.drop_index(op.f("ix_caja_chica_negocio_id"), table_name="caja_chica")
    op.drop_index(op.f("ix_caja_chica_fecha"), table_name="caja_chica")
    op.drop_index(op.f("ix_caja_chica_estado"), table_name="caja_chica")
    op.drop_table("caja_chica")
    op.execute("DROP TYPE IF EXISTS tipotransaccion")
    op.execute("DROP TYPE IF EXISTS estadocaja")
