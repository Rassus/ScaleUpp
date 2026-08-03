"""fase9_avisos_notificaciones

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

tipoaviso = postgresql.ENUM(
    "STOCK_BAJO",
    "POR_VENCER",
    "PAGO_GRACIA",
    name="tipoaviso",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    tipoaviso.create(bind, checkfirst=True)
    op.create_table(
        "avisos_enviados",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("tipo", tipoaviso, nullable=False),
        sa.Column("clave", sa.String(length=64), nullable=False),
        sa.Column("periodo_ym", sa.String(length=7), nullable=False),
        sa.Column("titulo", sa.String(length=180), nullable=False),
        sa.Column("cuerpo", sa.String(length=500), nullable=False),
        sa.Column("enviado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "negocio_id",
            "tipo",
            "clave",
            "periodo_ym",
            name="uq_aviso_negocio_tipo_clave_mes",
        ),
    )
    op.create_index(
        op.f("ix_avisos_enviados_negocio_id"),
        "avisos_enviados",
        ["negocio_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_avisos_enviados_tipo"),
        "avisos_enviados",
        ["tipo"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_avisos_enviados_tipo"), table_name="avisos_enviados")
    op.drop_index(op.f("ix_avisos_enviados_negocio_id"), table_name="avisos_enviados")
    op.drop_table("avisos_enviados")
    tipoaviso.drop(op.get_bind(), checkfirst=True)
