from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from access import Principal, dentist_id, dentist_user
from agenda import ahora_agenda, bloquear_agenda, cancelada, cargar_bloqueos, horario_bloqueado
from database import get_db


router = APIRouter(prefix="/bloqueos-agenda", tags=["Bloqueos de agenda"])


def odontologo_de_sesion(
    db: Session = Depends(get_db), principal: Principal = Depends(dentist_user),
):
    id_odontologo = dentist_id(db, principal)
    if id_odontologo is None:
        raise HTTPException(403, "Tu sesión debe estar asociada a un único perfil de odontólogo.")
    return id_odontologo


def validar_bloqueo(datos, hoy):
    if datos.tipo == "vacaciones":
        if not datos.fecha_desde or not datos.fecha_hasta or datos.fecha_hasta < max(datos.fecha_desde, hoy):
            raise HTTPException(422, "Elige un intervalo de vacaciones válido que incluya hoy o fechas futuras.")
        if datos.hora_desde is not None or datos.hora_hasta is not None:
            raise HTTPException(422, "Las vacaciones bloquean días completos.")
        return
    if datos.tipo == "descanso_puntual" and (not datos.fecha_desde or datos.fecha_desde < hoy):
        raise HTTPException(422, "Elige hoy o una fecha futura para el descanso.")
    if datos.fecha_hasta is not None:
        raise HTTPException(422, "El rango de fechas está reservado para vacaciones.")
    if datos.tipo == "descanso_diario" and datos.fecha_desde is not None:
        raise HTTPException(422, "El descanso diario se repite cada día y no lleva fechas.")
    if (datos.hora_desde is None or datos.hora_hasta is None or datos.hora_desde.tzinfo is not None
            or datos.hora_hasta.tzinfo is not None or datos.hora_desde >= datos.hora_hasta):
        raise HTTPException(422, "Indica horas locales de inicio y fin y deja el fin después del inicio.")


def consultar_propio(db, id_odontologo, id_bloqueo):
    bloqueo = db.query(models.BloqueoAgenda).filter_by(id_odontologo=id_odontologo, id_bloqueo=id_bloqueo).first()
    if bloqueo is None:
        raise HTTPException(404, "Bloqueo no encontrado en tu agenda.")
    return bloqueo


def validar_agenda_resultante(db, id_odontologo, *, actual=None, nuevo=None):
    ahora = ahora_agenda()
    guardados = cargar_bloqueos(db, [id_odontologo], ahora.date(), date.max).get(id_odontologo, ())
    siguientes = [item for item in guardados if actual is None or item.id_bloqueo != actual.id_bloqueo]
    if nuevo is not None:
        validar_bloqueo(nuevo, ahora.date())
        if nuevo.tipo != "vacaciones" and any(
            item.tipo == nuevo.tipo and item.fecha_desde == nuevo.fecha_desde for item in siguientes
        ):
            raise HTTPException(409, "Ya hay un descanso para ese periodo. Puedes editar el que está guardado.")
        siguientes.append(nuevo)

    cita = models.Cita
    citas = db.query(cita.fecha, cita.hora, cita.duracion_minutos, cita.estado).filter(
        cita.id_odontologo == id_odontologo, cita.fecha >= ahora.date(),
    ).order_by(cita.fecha, cita.hora)
    for item in citas:
        if cancelada(item.estado):
            continue
        inicio = datetime.combine(item.fecha, item.hora)
        fin = inicio + timedelta(minutes=item.duracion_minutos or 30)
        if fin > ahora and horario_bloqueado(siguientes, inicio, fin):
            hora = inicio.strftime("%H:%M")
            raise HTTPException(409, f"El cambio cruza con una cita el {item.fecha} a las {hora}. Reprograma la cita primero.")


@router.get("", response_model=list[schemas.BloqueoAgendaOut])
def listar_bloqueos(id_odontologo: int = Depends(odontologo_de_sesion), db: Session = Depends(get_db)):
    bloqueos = cargar_bloqueos(db, [id_odontologo], ahora_agenda().date(), date.max).get(id_odontologo, ())
    return sorted(bloqueos, key=lambda item: (item.fecha_desde or date.min, item.id_bloqueo))


@router.post("", status_code=201, response_model=schemas.BloqueoAgendaOut)
def crear_bloqueo(
    datos: schemas.BloqueoAgendaIn, id_odontologo: int = Depends(odontologo_de_sesion),
    db: Session = Depends(get_db),
):
    bloquear_agenda(db)
    validar_agenda_resultante(db, id_odontologo, nuevo=datos)
    bloqueo = models.BloqueoAgenda(id_odontologo=id_odontologo, **datos.model_dump())
    db.add(bloqueo)
    db.commit()
    db.refresh(bloqueo)
    return bloqueo


@router.put("/{id_bloqueo}", response_model=schemas.BloqueoAgendaOut)
def editar_bloqueo(
    id_bloqueo: int, datos: schemas.BloqueoAgendaIn,
    id_odontologo: int = Depends(odontologo_de_sesion), db: Session = Depends(get_db),
):
    bloquear_agenda(db)
    bloqueo = consultar_propio(db, id_odontologo, id_bloqueo)
    validar_agenda_resultante(db, id_odontologo, actual=bloqueo, nuevo=datos)
    for campo, valor in datos.model_dump().items():
        setattr(bloqueo, campo, valor)
    db.commit()
    db.refresh(bloqueo)
    return bloqueo


@router.delete("/{id_bloqueo}", status_code=204)
def quitar_bloqueo(
    id_bloqueo: int, id_odontologo: int = Depends(odontologo_de_sesion), db: Session = Depends(get_db),
):
    bloquear_agenda(db)
    bloqueo = consultar_propio(db, id_odontologo, id_bloqueo)
    validar_agenda_resultante(db, id_odontologo, actual=bloqueo)
    db.delete(bloqueo)
    db.commit()
