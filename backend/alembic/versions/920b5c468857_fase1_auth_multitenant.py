"""fase1_auth_multitenant

Revision ID: 920b5c468857
Revises:
Create Date: 2026-07-23 10:12:20.331791

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "920b5c468857"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "negocios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_negocios_slug"), "negocios", ["slug"], unique=True)

    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("es_platform_admin", sa.Boolean(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_usuarios_email"), "usuarios", ["email"], unique=True)

    op.create_table(
        "membresias",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column(
            "rol",
            sa.Enum("owner", "cajero", name="rolmembresia"),
            nullable=False,
        ),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "usuario_id", "negocio_id", name="uq_membresia_usuario_negocio"
        ),
    )
    op.create_index(
        op.f("ix_membresias_negocio_id"), "membresias", ["negocio_id"], unique=False
    )
    op.create_index(
        op.f("ix_membresias_usuario_id"), "membresias", ["usuario_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_membresias_usuario_id"), table_name="membresias")
    op.drop_index(op.f("ix_membresias_negocio_id"), table_name="membresias")
    op.drop_table("membresias")
    op.drop_index(op.f("ix_usuarios_email"), table_name="usuarios")
    op.drop_table("usuarios")
    op.drop_index(op.f("ix_negocios_slug"), table_name="negocios")
    op.drop_table("negocios")
    op.execute("DROP TYPE IF EXISTS rolmembresia")
