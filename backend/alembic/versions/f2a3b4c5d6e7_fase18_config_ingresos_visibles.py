"""fase18_config_ingresos_visibles

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-08-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "config_negocio",
        sa.Column(
            "ingresos_visibles",
            sa.Integer(),
            nullable=False,
            server_default="3",
        ),
    )
    op.alter_column("config_negocio", "ingresos_visibles", server_default=None)


def downgrade() -> None:
    op.drop_column("config_negocio", "ingresos_visibles")
