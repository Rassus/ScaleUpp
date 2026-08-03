"""fase19_folio_venta_por_caja

Revision ID: g3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-08-03

Cada caja (turno) numera sus órdenes desde 1.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g3b4c5d6e7f8"
down_revision: Union[str, None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ventas",
        sa.Column("caja_chica_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_ventas_caja_chica_id",
        "ventas",
        "caja_chica",
        ["caja_chica_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_ventas_caja_chica_id"), "ventas", ["caja_chica_id"], unique=False
    )

    # Enlazar ventas existentes a la caja vía ingreso de venta
    op.execute(
        sa.text(
            """
            UPDATE ventas v
            SET caja_chica_id = t.caja_chica_id
            FROM transacciones_financieras t
            WHERE t.venta_id = v.id
              AND t.tipo_transaccion = 'INGRESO_VENTA'
              AND v.caja_chica_id IS NULL
            """
        )
    )

    # Huérfanas: primera caja del mismo negocio (si existe)
    op.execute(
        sa.text(
            """
            UPDATE ventas v
            SET caja_chica_id = (
              SELECT c.id FROM caja_chica c
              WHERE c.negocio_id = v.negocio_id
              ORDER BY c.id
              LIMIT 1
            )
            WHERE v.caja_chica_id IS NULL
            """
        )
    )

    # Quitar unicidad global antes de renumerar (habrá #1 por cada caja)
    op.drop_constraint("uq_ventas_negocio_numero", "ventas", type_="unique")

    # Renumerar correlativo por caja (orden cronológico)
    op.execute(
        sa.text(
            """
            WITH ranked AS (
              SELECT id,
                     ROW_NUMBER() OVER (
                       PARTITION BY caja_chica_id
                       ORDER BY fecha_hora, id
                     ) AS rn
              FROM ventas
              WHERE caja_chica_id IS NOT NULL
            )
            UPDATE ventas v
            SET numero = ranked.rn
            FROM ranked
            WHERE v.id = ranked.id
            """
        )
    )

    op.create_unique_constraint(
        "uq_ventas_caja_numero", "ventas", ["caja_chica_id", "numero"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_ventas_caja_numero", "ventas", type_="unique")

    # Volver a numeración global por negocio
    op.execute(
        sa.text(
            """
            WITH ranked AS (
              SELECT id,
                     ROW_NUMBER() OVER (
                       PARTITION BY negocio_id
                       ORDER BY fecha_hora, id
                     ) AS rn
              FROM ventas
            )
            UPDATE ventas v
            SET numero = ranked.rn
            FROM ranked
            WHERE v.id = ranked.id
            """
        )
    )

    op.create_unique_constraint(
        "uq_ventas_negocio_numero", "ventas", ["negocio_id", "numero"]
    )
    op.drop_index(op.f("ix_ventas_caja_chica_id"), table_name="ventas")
    op.drop_constraint("fk_ventas_caja_chica_id", "ventas", type_="foreignkey")
    op.drop_column("ventas", "caja_chica_id")
