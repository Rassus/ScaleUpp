# ScaleUpp

Administración de negocio: ventas, inventario (FIFO + BOM virtual), stock y finanzas básicas.

## Estructura

```
ScaleUpp/
├── backend/          # FastAPI + SQLModel + Alembic + Postgres
├── frontend/         # React + Vite (luego Capacitor → APK Android)
└── docker-compose.yml
```

## Requisitos

- Python 3.12+
- Node.js 20+
- Docker Desktop (Postgres)

## Arranque rápido

### 1. Base de datos

```bash
docker compose up -d
```

Postgres queda en el puerto **5433** (evita choque con un Postgres local en 5432).

### 2. Backend

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000  
- Docs: http://localhost:8000/docs  
- Health: http://localhost:8000/health  

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: http://localhost:5173  

## Stack acordado

| Capa | Tecnología |
|------|------------|
| API | FastAPI |
| ORM | SQLModel / SQLAlchemy |
| Migraciones | Alembic |
| BD | PostgreSQL |
| App | React + Vite → Capacitor (Android primero) |
| Multi-tenant | `negocio_id` + `platform_admin` |

## Orden de desarrollo

1. Infra + health ✅  
2. Auth / multi-tenant ✅  
3. Catálogo (productos, categorías, unidades) ✅  
4. BOM virtual (kits/packs) ✅  
5. Lotes FIFO ✅  
6. Ventas ✅  
7. Caja / finanzas ✅  
8. Escáner + APK ✅  
9. KPIs ✅  

## Usuarios demo (seed)

```bash
cd backend
.\.venv\Scripts\Activate.ps1
python -m app.scripts.seed
```

| Email | Password | Rol |
|-------|----------|-----|
| admin@scaleupp.com | admin123 | platform_admin |
| owner@demo.com | owner123 | owner (Negocio Demo) |
| cajero@demo.com | cajero123 | cajero (Negocio Demo) |

## Auth API

- `POST /api/v1/auth/login` — body: `{ "email", "password", "negocio_id?" }`
- `GET /api/v1/auth/me` — Bearer token
- `GET/POST /api/v1/negocios` — solo platform_admin
- Header opcional: `X-Negocio-Id` para contexto de negocio

## Catálogo API (requiere negocio)

- `GET/POST /api/v1/unidades-medida`
- `GET/POST /api/v1/categorias`
- `GET/POST /api/v1/productos`
- `GET /api/v1/productos/codigo/{codigo_barras}`
- Escritura: rol `owner` o `platform_admin`

## Recetas BOM (kits virtuales)

- `GET /api/v1/productos/{id}/receta`
- `PUT /api/v1/productos/{id}/receta` — reemplaza componentes
- `GET /api/v1/productos/{id}/expandir?cantidad=1`
- MVP: componentes solo `SIMPLE` (sin kits anidados)
- Demo kit: `PROMO-BEBIDA-NACHOS` = 1 bebida + 1 nachos

## Stock FIFO

- `GET /api/v1/stock/resumen` — stock + alertas bajo/sobre
- `GET /api/v1/stock/lotes?producto_id=`
- `GET /api/v1/stock/movimientos`
- `POST /api/v1/stock/entradas` — crea lote + historial
- `POST /api/v1/stock/salidas/merma` — salida FIFO
- `POST /api/v1/stock/ajustes` — cantidad +/− 
- Costo real unitario = `precio_costo_neto + costo_operacion_prorrateado`
- Tests: `pytest tests/test_fifo.py`

## Ventas

- `POST /api/v1/ventas` — carrito (SIMPLE/KIT) + método de pago
- `GET /api/v1/ventas` · `GET /api/v1/ventas/{id}`
- Expande KIT → FIFO por componente → `venta_items` + `detalle_ventas`
- Totales con IVA incluido (19%); `ganancia = total_venta - costo_fifo`
- Requiere **caja abierta**
- Tests: `pytest tests/test_ventas.py`

## Caja / finanzas

- `GET /api/v1/caja/actual` · `GET /api/v1/caja`
- `POST /api/v1/caja/abrir` · `POST /api/v1/caja/cerrar`
- `GET /api/v1/caja/cuadre`
- `POST /api/v1/caja/gastos` (operativo / general / inyección)
- Cuadre efectivo = apertura + ingresos efectivo − egresos efectivo
- Tarjeta/transferencia **no** entran al efectivo teórico
- Tests: `pytest tests/test_caja.py`

## App Android (Capacitor)

```powershell
cd frontend
# Configura VITE_API_BASE_URL en .env (ver frontend/README.md)
npm run cap:sync
npm run cap:open
```

Escáner: cámara (EAN/QR) + input manual en el POS.

## KPIs

- `GET /api/v1/kpis?fecha=&top_n=5&dias_caducidad=30`
- Indicadores: venta/ganancia diaria y mensual, estrellas, impopulares, por vencer, bajo/sobre stock
- Ranking por SKU en `venta_items` (incluye kits como línea)
- Impopulares incluyen productos con 0 ventas en el mes
- Dashboard en la app tras el login
- Tests: `pytest tests/test_kpis.py`
