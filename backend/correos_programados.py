from calendar import monthrange
from datetime import date, datetime, time, timedelta, timezone
from html import escape

from sqlalchemy import func, select

import models
from access import correo_cuenta_paciente
from agenda import ZONA_AGENDA, normalizar
from database import SessionLocal
from encuestas import invitacion
from facturacion import destinatario_factura, factura_pdf
from notifications import NotificationService


ESTADOS_PROGRAMADOS = {"pendiente", "en espera", "confirmada", "confirmado", "reprogramada"}
TEXTOS_CITA = {
    "cita": ("Tu cita en OdontoSoft", "Estos son los datos de tu cita odontológica."),
    "recordatorio_24h": ("Recordatorio de tu cita odontológica", "Te recordamos tu próxima cita odontológica."),
    "recordatorio_1h": ("Tu cita odontológica es en aproximadamente una hora", "Tu cita odontológica se acerca."),
}


def cita_programada(estado):
    return normalizar(estado) in ESTADOS_PROGRAMADOS


def inicio_cita(cita):
    return datetime.combine(cita.fecha, cita.hora, tzinfo=ZONA_AGENDA).astimezone(timezone.utc)


def programar_bienvenida(db, usuario):
    ahora = datetime.now(timezone.utc)
    db.add(models.CorreoProgramado(
        tipo="bienvenida", id_usuario=usuario.id_usuario,
        programado_para=ahora, vence=ahora + timedelta(days=7),
    ))


def paciente_de_cumpleanos(db, id_usuario):
    paciente, usuario, enlace = models.Paciente, models.Usuario, models.usuario_paciente
    return db.scalar(select(paciente)
        .join(enlace, enlace.c.id_paciente == paciente.id_paciente)
        .join(usuario, enlace.c.id_usuario == usuario.id_usuario).where(
        usuario.id_usuario == id_usuario, usuario.rol == "Paciente",
    ).order_by(
        (func.lower(paciente.correo) == func.lower(usuario.correo)).desc().nulls_last(),
        paciente.id_paciente,
    ).limit(1))


def fecha_cumpleanos(nacimiento, year):
    day = min(nacimiento.day, monthrange(year, nacimiento.month)[1])
    return date(year, nacimiento.month, day)


def fijar_proximo_cumpleanos(item, nacimiento, ahora):
    hoy = ahora.astimezone(ZONA_AGENDA).date()
    dia = fecha_cumpleanos(nacimiento, hoy.year)
    ultimo_envio = item.ultimo_envio
    if ultimo_envio and ultimo_envio.tzinfo is None:
        ultimo_envio = ultimo_envio.replace(tzinfo=timezone.utc)
    if dia < hoy or (ultimo_envio and ultimo_envio.astimezone(ZONA_AGENDA).year >= hoy.year):
        dia = fecha_cumpleanos(nacimiento, hoy.year + 1)
    item.programado_para = datetime.combine(dia, time(9), ZONA_AGENDA).astimezone(timezone.utc)
    item.vence = datetime.combine(dia + timedelta(days=1), time.min, ZONA_AGENDA).astimezone(timezone.utc)
    item.estado, item.intentos = "pendiente", 0


def programar_cumpleanos(db, id_usuario, nacimiento):
    correo = models.CorreoProgramado
    item = db.scalar(select(correo).filter_by(
        id_usuario=id_usuario, tipo="cumpleanos",
    ).with_for_update())
    if item is None:
        item = correo(tipo="cumpleanos", id_usuario=id_usuario)
        db.add(item)
    fijar_proximo_cumpleanos(item, nacimiento, datetime.now(timezone.utc))


def programar_cita(db, cita):
    existentes = {
        item.tipo: item for item in db.query(models.CorreoProgramado).filter(
            models.CorreoProgramado.id_cita == cita.id_cita,
            models.CorreoProgramado.tipo.in_(TEXTOS_CITA),
        )
    }
    ahora = datetime.now(timezone.utc)
    inicio = inicio_cita(cita)
    nuevos = {}
    if cita_programada(cita.estado) and inicio > ahora:
        nuevos["cita"] = (ahora, inicio)
        dia = inicio - timedelta(days=1)
        hora = inicio - timedelta(hours=1)
        if dia > ahora:
            nuevos["recordatorio_24h"] = (dia, hora)
        if hora > ahora:
            nuevos["recordatorio_1h"] = (hora, inicio)

    for tipo, item in existentes.items():
        if tipo not in nuevos:
            db.delete(item)
    for tipo, (envio, vence) in nuevos.items():
        item = existentes.get(tipo)
        if item is None:
            item = models.CorreoProgramado(tipo=tipo, id_cita=cita.id_cita)
            db.add(item)
        item.programado_para, item.vence = envio, vence
        item.estado, item.intentos = "pendiente", 0


