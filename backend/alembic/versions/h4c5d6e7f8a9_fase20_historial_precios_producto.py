"""fase20_historial_precios_producto

Revision ID: h4c5d6e7f8a9
Revises: g3b4c5d6e7f8
Create Date: 2026-08-03

Registra cada cambio de precio_venta de productos.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h4c5d6e7f8a9"
down_revision: Union[str, None] = "g3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "historial_precios_producto",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("precio_anterior", sa.Integer(), nullable=False),
        sa.Column("precio_nuevo", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("fecha_hora", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.ForeignKeyConstraint(["producto_id"], ["productos.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_historial_precios_producto_negocio_id"),
        "historial_precios_producto",
        ["negocio_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_historial_precios_producto_producto_id"),
        "historial_precios_producto",
        ["producto_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_historial_precios_producto_usuario_id"),
        "historial_precios_producto",
        ["usuario_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_historial_precios_producto_fecha_hora"),
        "historial_precios_producto",
        ["fecha_hora"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_historial_precios_producto_fecha_hora"),
        table_name="historial_precios_producto",
    )
    op.drop_index(
        op.f("ix_historial_precios_producto_usuario_id"),
        table_name="historial_precios_producto",
    )
    op.drop_index(
        op.f("ix_historial_precios_producto_producto_id"),
        table_name="historial_precios_producto",
    )
    op.drop_index(
        op.f("ix_historial_precios_producto_negocio_id"),
        table_name="historial_precios_producto",
    )
    op.drop_table("historial_precios_producto")
