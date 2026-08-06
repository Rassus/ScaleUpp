import hashlib
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"

_DIGEST_RE = re.compile(r"^[a-f0-9]{64}$")


def client_password_digest(plain: str) -> str:
    """SHA-256 hex — mismo algoritmo que el frontend antes de enviar."""
    return hashlib.sha256(plain.encode("utf-8")).hexdigest()


def is_password_digest(value: str) -> bool:
    return bool(_DIGEST_RE.fullmatch(value))


def hash_password(password_digest: str) -> str:
    """Guarda bcrypt del digest que llega del cliente (o de hash_plain_password)."""
    return pwd_context.hash(password_digest)


def hash_plain_password(plain: str) -> str:
    """Solo para seed / scripts server-side: SHA-256 + bcrypt."""
    return hash_password(client_password_digest(plain))


def verify_password(password_digest: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password_digest, hashed)
    except Exception:
        return False


def verify_login_password(password: str, hashed: str) -> bool:
    """Acepta digest (cliente nuevo) o texto plano (legado / curl).

    Tolera hashes antiguos bcrypt(plano) cuando llega texto plano.
    """
    if not password or not hashed:
        return False
    if verify_password(password, hashed):
        return True
    if not is_password_digest(password):
        if verify_password(client_password_digest(password), hashed):
            return True
    return False


def create_access_token(
    *,
    subject: str,
    es_platform_admin: bool,
    negocio_id: Optional[int] = None,
    rol: Optional[str] = None,
    extra: Optional[dict[str, Any]] = None,
) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "type": "access",
        "es_platform_admin": es_platform_admin,
        "negocio_id": negocio_id,
        "rol": rol,
        "exp": expire,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(
    *,
    subject: str,
    es_platform_admin: bool,
    negocio_id: Optional[int] = None,
    rol: Optional[str] = None,
) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "type": "refresh",
        "es_platform_admin": es_platform_admin,
        "negocio_id": negocio_id,
        "rol": rol,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Token inválido o expirado") from exc


def decode_access_token(token: str) -> dict[str, Any]:
    payload = decode_token(token)
    # Tokens antiguos sin type siguen siendo access válidos
    if payload.get("type") not in (None, "access"):
        raise ValueError("Token inválido o expirado")
    return payload
