"""fase14_credito

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

tipocreditomovimiento = postgresql.ENUM(
    "CARGO",
    "ABONO",
    name="tipocreditomovimiento",
    create_type=False,
)


def upgrade() -> None:
    op.execute("ALTER TYPE metodopago ADD VALUE IF NOT EXISTS 'CREDITO'")
    op.execute("ALTER TYPE tipotransaccion ADD VALUE IF NOT EXISTS 'COBRO_CREDITO'")
    tipocreditomovimiento.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "clientes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("telefono", sa.String(length=40), nullable=True),
        sa.Column("rut", sa.String(length=20), nullable=True),
        sa.Column("limite_credito", sa.Integer(), nullable=False),
        sa.Column("porcentaje_recargo", sa.Numeric(5, 2), nullable=False),
        sa.Column("plazo_dias", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_clientes_negocio_id"), "clientes", ["negocio_id"], unique=False
    )

    op.add_column(
        "ventas",
        sa.Column("cliente_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_ventas_cliente_id"), "ventas", ["cliente_id"], unique=False
    )
    op.create_foreign_key(
        "fk_ventas_cliente_id",
        "ventas",
        "clientes",
        ["cliente_id"],
        ["id"],
    )

    op.create_table(
        "credito_movimientos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("cliente_id", sa.Integer(), nullable=False),
        sa.Column(
            "tipo",
            postgresql.ENUM(
                "CARGO",
                "ABONO",
                name="tipocreditomovimiento",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("monto", sa.Integer(), nullable=False),
        sa.Column("saldo", sa.Integer(), nullable=False),
        sa.Column("venta_id", sa.Integer(), nullable=True),
        sa.Column(
            "medio_pago",
            postgresql.ENUM(
                name="metodopago",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=True),
        sa.Column("transaccion_id", sa.Integer(), nullable=True),
        sa.Column("descripcion", sa.String(length=255), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.ForeignKeyConstraint(["cliente_id"], ["clientes.id"]),
        sa.ForeignKeyConstraint(["venta_id"], ["ventas.id"]),
        sa.ForeignKeyConstraint(
            ["transaccion_id"], ["transacciones_financieras.id"]
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_credito_movimientos_negocio_id"),
        "credito_movimientos",
        ["negocio_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_credito_movimientos_cliente_id"),
        "credito_movimientos",
        ["cliente_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_credito_movimientos_tipo"),
        "credito_movimientos",
        ["tipo"],
        unique=False,
    )
    op.create_index(
        op.f("ix_credito_movimientos_venta_id"),
        "credito_movimientos",
        ["venta_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_credito_movimientos_fecha_vencimiento"),
        "credito_movimientos",
        ["fecha_vencimiento"],
        unique=False,
    )
    op.create_index(
        op.f("ix_credito_movimientos_transaccion_id"),
        "credito_movimientos",
        ["transaccion_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_credito_movimientos_creado_en"),
        "credito_movimientos",
        ["creado_en"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_credito_movimientos_creado_en"),
        table_name="credito_movimientos",
    )
    op.drop_index(
        op.f("ix_credito_movimientos_transaccion_id"),
        table_name="credito_movimientos",
    )
    op.drop_index(
        op.f("ix_credito_movimientos_fecha_vencimiento"),
        table_name="credito_movimientos",
    )
    op.drop_index(
        op.f("ix_credito_movimientos_venta_id"),
        table_name="credito_movimientos",
    )
    op.drop_index(
        op.f("ix_credito_movimientos_tipo"), table_name="credito_movimientos"
    )
    op.drop_index(
        op.f("ix_credito_movimientos_cliente_id"),
        table_name="credito_movimientos",
    )
    op.drop_index(
        op.f("ix_credito_movimientos_negocio_id"),
        table_name="credito_movimientos",
    )
    op.drop_table("credito_movimientos")

    op.drop_constraint("fk_ventas_cliente_id", "ventas", type_="foreignkey")
    op.drop_index(op.f("ix_ventas_cliente_id"), table_name="ventas")
    op.drop_column("ventas", "cliente_id")

    op.drop_index(op.f("ix_clientes_negocio_id"), table_name="clientes")
    op.drop_table("clientes")

    tipocreditomovimiento.drop(op.get_bind(), checkfirst=True)
