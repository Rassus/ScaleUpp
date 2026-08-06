"""fase25_reset_password

Revision ID: m9b0c1d2e3f4
Revises: l8a9b0c1d2e3
Create Date: 2026-08-05

Solicitudes de recuperación de contraseña (aprobación admin).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m9b0c1d2e3f4"
down_revision: Union[str, None] = "l8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Limpia enum residual de un intento fallido previo
    op.execute("DROP TYPE IF EXISTS estadoresetpassword")
    op.create_table(
        "solicitudes_reset_password",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False),
        sa.Column("nota_admin", sa.String(length=255), nullable=True),
        sa.Column("resuelto_por_id", sa.Integer(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.Column("resuelto_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["resuelto_por_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_solicitudes_reset_password_usuario_id",
        "solicitudes_reset_password",
        ["usuario_id"],
    )
    op.create_index(
        "ix_solicitudes_reset_password_email",
        "solicitudes_reset_password",
        ["email"],
    )
    op.create_index(
        "ix_solicitudes_reset_password_estado",
        "solicitudes_reset_password",
        ["estado"],
    )
    op.create_index(
        "ix_solicitudes_reset_password_creado_en",
        "solicitudes_reset_password",
        ["creado_en"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_solicitudes_reset_password_creado_en",
        table_name="solicitudes_reset_password",
    )
    op.drop_index(
        "ix_solicitudes_reset_password_estado",
        table_name="solicitudes_reset_password",
    )
    op.drop_index(
        "ix_solicitudes_reset_password_email",
        table_name="solicitudes_reset_password",
    )
    op.drop_index(
        "ix_solicitudes_reset_password_usuario_id",
        table_name="solicitudes_reset_password",
    )
    op.drop_table("solicitudes_reset_password")
