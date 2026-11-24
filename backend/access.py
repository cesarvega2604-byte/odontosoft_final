"""Sesiones de servidor y reglas compartidas de acceso."""
import hashlib
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from fastapi import Depends, HTTPException, Request
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

import models
from database import get_db
from passwords import hash_password, verificar_password

DESKTOP_MODE = os.getenv("ODONTO_DESKTOP_MODE") == "1"
COOKIE_NAME = "odontosoft_desktop_session" if DESKTOP_MODE else "odontosoft_session"
ENVIRONMENT = os.getenv("ODONTO_ENV", "development").strip().lower()
if ENVIRONMENT not in {"development", "production"}:
    raise ValueError("ODONTO_ENV debe ser development o production")
PRODUCTION = ENVIRONMENT == "production"
WEB_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "ODONTO_WEB_ORIGINS",
        "" if PRODUCTION else
        "http://127.0.0.1:5173,http://localhost:5173,"
        "http://127.0.0.1:8000,http://localhost:8000,"
        "http://127.0.0.1:8081,http://localhost:8081",
    ).split(",")
    if origin.strip()
]
if not WEB_ORIGINS:
    raise ValueError("Define los orígenes explícitos en ODONTO_WEB_ORIGINS")
for origin in WEB_ORIGINS:
    url = urlsplit(origin)
    schemes = {"https"} if PRODUCTION else {"http", "https"}
    if (
        url.scheme not in schemes or not url.hostname or url.username is not None
        or "*" in origin or any(character.isspace() for character in origin)
        or origin != f"{url.scheme}://{url.netloc.lower()}" or url.port == 0
    ):
        raise ValueError("ODONTO_WEB_ORIGINS debe contener orígenes exactos (HTTPS en producción)")

ACTIVE_APPOINTMENTS = (
    "pendiente", "en espera", "confirmada", "confirmado", "en consulta",
    "finalizado", "finalizada", "completado", "completada",
)
ROLES = {"Administrador", "Odontologo", "Paciente"}


@dataclass(frozen=True)
class Principal:
    user: models.Usuario
    session: models.SesionAcceso

    @property
    def role(self):
        return self.user.rol

    @property
    def user_id(self):
        return self.user.id_usuario


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def user_version(user):
    value = "\x00".join((user.correo, user.rol, user.estado, user.contrasena))
    return digest(value)


def check_origin(request, *, required=False):
    origin = request.headers.get("origin")
    if origin in WEB_ORIGINS:
        return
    if origin is None and not required:
        return
    raise HTTPException(403, "Origen de la solicitud no permitido")


def new_session(db, user, channel):
    now = datetime.now(timezone.utc)
    lifetime = timedelta(hours=8 if channel == "web" else 1)
    token = secrets.token_urlsafe(32)
    db.query(models.SesionAcceso).filter(
        models.SesionAcceso.id_usuario == user.id_usuario,
        models.SesionAcceso.expira <= now,
    ).delete(synchronize_session=False)
    db.add(models.SesionAcceso(
        token_hash=digest(token), id_usuario=user.id_usuario,
        usuario_version=user_version(user), expira=now + lifetime, canal=channel,
    ))
    return token, int(lifetime.total_seconds())


def cookie_options(request):
    local_http = request.url.scheme == "http" and request.url.hostname in {"localhost", "127.0.0.1", "::1"}
    return {
        "httponly": True, "secure": PRODUCTION or not local_http, "samesite": "strict",
        "path": "/api" if DESKTOP_MODE else "/",
    }


def revoke_sessions(db, user_id):
    db.query(models.SesionAcceso).filter(models.SesionAcceso.id_usuario == user_id).delete(synchronize_session=False)


def invalidate_reset_links(db, user_id):
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.id_usuario == user_id,
        models.PasswordResetToken.usado.is_(False),
    ).update({"usado": True}, synchronize_session=False)


def change_password(db, user, password):
    if user.requiere_restablecer_contrasena and verificar_password(password, user.contrasena):
        raise HTTPException(400, "Elige una contraseña distinta de la anterior")
    user.contrasena = hash_password(password)
    user.requiere_restablecer_contrasena = False
    revoke_sessions(db, user.id_usuario)
    invalidate_reset_links(db, user.id_usuario)


