import os
import secrets
from datetime import datetime, timedelta, timezone
from html import escape

import models
from access import digest
from agenda import normalizar


def cita_finalizada(estado):
    return normalizar(estado) in {"finalizado", "finalizada", "completado", "completada"}


def programar_encuesta(db, cita):
    encuesta = db.query(models.EncuestaCita).filter_by(id_cita=cita.id_cita).one_or_none()
    if encuesta is None:
        db.add(models.EncuestaCita(id_cita=cita.id_cita))
    elif encuesta.respondida is not None:
        return
    correo = db.query(models.CorreoProgramado).filter_by(id_cita=cita.id_cita, tipo="encuesta").one_or_none()
    if correo is not None and correo.estado != "omitido":
        return

    ahora = datetime.now(timezone.utc)
    if correo is None:
        correo = models.CorreoProgramado(id_cita=cita.id_cita, tipo="encuesta")
        db.add(correo)
    correo.programado_para = ahora
    correo.vence = ahora + timedelta(days=7)
    correo.estado = "pendiente"
    correo.intentos = 0


def invitacion(db, cita, destino):
    if not cita_finalizada(cita.estado):
        return None
    encuesta = db.query(models.EncuestaCita).filter_by(id_cita=cita.id_cita).one_or_none()
    if encuesta is None or encuesta.respondida is not None:
        return None

    token = secrets.token_urlsafe(32)
    encuesta.token_hash = digest(token)
    encuesta.vence = datetime.now(timezone.utc) + timedelta(days=14)
    web = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")
    enlace = escape(f"{web}/encuesta#token={token}", quote=True)
    return destino, "Cuéntanos cómo fue tu cita en OdontoSoft", (
        "<h2>¿Cómo fue tu cita?</h2>"
        "<p>Califica la atención de 1 a 5 estrellas y deja un comentario si quieres compartir tu experiencia.</p>"
        f'<p><a href="{enlace}">Responder encuesta</a></p>'
        "<p>El enlace es personal y vence en 14 días. Si publicas tu opinión, aparecerá sin tu nombre.</p>"
    )
