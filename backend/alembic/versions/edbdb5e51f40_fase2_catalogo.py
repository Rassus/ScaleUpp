"""fase2_catalogo

Revision ID: edbdb5e51f40
Revises: 920b5c468857
Create Date: 2026-07-23 15:52:03.219118

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "edbdb5e51f40"
down_revision: Union[str, None] = "920b5c468857"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categorias",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("descripcion", sa.String(length=500), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "negocio_id", "nombre", name="uq_categoria_negocio_nombre"
        ),
    )
    op.create_index(
        op.f("ix_categorias_negocio_id"), "categorias", ["negocio_id"], unique=False
    )

    op.create_table(
        "unidades_medida",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column("sigla", sa.String(length=10), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("negocio_id", "sigla", name="uq_unidad_negocio_sigla"),
    )
    op.create_index(
        op.f("ix_unidades_medida_negocio_id"),
        "unidades_medida",
        ["negocio_id"],
        unique=False,
    )

    op.create_table(
        "productos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("codigo_barras", sa.String(length=100), nullable=True),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("categoria_id", sa.Integer(), nullable=True),
        sa.Column("unidad_medida_id", sa.Integer(), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum("SIMPLE", "KIT", name="tipoproducto"),
            nullable=False,
        ),
        sa.Column("precio_venta", sa.Integer(), nullable=False),
        sa.Column("controla_caducidad", sa.Boolean(), nullable=False),
        sa.Column("porcentaje_emergencia", sa.Integer(), nullable=False),
        sa.Column("porcentaje_sobrestock", sa.Integer(), nullable=False),
        sa.Column("stock_ideal", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("stock_minimo", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["categoria_id"], ["categorias.id"]),
        sa.ForeignKeyConstraint(["negocio_id"], ["negocios.id"]),
        sa.ForeignKeyConstraint(["unidad_medida_id"], ["unidades_medida.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "negocio_id",
            "codigo_barras",
            name="uq_producto_negocio_codigo_barras",
        ),
    )
    op.create_index(
        op.f("ix_productos_categoria_id"), "productos", ["categoria_id"], unique=False
    )
    op.create_index(
        op.f("ix_productos_codigo_barras"),
        "productos",
        ["codigo_barras"],
        unique=False,
    )
    op.create_index(
        op.f("ix_productos_negocio_id"), "productos", ["negocio_id"], unique=False
    )
    op.create_index(
        op.f("ix_productos_unidad_medida_id"),
        "productos",
        ["unidad_medida_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_productos_unidad_medida_id"), table_name="productos")
    op.drop_index(op.f("ix_productos_negocio_id"), table_name="productos")
    op.drop_index(op.f("ix_productos_codigo_barras"), table_name="productos")
    op.drop_index(op.f("ix_productos_categoria_id"), table_name="productos")
    op.drop_table("productos")
    op.drop_index(op.f("ix_unidades_medida_negocio_id"), table_name="unidades_medida")
    op.drop_table("unidades_medida")
    op.drop_index(op.f("ix_categorias_negocio_id"), table_name="categorias")
    op.drop_table("categorias")
    op.execute("DROP TYPE IF EXISTS tipoproducto")
