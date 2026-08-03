"""fase15_folios_negocio

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-07-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill(table: str) -> None:
    op.execute(
        sa.text(
            f"""
            WITH ranked AS (
              SELECT id,
                     ROW_NUMBER() OVER (
                       PARTITION BY negocio_id ORDER BY id
                     ) AS rn
              FROM {table}
            )
            UPDATE {table} t
            SET numero = ranked.rn
            FROM ranked
            WHERE t.id = ranked.id
            """
        )
    )


def upgrade() -> None:
    op.add_column("ventas", sa.Column("numero", sa.Integer(), nullable=True))
    op.add_column("caja_chica", sa.Column("numero", sa.Integer(), nullable=True))
    op.add_column(
        "compras_mercaderia", sa.Column("numero", sa.Integer(), nullable=True)
    )

    _backfill("ventas")
    _backfill("caja_chica")
    _backfill("compras_mercaderia")

    op.alter_column("ventas", "numero", nullable=False)
    op.alter_column("caja_chica", "numero", nullable=False)
    op.alter_column("compras_mercaderia", "numero", nullable=False)

    op.create_index(op.f("ix_ventas_numero"), "ventas", ["numero"], unique=False)
    op.create_index(
        op.f("ix_caja_chica_numero"), "caja_chica", ["numero"], unique=False
    )
    op.create_index(
        op.f("ix_compras_mercaderia_numero"),
        "compras_mercaderia",
        ["numero"],
        unique=False,
    )

    op.create_unique_constraint(
        "uq_ventas_negocio_numero", "ventas", ["negocio_id", "numero"]
    )
    op.create_unique_constraint(
        "uq_caja_chica_negocio_numero", "caja_chica", ["negocio_id", "numero"]
    )
    op.create_unique_constraint(
        "uq_compras_mercaderia_negocio_numero",
        "compras_mercaderia",
        ["negocio_id", "numero"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_compras_mercaderia_negocio_numero",
        "compras_mercaderia",
        type_="unique",
    )
    op.drop_constraint(
        "uq_caja_chica_negocio_numero", "caja_chica", type_="unique"
    )
    op.drop_constraint("uq_ventas_negocio_numero", "ventas", type_="unique")
    op.drop_index(
        op.f("ix_compras_mercaderia_numero"), table_name="compras_mercaderia"
    )
    op.drop_index(op.f("ix_caja_chica_numero"), table_name="caja_chica")
    op.drop_index(op.f("ix_ventas_numero"), table_name="ventas")
    op.drop_column("compras_mercaderia", "numero")
    op.drop_column("caja_chica", "numero")
    op.drop_column("ventas", "numero")
