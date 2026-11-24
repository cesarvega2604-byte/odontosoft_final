from collections import defaultdict
from datetime import datetime, time
import unicodedata
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, or_, text

import models


ZONA_AGENDA = ZoneInfo("America/Bogota")
APERTURA = time(8)
CIERRE = time(18)


def ahora_agenda():
    return datetime.now(ZONA_AGENDA).replace(tzinfo=None)


def dentro_de_atencion(inicio, duracion):
    dia = inicio.date()
    return datetime.combine(dia, APERTURA) <= inicio and duracion <= datetime.combine(dia, CIERRE) - inicio


def bloquear_agenda(db):
    # Serializa reservas, reprogramaciones y cambios de disponibilidad hasta el fin de la transacción.
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(7301442026)"))


def normalizar(valor):
    return unicodedata.normalize("NFKD", str(valor or "")).encode("ascii", "ignore").decode().lower().strip()


def cancelada(estado):
    return normalizar(estado) in {"cancelado", "cancelada", "inasistencia", "no asistio"}


def se_solapan(inicio, fin, otro_inicio, otro_fin):
    return inicio < otro_fin and fin > otro_inicio


def cargar_bloqueos(db, odontologos, desde, hasta):
    bloqueo = models.BloqueoAgenda
    filas = db.query(bloqueo).filter(
        bloqueo.id_odontologo.in_(odontologos),
        or_(bloqueo.fecha_desde.is_(None), and_(
            bloqueo.fecha_desde <= hasta,
            func.coalesce(bloqueo.fecha_hasta, bloqueo.fecha_desde) >= desde,
        )),
    )
    por_odontologo = defaultdict(list)
    for fila in filas:
        por_odontologo[fila.id_odontologo].append(fila)
    return por_odontologo


def horario_bloqueado(bloqueos, inicio, fin):
    dia = inicio.date()
    diario = puntual = None
    for bloqueo in bloqueos:
        if bloqueo.tipo == "vacaciones" and bloqueo.fecha_desde <= dia <= bloqueo.fecha_hasta:
            return True
        if bloqueo.tipo == "descanso_diario":
            diario = bloqueo
        elif bloqueo.tipo == "descanso_puntual" and bloqueo.fecha_desde == dia:
            puntual = bloqueo

    descanso = puntual or diario
    return descanso is not None and se_solapan(
        inicio, fin, datetime.combine(dia, descanso.hora_desde), datetime.combine(dia, descanso.hora_hasta),
    )
