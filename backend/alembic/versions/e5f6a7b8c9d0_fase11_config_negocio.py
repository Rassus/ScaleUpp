"""fase11_config_negocio

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-29

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "config_negocio",
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column(
            "alerta_stock_cantidad",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="5",
        ),
        sa.Column(
            "alerta_stock_porcentaje",
            sa.Integer(),
            nullable=False,
            server_default="15",
        ),
        sa.Column(
            "dias_caducidad_alerta",
            sa.Integer(),
            nullable=False,
            server_default="30",
        ),
        sa.Column("actualizado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.PrimaryKeyConstraint("negocio_id"),
    )


def downgrade() -> None:
    op.drop_table("config_negocio")