def mensaje(db, item):
    if item.tipo == "bienvenida":
        usuario = db.get(models.Usuario, item.id_usuario)
        if usuario and usuario.estado == "Activo":
            return usuario.correo, "Te damos la bienvenida a OdontoSoft", (
                "<h2>Bienvenido a OdontoSoft</h2><p>Tu cuenta está lista. "
                "Ya puedes ingresar para consultar y agendar tus citas.</p>"
            )
        return None

    cita = db.get(models.Cita, item.id_cita)
    if cita is None:
        return None
    paciente = db.get(models.Paciente, cita.id_paciente)
    if paciente is None:
        return None
    if item.tipo == "encuesta":
        destino = correo_cuenta_paciente(db, paciente.id_paciente, contacto_sin_cuenta=paciente.correo)
        return invitacion(db, cita, destino) if destino else None
    if not paciente.correo or not cita_programada(cita.estado):
        return None
    profesional = db.get(models.Odontologo, cita.id_odontologo)
    consultorio = db.get(models.Consultorio, cita.id_consultorio)
    odontologo = escape(f"{profesional.nombre} {profesional.apellido}") if profesional else "Por confirmar"
    sede = escape(consultorio.nombre) if consultorio else "Por confirmar"
    asunto, introduccion = TEXTOS_CITA[item.tipo]
    return paciente.correo, asunto, (
        f"<h2>OdontoSoft</h2><p>{introduccion}</p>"
        f"<p><strong>Fecha:</strong> {cita.fecha:%d/%m/%Y}<br>"
        f"<strong>Hora:</strong> {cita.hora:%H:%M} (Colombia)<br>"
        f"<strong>Odontólogo:</strong> {odontologo}<br><strong>Consultorio:</strong> {sede}</p>"
    )


async def procesar_correos():
    if not NotificationService.configurado():
        return
    correo = models.CorreoProgramado
    for _ in range(20):
        ahora = datetime.now(timezone.utc)
        with SessionLocal.begin() as db:
            item = db.scalar(select(correo).where(
                correo.estado == "pendiente", correo.programado_para <= ahora,
            ).order_by(correo.programado_para, correo.id).limit(1).with_for_update(skip_locked=True))
            if item is None:
                return
            vence = item.vence.replace(tzinfo=timezone.utc) if item.vence.tzinfo is None else item.vence
            if item.tipo == "cumpleanos":
                await procesar_cumpleanos(db, item, ahora, vence)
                continue
            if item.tipo == "factura":
                await procesar_factura(db, item, ahora, vence)
                continue
            contenido = mensaje(db, item) if ahora < vence else None
            if not contenido:
                item.estado = "omitido"
            elif await NotificationService.send_email(*contenido):
                item.estado = "enviado"
                item.ultimo_envio = ahora
            else:
                reintentar(item, ahora, vence)


def reintentar(item, ahora, vence):
    item.intentos += 1
    item.programado_para = min(vence, ahora + timedelta(minutes=2 ** min(item.intentos, 6)))


async def procesar_factura(db, item, ahora, vence):
    factura = db.get(models.Factura, item.id_factura)
    destino = destinatario_factura(db, factura) if factura and factura.id_paciente and ahora < vence else None
    if not destino:
        item.estado = "omitido"
        return
    if await NotificationService.send_email(
        destino, f"Tu comprobante OdontoSoft {factura.numero}",
        "<h2>Pago confirmado</h2><p>Te adjuntamos tu comprobante en PDF. También puedes descargarlo desde Facturación en OdontoSoft.</p>",
        pdf=(f"{factura.numero}.pdf", factura_pdf(factura)),
    ):
        item.estado = "enviado"
        item.ultimo_envio = ahora
    else:
        reintentar(item, ahora, vence)


async def procesar_cumpleanos(db, item, ahora, vence):
    paciente = paciente_de_cumpleanos(db, item.id_usuario)
    if paciente is None or not paciente.fecha_nacimiento:
        item.estado = "omitido"
        return
    nacimiento = paciente.fecha_nacimiento
    hoy = ahora.astimezone(ZONA_AGENDA).date()
    if ahora >= vence or fecha_cumpleanos(nacimiento, hoy.year) != hoy:
        fijar_proximo_cumpleanos(item, nacimiento, ahora)
        return
    usuario = db.get(models.Usuario, item.id_usuario)
    if usuario is None or usuario.estado != "Activo":
        fijar_proximo_cumpleanos(item, nacimiento, ahora + timedelta(days=1))
        return
    if await NotificationService.send_email(
        usuario.correo,
        "¡Feliz cumpleaños de parte del equipo de OdontoSoft!",
        "<h2>¡Feliz cumpleaños!</h2><p>El equipo de OdontoSoft te desea un día lleno de sonrisas.</p>",
    ):
        item.ultimo_envio = ahora
        fijar_proximo_cumpleanos(item, nacimiento, ahora)
    else:
        reintentar(item, ahora, vence)
