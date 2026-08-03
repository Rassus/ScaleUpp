"""fase16_categoria_acceso_rapido

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-08-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "categorias",
        sa.Column(
            "acceso_rapido",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    # Nuevas categorías default false; existentes quedan true (server_default)
    op.alter_column(
        "categorias",
        "acceso_rapido",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("categorias", "acceso_rapido")
