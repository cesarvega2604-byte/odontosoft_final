# utils.py - Funciones comunes para el backend

import re
import random
import string
from sqlalchemy.orm import Session
import models
import secrets

# ── Validación de correo ─────────────────────────────────────────────────────

def validar_correo(correo: str) -> bool:
    """Valida que el correo tenga formato correcto usando expresión regular."""
    patron = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(patron, correo) is not None


# ── Generar documento único ──────────────────────────────────────────────────

def generar_documento_unico(db: Session) -> str:
    """Genera un número de documento único para el paciente."""
    while True:
        doc = "CC" + ''.join(random.choices(string.digits, k=8))
        existe = db.query(models.Paciente).filter(
            models.Paciente.documento == doc
        ).first()
        if not existe:
            return doc

def generar_token_seguro() -> str:
    """Genera un token aleatorio criptográficamente seguro para
    restablecimiento de contraseña (URL-safe, ~43 caracteres)."""
    return secrets.token_urlsafe(32)

        