"""fase21_promociones

Revision ID: i5d6e7f8a9b0
Revises: h4c5d6e7f8a9
Create Date: 2026-08-03

Programa de precios y promociones (vigencia + ítems FIJO/%).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "i5d6e7f8a9b0"
down_revision: Union[str, None] = "h4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

tipopromo = postgresql.ENUM(
    "FIJO",
    "PORCENTAJE",
    name="tipopromo",
    create_type=False,
)


def upgrade() -> None:
    tipopromo.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "promociones",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.Column("creado_por_usuario_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.ForeignKeyConstraint(["creado_por_usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_promociones_negocio_id"), "promociones", ["negocio_id"], unique=False
    )
    op.create_index(
        op.f("ix_promociones_creado_por_usuario_id"),
        "promociones",
        ["creado_por_usuario_id"],
        unique=False,
    )

    op.create_table(
        "promocion_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("promocion_id", sa.Integer(), nullable=False),
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("tipo", tipopromo, nullable=False),
        sa.Column("valor", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["promocion_id"], ["promociones.id"]),
        sa.ForeignKeyConstraint(["producto_id"], ["productos.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "promocion_id",
            "producto_id",
            name="uq_promocion_items_promocion_producto",
        ),
    )
    op.create_index(
        op.f("ix_promocion_items_promocion_id"),
        "promocion_items",
        ["promocion_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_promocion_items_producto_id"),
        "promocion_items",
        ["producto_id"],
        unique=False,
    )

    op.add_column(
        "ventas",
        sa.Column(
            "monto_descuento_promo",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("ventas", "monto_descuento_promo")
    op.drop_index(op.f("ix_promocion_items_producto_id"), table_name="promocion_items")
    op.drop_index(op.f("ix_promocion_items_promocion_id"), table_name="promocion_items")
    op.drop_table("promocion_items")
    op.drop_index(op.f("ix_promociones_creado_por_usuario_id"), table_name="promociones")
    op.drop_index(op.f("ix_promociones_negocio_id"), table_name="promociones")
    op.drop_table("promociones")
    tipopromo.drop(op.get_bind(), checkfirst=True)
