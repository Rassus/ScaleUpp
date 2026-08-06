from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        from app.startup_passwords import ensure_demo_password_hashes

        ensure_demo_password_hashes()
    except Exception as exc:  # noqa: BLE001 — no tumbar el arranque por seed
        print(f"[startup] No se pudieron actualizar passwords demo: {exc}")
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)

# QA: web en Render (scaleupp-1) + APK Capacitor. Sin credentials → se permite "*".
_CORS_ORIGINS = [
    "https://scaleupp-1.onrender.com",
    "https://scaleupp.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Asegura JSON + CORS-friendly body ante errores no controlados."""
    origin = request.headers.get("origin")
    headers = {}
    if origin and (
        origin in _CORS_ORIGINS or origin.endswith(".onrender.com")
    ):
        headers["Access-Control-Allow-Origin"] = origin
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
        headers=headers,
    )


app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}
