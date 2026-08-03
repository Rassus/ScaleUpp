"""fase7_admin_pagos_plataforma

Revision ID: a1b2c3d4e5f6
Revises: 99b4911c04ca
Create Date: 2026-07-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "99b4911c04ca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

estadopago = postgresql.ENUM(
    "PENDIENTE",
    "PAGADO",
    "VENCIDO",
    "ANULADO",
    name="estadopagoplataforma",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    estadopago.create(bind, checkfirst=True)
    op.create_table(
        "pagos_plataforma",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("monto", sa.Integer(), nullable=False),
        sa.Column("periodo_inicio", sa.Date(), nullable=False),
        sa.Column("periodo_fin", sa.Date(), nullable=False),
        sa.Column("estado", estadopago, nullable=False),
        sa.Column("nota", sa.String(length=255), nullable=True),
        sa.Column("pagado_en", sa.DateTime(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_pagos_plataforma_negocio_id"),
        "pagos_plataforma",
        ["negocio_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_pagos_plataforma_negocio_id"), table_name="pagos_plataforma")
    op.drop_table("pagos_plataforma")
    estadopago.drop(op.get_bind(), checkfirst=True)
