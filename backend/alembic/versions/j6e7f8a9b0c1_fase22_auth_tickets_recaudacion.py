"""fase22_auth_tickets_recaudacion

Revision ID: j6e7f8a9b0c1
Revises: i5d6e7f8a9b0
Create Date: 2026-08-03

- debe_cambiar_password en usuarios
- cuota_negocio_extra_clp en config_plataforma
- tabla tickets_soporte
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "j6e7f8a9b0c1"
down_revision: Union[str, None] = "i5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

tipoticket = postgresql.ENUM(
    "DESUSCRIPCION",
    "NUEVO_NEGOCIO",
    name="tipoticket",
    create_type=False,
)
estadoticket = postgresql.ENUM(
    "ABIERTO",
    "EN_PROCESO",
    "RESUELTO",
    "RECHAZADO",
    name="estadoticket",
    create_type=False,
)


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column(
            "debe_cambiar_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    # Cuentas existentes no forzamos cambio (solo altas nuevas)
    op.execute("UPDATE usuarios SET debe_cambiar_password = false")

    op.add_column(
        "config_plataforma",
        sa.Column(
            "cuota_negocio_extra_clp",
            sa.Integer(),
            nullable=False,
            server_default="2990",
        ),
    )

    tipoticket.create(op.get_bind(), checkfirst=True)
    estadoticket.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "tickets_soporte",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("tipo", tipoticket, nullable=False),
        sa.Column("estado", estadoticket, nullable=False),
        sa.Column("mensaje", sa.String(length=1000), nullable=True),
        sa.Column(
            "nombre_negocio_solicitado", sa.String(length=150), nullable=True
        ),
        sa.Column(
            "slug_negocio_solicitado", sa.String(length=80), nullable=True
        ),
        sa.Column("negocio_creado_id", sa.Integer(), nullable=True),
        sa.Column("respuesta_admin", sa.String(length=1000), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.Column("resuelto_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["negocio_creado_id"], ["negocios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_tickets_soporte_negocio_id"),
        "tickets_soporte",
        ["negocio_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_tickets_soporte_usuario_id"),
        "tickets_soporte",
        ["usuario_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_tickets_soporte_tipo"),
        "tickets_soporte",
        ["tipo"],
        unique=False,
    )
    op.create_index(
        op.f("ix_tickets_soporte_estado"),
        "tickets_soporte",
        ["estado"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_tickets_soporte_estado"), table_name="tickets_soporte")
    op.drop_index(op.f("ix_tickets_soporte_tipo"), table_name="tickets_soporte")
    op.drop_index(
        op.f("ix_tickets_soporte_usuario_id"), table_name="tickets_soporte"
    )
    op.drop_index(
        op.f("ix_tickets_soporte_negocio_id"), table_name="tickets_soporte"
    )
    op.drop_table("tickets_soporte")
    estadoticket.drop(op.get_bind(), checkfirst=True)
    tipoticket.drop(op.get_bind(), checkfirst=True)
    op.drop_column("config_plataforma", "cuota_negocio_extra_clp")
    op.drop_column("usuarios", "debe_cambiar_password")