def resolve_session(request, db, *, mobile=False):
    authorization = request.headers.get("authorization")
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if not mobile or scheme.lower() != "bearer":
            raise HTTPException(401, "Inicia sesión para continuar")
        channel = "consultorios"
    else:
        token = request.cookies.get(COOKIE_NAME)
        channel = "web"
    if not token or len(token) != 43 or not token.isascii():
        return None
    if channel == "web" and request.method not in {"GET", "HEAD", "OPTIONS"}:
        check_origin(request, required=True)
    row = db.execute(
        select(models.SesionAcceso, models.Usuario)
        .join(models.Usuario, models.Usuario.id_usuario == models.SesionAcceso.id_usuario)
        .where(
            models.SesionAcceso.token_hash == digest(token),
            models.SesionAcceso.expira > datetime.now(timezone.utc),
            models.SesionAcceso.canal == channel,
            models.Usuario.estado == "Activo",
            models.Usuario.requiere_restablecer_contrasena.is_(False),
        )
    ).one_or_none()
    if not row:
        return None
    session, user = row
    if user.rol not in ROLES or not secrets.compare_digest(session.usuario_version, user_version(user)):
        return None
    return Principal(user, session)


def current_user(request: Request, db: Session = Depends(get_db)):
    principal = resolve_session(request, db)
    if principal is None:
        raise HTTPException(401, "Inicia sesión para continuar")
    return principal


def require_role(principal, *roles):
    if principal.role not in roles:
        raise HTTPException(403, "No tienes permiso para realizar esta acción")
    return principal


def admin_user(principal: Principal = Depends(current_user)):
    return require_role(principal, "Administrador")


def dentist_user(principal: Principal = Depends(current_user)):
    return require_role(principal, "Odontologo")


def consultorio_user(request: Request, db: Session = Depends(get_db)):
    principal = resolve_session(request, db, mobile=True)
    if principal is None:
        raise HTTPException(401, "Inicia sesión para continuar")
    if principal.session.canal == "consultorios" or request.method not in {"GET", "HEAD"}:
        require_role(principal, "Administrador")
    return principal


def dentist_id(db, principal):
    matches = db.scalars(select(models.Odontologo.id_odontologo).where(
        models.Odontologo.correo == principal.user.correo
    ).limit(2)).all()
    return matches[0] if len(matches) == 1 else None


def patient_ids(db, principal):
    link = models.usuario_paciente.c
    if principal.role == "Paciente":
        return select(link.id_paciente).where(link.id_usuario == principal.user_id)
    return select(models.Cita.id_paciente).where(assigned_visit(db, principal))


def assigned_visit(db, principal):
    return and_(
        models.Cita.id_odontologo == dentist_id(db, principal),
        models.Cita.id_odontologo.is_not(None),
        func.lower(func.trim(models.Cita.estado)).in_(ACTIVE_APPOINTMENTS),
    )


def correo_cuenta_paciente(db, patient_id, *, contacto_sin_cuenta=None):
    user, patient, link = models.Usuario, models.Paciente, models.usuario_paciente
    preferido = (func.lower(user.correo) == func.lower(patient.correo)).label("preferido")
    cuentas = db.execute(
        select(user.correo, user.estado, preferido)
        .join(link, link.c.id_usuario == user.id_usuario)
        .join(patient, patient.id_paciente == link.c.id_paciente)
        .where(patient.id_paciente == patient_id, user.rol == "Paciente")
    ).all()
    activas = [cuenta for cuenta in cuentas if cuenta.estado == "Activo"]
    if len(activas) == 1:
        return activas[0].correo
    if activas:
        preferidas = [cuenta for cuenta in activas if cuenta.preferido]
        return preferidas[0].correo if len(preferidas) == 1 else None
    return contacto_sin_cuenta if not cuentas else None


def require_patient(db, principal, patient_id, *, clinical=False):
    if clinical:
        require_role(principal, "Odontologo")
    elif principal.role == "Administrador":
        return
    if principal.role == "Odontologo":
        query = select(models.Cita.id_cita).where(
            assigned_visit(db, principal), models.Cita.id_paciente == patient_id,
        ).order_by(models.Cita.id_cita).limit(1).with_for_update(read=True)
    else:
        query = patient_ids(db, principal).where(models.usuario_paciente.c.id_paciente == patient_id).limit(1)
    if db.scalar(query) is None:
        raise HTTPException(403, "No tienes permiso para acceder a este paciente")


def available_appointments(db, principal, query):
    if principal.role == "Odontologo":
        return query.filter(models.Cita.id_odontologo == dentist_id(db, principal))
    if principal.role == "Paciente":
        return query.filter(models.Cita.id_paciente.in_(patient_ids(db, principal)))
    return query


def require_appointment(db, principal, appointment, *, write=False):
    if write:
        require_role(principal, "Administrador", "Odontologo")
    if principal.role == "Odontologo" and appointment.id_odontologo != dentist_id(db, principal):
        raise HTTPException(403, "No tienes permiso para acceder a esta cita")
    if principal.role == "Paciente":
        require_patient(db, principal, appointment.id_paciente)
