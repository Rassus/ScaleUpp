"""fase12_compras_inversion

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

tipomovimientonegocio = postgresql.ENUM(
    "INVERSION_MERCADERIA",
    name="tipomovimientonegocio",
    create_type=False,
)


def upgrade() -> None:
    tipomovimientonegocio.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "compras_mercaderia",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("nota", sa.String(length=255), nullable=True),
        sa.Column("costo_operacion_total", sa.Integer(), nullable=False),
        sa.Column("monto_total", sa.Integer(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_compras_mercaderia_negocio_id"),
        "compras_mercaderia",
        ["negocio_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_compras_mercaderia_fecha"),
        "compras_mercaderia",
        ["fecha"],
        unique=False,
    )
    op.create_index(
        op.f("ix_compras_mercaderia_creado_en"),
        "compras_mercaderia",
        ["creado_en"],
        unique=False,
    )

    op.create_table(
        "compras_mercaderia_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("compra_id", sa.Integer(), nullable=False),
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("cantidad", sa.Numeric(12, 2), nullable=False),
        sa.Column("precio_costo_neto", sa.Integer(), nullable=False),
        sa.Column("iva_porcentaje", sa.Numeric(5, 2), nullable=False),
        sa.Column("fecha_caducidad", sa.Date(), nullable=True),
        sa.Column("monto_linea", sa.Integer(), nullable=False),
        sa.Column("lote_stock_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["compra_id"], ["compras_mercaderia.id"]),
        sa.ForeignKeyConstraint(["producto_id"], ["productos.id"]),
        sa.ForeignKeyConstraint(["lote_stock_id"], ["lotes_stock.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_compras_mercaderia_items_compra_id"),
        "compras_mercaderia_items",
        ["compra_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_compras_mercaderia_items_producto_id"),
        "compras_mercaderia_items",
        ["producto_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_compras_mercaderia_items_lote_stock_id"),
        "compras_mercaderia_items",
        ["lote_stock_id"],
        unique=False,
    )

    op.create_table(
        "movimientos_negocio",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("tipo", tipomovimientonegocio, nullable=False),
        sa.Column("monto", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=False),
        sa.Column("compra_id", sa.Integer(), nullable=True),
        sa.Column("fecha_hora", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["compra_id"], ["compras_mercaderia.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_movimientos_negocio_negocio_id"),
        "movimientos_negocio",
        ["negocio_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_movimientos_negocio_tipo"),
        "movimientos_negocio",
        ["tipo"],
        unique=False,
    )
    op.create_index(
        op.f("ix_movimientos_negocio_compra_id"),
        "movimientos_negocio",
        ["compra_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_movimientos_negocio_fecha_hora"),
        "movimientos_negocio",
        ["fecha_hora"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("movimientos_negocio")
    op.drop_table("compras_mercaderia_items")
    op.drop_table("compras_mercaderia")
    tipomovimientonegocio.drop(op.get_bind(), checkfirst=True)
