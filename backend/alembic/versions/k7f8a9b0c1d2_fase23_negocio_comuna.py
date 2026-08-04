"""fase23_negocio_comuna

Revision ID: k7f8a9b0c1d2
Revises: j6e7f8a9b0c1
Create Date: 2026-08-03

Comuna de la sucursal en negocios y tickets de nuevo negocio.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k7f8a9b0c1d2"
down_revision: Union[str, None] = "j6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "negocios",
        sa.Column("comuna", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "tickets_soporte",
        sa.Column("comuna_negocio_solicitado", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tickets_soporte", "comuna_negocio_solicitado")
    op.drop_column("negocios", "comuna")
