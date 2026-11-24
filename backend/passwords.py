"""Política y almacenamiento de contraseñas de OdontoSoft."""
import hashlib
import re
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
# Las rutas de entrada conservan el acceso a contraseñas heredadas más largas.
MAX_LOGIN_PASSWORD_LENGTH = 1024

hasher = PasswordHasher(time_cost=2, memory_cost=19 * 1024, parallelism=1)
dummy_hash = hasher.hash(secrets.token_urlsafe(32))
legacy_sha256 = re.compile(r"[0-9a-f]{64}")


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verificar_password(password: str, encoded: str | None) -> bool:
    if encoded and encoded.startswith("$argon2id$"):
        try:
            return hasher.verify(encoded, password)
        except VerificationError:
            return False
        except InvalidHashError:
            pass

    # Mantiene un coste comparable para cuentas inexistentes y hashes antiguos.
    try:
        hasher.verify(dummy_hash, password)
    except VerificationError:
        pass

    if encoded and legacy_sha256.fullmatch(encoded):
        previous = hashlib.sha256(password.strip().encode("utf-8")).hexdigest()
        return secrets.compare_digest(previous, encoded)
    return False


def password_needs_rehash(encoded: str) -> bool:
    return not encoded.startswith("$argon2id$") or hasher.check_needs_rehash(encoded)
