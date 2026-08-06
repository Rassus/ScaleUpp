"""Asegura que cuentas demo usen bcrypt(SHA-256(plano)).

Evita 401 tras migrar el cliente a digest mientras la BD QA aún tiene
hashes antiguos bcrypt(plano).
"""

from sqlmodel import Session, select

from app.core.security import (
    client_password_digest,
    hash_plain_password,
    verify_login_password,
)
from app.db import engine
from app.models import Usuario

# email → password plano conocida (solo demos / seed)
_DEMO_PASSWORDS: dict[str, str] = {
    "admin@scaleupp.com": "admin123",
    "owner@demo.com": "owner123",
    "cajero@demo.com": "cajero123",
}


def ensure_demo_password_hashes() -> None:
    updated = 0
    with Session(engine) as session:
        for email, plain in _DEMO_PASSWORDS.items():
            user = session.exec(
                select(Usuario).where(Usuario.email == email)
            ).first()
            if user is None:
                continue
            digest = client_password_digest(plain)
            if verify_login_password(digest, user.password_hash):
                continue
            user.password_hash = hash_plain_password(plain)
            user.debe_cambiar_password = False
            session.add(user)
            updated += 1
        if updated:
            session.commit()
            print(f"[startup] Actualizadas {updated} contraseñas demo a digest")
