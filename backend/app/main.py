from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.debug else [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://localhost",
        "capacitor://localhost",
        "http://localhost",
    ],
    allow_credentials=False if settings.debug else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}
