from fastapi import APIRouter

from app.api import (
    admin,
    auth,
    avisos,
    caja,
    categorias,
    clientes,
    compras,
    config,
    creditos,
    demanda_faltante,
    equipo,
    health,
    kpis,
    negocios,
    productos,
    promociones,
    recetas,
    stock,
    tickets,
    unidades_medida,
    ventas,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(tickets.admin_tickets_router)
api_router.include_router(tickets.router)
api_router.include_router(avisos.router)
api_router.include_router(negocios.router)
api_router.include_router(equipo.router)
api_router.include_router(config.router)
api_router.include_router(unidades_medida.router)
api_router.include_router(categorias.router)
api_router.include_router(clientes.router)
api_router.include_router(creditos.router)
api_router.include_router(recetas.router)
api_router.include_router(productos.router)
api_router.include_router(promociones.router)
api_router.include_router(promociones.precio_router)
api_router.include_router(stock.router)
api_router.include_router(demanda_faltante.router)
api_router.include_router(compras.router)
api_router.include_router(ventas.router)
api_router.include_router(caja.router)
api_router.include_router(kpis.router)
