"""fase8_config_plataforma_prorrateo

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "config_plataforma",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre_plan", sa.String(length=120), nullable=False),
        sa.Column("cuota_mensual_clp", sa.Integer(), nullable=False),
        sa.Column("dias_gracia", sa.Integer(), nullable=False),
        sa.Column("dia_facturacion", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column(
        "pagos_plataforma",
        sa.Column("monto_mensual_ref", sa.Integer(), nullable=True),
    )
    op.add_column(
        "pagos_plataforma",
        sa.Column("dias_usados", sa.Integer(), nullable=True),
    )
    op.add_column(
        "pagos_plataforma",
        sa.Column("dias_base", sa.Integer(), nullable=True),
    )
    op.execute(
        """
        INSERT INTO config_plataforma
          (id, nombre_plan, cuota_mensual_clp, dias_gracia, dia_facturacion, activo, actualizado_en)
        VALUES
          (1, 'ScaleUpp Negocio', 29990, 5, 1, true, NOW())
        ON CONFLICT (id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_column("pagos_plataforma", "dias_base")
    op.drop_column("pagos_plataforma", "dias_usados")
    op.drop_column("pagos_plataforma", "monto_mensual_ref")
    op.drop_table("config_plataforma")
