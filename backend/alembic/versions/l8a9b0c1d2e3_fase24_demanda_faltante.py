"""fase24_demanda_faltante

Revision ID: l8a9b0c1d2e3
Revises: k7f8a9b0c1d2
Create Date: 2026-08-04

Registro de pedidos/consultas de productos sin stock.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l8a9b0c1d2e3"
down_revision: Union[str, None] = "k7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "demanda_faltantes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("cantidad", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("precio_ref", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("caja_chica_id", sa.Integer(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["caja_chica_id"], ["caja_chica.id"]),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.ForeignKeyConstraint(["producto_id"], ["productos.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_demanda_faltantes_negocio_id",
        "demanda_faltantes",
        ["negocio_id"],
    )
    op.create_index(
        "ix_demanda_faltantes_producto_id",
        "demanda_faltantes",
        ["producto_id"],
    )
    op.create_index(
        "ix_demanda_faltantes_creado_en",
        "demanda_faltantes",
        ["creado_en"],
    )


def downgrade() -> None:
    op.drop_index("ix_demanda_faltantes_creado_en", table_name="demanda_faltantes")
    op.drop_index("ix_demanda_faltantes_producto_id", table_name="demanda_faltantes")
    op.drop_index("ix_demanda_faltantes_negocio_id", table_name="demanda_faltantes")
    op.drop_table("demanda_faltantes")
