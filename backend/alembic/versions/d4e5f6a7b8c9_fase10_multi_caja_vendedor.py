"""fase10_multi_caja_vendedor

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-28

Permite N cajas el mismo día y agrega nombre_vendedor por turno.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_caja_negocio_fecha", "caja_chica", type_="unique")
    op.add_column(
        "caja_chica",
        sa.Column(
            "nombre_vendedor",
            sa.String(length=120),
            nullable=False,
            server_default="Sin nombre",
        ),
    )
    op.create_index(
        "ix_caja_chica_negocio_fecha",
        "caja_chica",
        ["negocio_id", "fecha"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_caja_chica_negocio_fecha", table_name="caja_chica")
    op.drop_column("caja_chica", "nombre_vendedor")
    op.create_unique_constraint(
        "uq_caja_negocio_fecha",
        "caja_chica",
        ["negocio_id", "fecha"],
    )
