"""fase17_venta_recargo_separado

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-08-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ventas",
        sa.Column(
            "monto_recargo",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "ventas",
        sa.Column(
            "porcentaje_recargo",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.alter_column("ventas", "monto_recargo", server_default=None)
    op.alter_column("ventas", "porcentaje_recargo", server_default=None)


def downgrade() -> None:
    op.drop_column("ventas", "porcentaje_recargo")
    op.drop_column("ventas", "monto_recargo")
