# ============================================================
# CITAS.PY - CRUD COMPLETO DE CITAS (CON NOTIFICACIONES DE CORREO)
# ============================================================
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    BackgroundTasks,
    Query,
)

from sqlalchemy.orm import (
    Session,
    selectinload
)

from typing import List, Optional
from collections import defaultdict
from datetime import date, datetime, time, timedelta
import re
from sqlalchemy import or_

import models
import schemas
from database import get_db
from agenda import (
    APERTURA, CIERRE, ahora_agenda, bloquear_agenda, cancelada, cargar_bloqueos,
    dentro_de_atencion, horario_bloqueado, normalizar, se_solapan,
)
from access import (
    Principal, available_appointments, current_user, dentist_id, patient_ids,
    require_appointment, require_patient, require_role,
)
from correos_programados import cita_programada, programar_cita
from encuestas import cita_finalizada, programar_encuesta
from telegram_service import notificar_confirmacion_cita_telegram

router = APIRouter(
    prefix="/citas",
    tags=["Citas"], dependencies=[Depends(current_user)]
)

HORARIOS_ALTERNATIVA = tuple(
    time(minutes // 60, minutes % 60) for minutes in range(APERTURA.hour * 60, CIERRE.hour * 60, 15)
)
HORARIOS_SUGERIDOS = HORARIOS_ALTERNATIVA[::2]
DIAS_ALTERNATIVA = 30


def duracion_tratamiento(tratamiento):
    valor = normalizar(getattr(tratamiento, "duracion_estimada", ""))
    numeros = re.findall(r"\d+(?:[.,]\d+)?", valor)
    if not numeros:
        return 30
    numero = float(numeros[0].replace(",", "."))
    if "hora" in valor:
        numero *= 60
        if len(numeros) > 1 and "min" in valor:
            numero += float(numeros[1].replace(",", "."))
    return max(5, min(480, int(numero)))


def tratamiento_reserva(db, id_tratamiento):
    if id_tratamiento is not None:
        tratamiento = db.get(models.Tratamiento, id_tratamiento)
        if tratamiento is None:
            raise HTTPException(404, "Tratamiento no encontrado")
        return tratamiento
    tratamientos = db.query(models.Tratamiento).order_by(models.Tratamiento.id_tratamiento)
    return next((item for item in tratamientos if es_valoracion(item)), None)


def es_valoracion(tratamiento):
    return normalizar(getattr(tratamiento, "nombre", None)) in {"valoracion inicial", "valoracion"}


def paciente_reserva(db, principal):
    require_role(principal, "Paciente")
    paciente = db.query(models.Paciente).filter(
        models.Paciente.id_paciente.in_(patient_ids(db, principal))
    ).order_by(models.Paciente.id_paciente).first()
    if paciente is None:
        raise HTTPException(404, "El usuario no tiene un paciente asociado. Contacta al administrador.")
    return paciente


def validar_horario(db, valores, excluir=None):
    fecha, hora = valores["fecha"], valores["hora"]
    if hora.tzinfo is not None:
        raise HTTPException(422, "Usa una hora local sin zona horaria; la agenda utiliza America/Bogota")
    inicio = datetime.combine(fecha, hora)
    fin = inicio + timedelta(minutes=valores.get("duracion_minutos") or 30)
    if fin.date() != fecha:
        raise HTTPException(422, "La cita debe terminar el mismo día")
    if cancelada(valores.get("estado")):
        return
    if fin > ahora_agenda():
        profesional = valores["id_odontologo"]
        bloqueos = cargar_bloqueos(db, [profesional], fecha, fecha)
        if horario_bloqueado(bloqueos.get(profesional, ()), inicio, fin):
            raise HTTPException(409, "El horario elegido ya no está disponible. Selecciona otra hora.")
    candidatas = db.query(models.Cita).filter(
        models.Cita.fecha == fecha,
        or_(models.Cita.id_odontologo == valores["id_odontologo"],
            models.Cita.id_paciente == valores["id_paciente"],
            models.Cita.id_consultorio == valores["id_consultorio"])
    ).all()
    for otra in candidatas:
        if otra.id_cita == excluir or cancelada(otra.estado):
            continue
        desde = datetime.combine(otra.fecha, otra.hora)
        hasta = desde + timedelta(minutes=otra.duracion_minutos or 30)
        if se_solapan(inicio, fin, desde, hasta):
            if otra.id_odontologo == valores["id_odontologo"]:
                raise HTTPException(409, "El odontólogo ya está ocupado a esa hora. Elige otro horario.")
            if otra.id_paciente == valores["id_paciente"]:
                raise HTTPException(409, "El paciente ya tiene otra cita en ese horario.")
            raise HTTPException(409, "El consultorio ya está ocupado en ese horario.")


def cargar_disponibilidad(db, desde, hasta, doctores, paciente_id):
    cita = models.Cita
    filas = db.query(
        cita.fecha, cita.hora, cita.duracion_minutos, cita.estado,
        cita.id_paciente, cita.id_odontologo, cita.id_consultorio,
    ).filter(
        cita.fecha.between(desde, hasta),
        or_(
            cita.id_paciente == paciente_id,
            cita.id_odontologo.in_(doctor.id_odontologo for doctor in doctores),
            cita.id_consultorio.in_(doctor.id_consultorio for doctor in doctores),
        ),
    )
    ocupacion = defaultdict(list)
    for fila in filas:
        if cancelada(fila.estado):
            continue
        inicio = datetime.combine(fila.fecha, fila.hora)
        intervalo = (inicio, inicio + timedelta(minutes=fila.duracion_minutos or 30))
        ocupacion[fila.fecha, "odontologo", fila.id_odontologo].append(intervalo)
        ocupacion[fila.fecha, "consultorio", fila.id_consultorio].append(intervalo)
        ocupacion[fila.fecha, "paciente", fila.id_paciente].append(intervalo)
    return ocupacion


def horario_libre(ocupacion, bloqueos, inicio, duracion, doctor, paciente_id):
    dia = inicio.date()
    if not dentro_de_atencion(inicio, duracion):
        return False
    fin = inicio + duracion
    if horario_bloqueado(bloqueos.get(doctor.id_odontologo, ()), inicio, fin):
        return False
    return not any(
        se_solapan(inicio, fin, desde, hasta)
        for clave in ((dia, "odontologo", doctor.id_odontologo),
                      (dia, "consultorio", doctor.id_consultorio), (dia, "paciente", paciente_id))
        for desde, hasta in ocupacion.get(clave, ())
    )


@router.get("/disponibilidad/odontologo/{odontologo_id}")
def disponibilidad(
    odontologo_id: int, fecha: date, hora: Optional[time] = None,
    id_tratamiento: Optional[int] = Query(default=None, gt=0),
    db: Session = Depends(get_db), principal: Principal = Depends(current_user),
):
    paciente = paciente_reserva(db, principal)
    doctor = db.get(models.Odontologo, odontologo_id)
    if doctor is None:
        raise HTTPException(404, "Odontólogo no encontrado")
    if hora is not None and hora.tzinfo is not None:
        raise HTTPException(422, "Selecciona una hora local de Colombia sin desplazamiento horario")
    minutos = duracion_tratamiento(tratamiento_reserva(db, id_tratamiento))
    duracion = timedelta(minutes=minutos)
    ocupacion = cargar_disponibilidad(db, fecha, fecha, [doctor], paciente.id_paciente)
    bloqueos = cargar_bloqueos(db, [odontologo_id], fecha, fecha)
    ahora = ahora_agenda()

    def libre(horario):
        inicio = datetime.combine(fecha, horario)
        return inicio > ahora and horario_libre(ocupacion, bloqueos, inicio, duracion, doctor, paciente.id_paciente)

    return {
        "horarios": [horario.strftime("%H:%M") for horario in HORARIOS_SUGERIDOS if libre(horario)],
        "hora_disponible": libre(hora) if hora is not None else None,
        "duracion_minutos": minutos,
    }


@router.get("/disponibilidad/alternativa", response_model=Optional[schemas.HorarioAlternativo])
def alternativa(
    odontologo_id: int, fecha: date, hora: Optional[time] = None,
    id_tratamiento: Optional[int] = Query(default=None, gt=0),
    db: Session = Depends(get_db), principal: Principal = Depends(current_user),
):
    paciente = paciente_reserva(db, principal)
    preferido = db.get(models.Odontologo, odontologo_id)
    if preferido is None:
        raise HTTPException(404, "Odontólogo no encontrado")
    if hora is not None and hora.tzinfo is not None:
        raise HTTPException(422, "Selecciona una hora local de Colombia sin desplazamiento horario")

    tratamiento = tratamiento_reserva(db, id_tratamiento)
    duracion = timedelta(minutes=duracion_tratamiento(tratamiento))
    odontologo, usuario, consultorio = models.Odontologo, models.Usuario, models.Consultorio
    candidatos = db.query(odontologo, consultorio.nombre).join(
        usuario, usuario.correo == odontologo.correo,
    ).join(consultorio, consultorio.id_consultorio == odontologo.id_consultorio).filter(
        odontologo.id_odontologo != odontologo_id, usuario.estado == "Activo", usuario.rol == "Odontologo",
    ).order_by(odontologo.id_consultorio != preferido.id_consultorio, odontologo.id_odontologo).all()
    if id_tratamiento is not None and not es_valoracion(tratamiento):
        especialidad = normalizar(preferido.especialidad)
        candidatos = [(doctor, sede) for doctor, sede in candidatos if especialidad and
                      normalizar(doctor.especialidad) == especialidad]
    if not candidatos:
        return None

    ahora = ahora_agenda()
    solicitado = datetime.combine(fecha, hora or time.min)
    primer_dia = max(ahora, solicitado).date()
    ultimo_dia = date.fromordinal(min(primer_dia.toordinal() + DIAS_ALTERNATIVA - 1, date.max.toordinal()))
    ocupacion = cargar_disponibilidad(db, primer_dia, ultimo_dia, [doctor for doctor, _ in candidatos], paciente.id_paciente)
    bloqueos = cargar_bloqueos(db, [doctor.id_odontologo for doctor, _ in candidatos], primer_dia, ultimo_dia)

    for dia in range(primer_dia.toordinal(), ultimo_dia.toordinal() + 1):
        fecha_candidata = date.fromordinal(dia)
        for horario in HORARIOS_ALTERNATIVA:
            inicio = datetime.combine(fecha_candidata, horario)
            if inicio <= ahora or inicio < solicitado:
                continue
            for doctor, sede in candidatos:
                if horario_libre(ocupacion, bloqueos, inicio, duracion, doctor, paciente.id_paciente):
                    return schemas.HorarioAlternativo(
                        id_odontologo=doctor.id_odontologo, odontologo=f"{doctor.nombre} {doctor.apellido}",
                        consultorio=sede, fecha=fecha_candidata, hora=horario.strftime("%H:%M"),
                    )
    return None


@router.post("/reservar/paciente", response_model=schemas.CitaOut, status_code=201)
def reservar_paciente(data: schemas.ReservaPaciente, background_tasks: BackgroundTasks, db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    bloquear_agenda(db)
    require_role(principal, "Paciente")
    if data.id_usuario != principal.user_id:
        raise HTTPException(403, "Solo puedes reservar con tu propia cuenta")
    paciente = paciente_reserva(db, principal)
    doctor = db.get(models.Odontologo, data.id_odontologo)
    if not doctor:
        raise HTTPException(404, "Odontólogo no encontrado")
    if data.hora.tzinfo is not None:
        raise HTTPException(422, "Selecciona una hora local de Colombia sin desplazamiento horario")
    inicio = datetime.combine(data.fecha, data.hora)
    if inicio <= ahora_agenda():
        raise HTTPException(422, "Selecciona una fecha y hora futuras")
    tratamiento = tratamiento_reserva(db, data.id_tratamiento)
    minutos = duracion_tratamiento(tratamiento)
    if not dentro_de_atencion(inicio, timedelta(minutes=minutos)):
        raise HTTPException(422, "La cita debe quedar completa entre las 08:00 y las 18:00, hora de Colombia.")
    if not tratamiento:
        tratamiento = models.Tratamiento(nombre="Valoración inicial", descripcion="Cita inicial de valoración odontológica", duracion_estimada="30 minutos")
        db.add(tratamiento)
        db.flush()
    cita = schemas.CitaCreate(id_paciente=paciente.id_paciente, id_odontologo=doctor.id_odontologo,
        id_consultorio=doctor.id_consultorio, id_tratamiento=tratamiento.id_tratamiento,
        fecha=data.fecha, hora=data.hora, duracion_minutos=minutos,
        estado="En Espera", motivo_consulta=data.motivo_consulta or tratamiento.nombre)
    return _create_cita(cita, background_tasks, db)


# ============================================================
# OBTENER TODAS LAS CITAS
# ============================================================

@router.get(
    "/",
    response_model=List[schemas.CitaOut]
)
def get_citas(
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    query = (
        db.query(models.Cita)
        .options(
            selectinload(models.Cita.tratamientos),
            selectinload(models.Cita.odontologo)
        )

    )
    return available_appointments(db, principal, query).all()


# ============================================================
# OBTENER UNA CITA
# ============================================================

@router.get(
    "/{id}",
    response_model=schemas.CitaOut
)
def get_cita(
    id: int,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    cita = (
        db.query(models.Cita)
        .options(
            selectinload(models.Cita.tratamientos),
            selectinload(models.Cita.odontologo)
        )
        .filter(models.Cita.id_cita == id)
        .first()
    )

    if not cita:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada"
        )

    require_appointment(db, principal, cita)
    return cita


# ============================================================
# CITAS POR PACIENTE
# ============================================================

@router.get(
    "/paciente/{paciente_id}",
    response_model=List[schemas.CitaOut]
)
def get_citas_por_paciente(
    paciente_id: int,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    require_patient(db, principal, paciente_id)
    query = (
        db.query(models.Cita)
        .options(
            selectinload(models.Cita.tratamientos),
            selectinload(models.Cita.odontologo)
        )
        .filter(models.Cita.id_paciente == paciente_id)

    )
    return available_appointments(db, principal, query).all()


# ============================================================
# CITAS POR ODONTÓLOGO
# ============================================================

@router.get(
    "/odontologo/{odontologo_id}",
    response_model=List[schemas.CitaOut]
)
def get_citas_por_odontologo(
    odontologo_id: int,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    require_role(principal, "Administrador", "Odontologo")
    if principal.role == "Odontologo" and odontologo_id != dentist_id(db, principal):
        raise HTTPException(403, "Solo puedes consultar tu propia agenda")
    query = (
        db.query(models.Cita)
        .options(
            selectinload(models.Cita.tratamientos),
            selectinload(models.Cita.odontologo)
        )
        .filter(models.Cita.id_odontologo == odontologo_id)

    )
    return available_appointments(db, principal, query).all()


# ============================================================
# CITAS POR CONSULTORIO
# ============================================================

@router.get(
    "/consultorio/{consultorio_id}",
    response_model=List[schemas.CitaOut]
)
def get_citas_por_consultorio(
    consultorio_id: int,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    require_role(principal, "Administrador", "Odontologo")
    query = (
        db.query(models.Cita)
        .options(
            selectinload(models.Cita.tratamientos),
            selectinload(models.Cita.odontologo)
        )
        .filter(models.Cita.id_consultorio == consultorio_id)

    )
    return available_appointments(db, principal, query).all()


# ============================================================
# CREAR CITA (CON ENVÍO DE CORREO)
# ============================================================

@router.post(
    "/",
    response_model=schemas.CitaOut,
    status_code=status.HTTP_201_CREATED
)
def create_cita(
    data: schemas.CitaCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    require_role(principal, "Administrador", "Odontologo")
    if principal.role == "Odontologo":
        bloquear_agenda(db)
        if data.id_odontologo != dentist_id(db, principal):
            raise HTTPException(403, "Solo puedes crear citas en tu propia agenda")
        require_patient(db, principal, data.id_paciente)
    return _create_cita(data, background_tasks, db)


def _create_cita(data, background_tasks, db):
    bloquear_agenda(db)
    # --------------------------------------------------------
    # VALIDAR PACIENTE
    # --------------------------------------------------------
    paciente = (
        db.query(models.Paciente)
        .filter(models.Paciente.id_paciente == data.id_paciente)
        .first()
    )

    if not paciente:
        raise HTTPException(
            status_code=400,
            detail="El paciente no existe"
        )

    # --------------------------------------------------------
    # VALIDAR ODONTÓLOGO
    # --------------------------------------------------------
    odontologo = (
        db.query(models.Odontologo)
        .filter(models.Odontologo.id_odontologo == data.id_odontologo)
        .first()
    )

    if not odontologo:
        raise HTTPException(
            status_code=400,
            detail="El odontólogo no existe"
        )

    # --------------------------------------------------------
    # VALIDAR CONSULTORIO
    # --------------------------------------------------------
    consultorio = (
        db.query(models.Consultorio)
        .filter(models.Consultorio.id_consultorio == data.id_consultorio)
        .first()
    )

    if not consultorio:
        raise HTTPException(
            status_code=400,
            detail="El consultorio no existe"
        )

    # --------------------------------------------------------
    # CREAR CITA EN BD
    # --------------------------------------------------------
    tratamiento = db.get(models.Tratamiento, data.id_tratamiento) if data.id_tratamiento else None
    if data.id_tratamiento and not tratamiento:
        raise HTTPException(404, "Tratamiento no encontrado")
    valores = data.model_dump(exclude={"id_tratamiento"})
    if tratamiento and "duracion_minutos" not in data.model_fields_set:
        valores["duracion_minutos"] = duracion_tratamiento(tratamiento)
    validar_horario(db, valores)
    nueva = models.Cita(**valores)
    if tratamiento:
        nueva.tratamientos.append(tratamiento)
    db.add(nueva)
    db.flush()
    programar_cita(db, nueva)
    db.commit()
    db.refresh(nueva)

    # --------------------------------------------------------
    # DEVOLVER CITA CON RELACIONES
    # --------------------------------------------------------
    cita_creada = (
        db.query(models.Cita)
        .options(
            selectinload(models.Cita.tratamientos),
            selectinload(models.Cita.odontologo)
        )
        .filter(models.Cita.id_cita == nueva.id_cita)
        .first()
    )

    # 🟢 ------------------------------------------------------
    # NOTIFICACIÓN A TELEGRAM (CONFIRMACIÓN DE CITA)
    # --------------------------------------------------------
    nombre_paciente = f"{paciente.nombre} {paciente.apellido}" if paciente else "Paciente"
    nombre_odontologo = f"{odontologo.nombre} {odontologo.apellido}" if odontologo else "Odontólogo"
    
    background_tasks.add_task(
        notificar_confirmacion_cita_telegram,
        paciente_nombre=nombre_paciente,
        fecha=str(cita_creada.fecha),
        hora=str(cita_creada.hora),
        odontologo_nombre=nombre_odontologo,
        motivo=getattr(cita_creada, "motivo", "Consulta Odontológica")
    )



    return cita_creada


# ============================================================
# ACTUALIZAR CITA
# ============================================================

@router.post("/{id}/finalizar", response_model=schemas.CitaOut)
def finalizar_cita(id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    require_role(principal, "Odontologo")
    bloquear_agenda(db)
    cita = db.get(models.Cita, id)
    if cita is None:
        raise HTTPException(404, "Cita no encontrada")
    require_appointment(db, principal, cita, write=True)
    if cancelada(cita.estado):
        raise HTTPException(409, "Una cita cancelada o con inasistencia no se puede finalizar")
    if not cita_finalizada(cita.estado):
        cita.estado = "Finalizado"
        programar_cita(db, cita)
        programar_encuesta(db, cita)
    db.commit()
    return cita


@router.put(
    "/{id}",
    response_model=schemas.CitaOut
)
def update_cita(
    id: int,
    data: schemas.CitaUpdate,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    bloquear_agenda(db)
    cita = (
        db.query(models.Cita)
        .options(
            selectinload(models.Cita.tratamientos),
            selectinload(models.Cita.odontologo)
        )
        .filter(models.Cita.id_cita == id)
        .first()
    )

    if not cita:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada"
        )

    require_appointment(db, principal, cita, write=True)
    update_data = data.model_dump(exclude_unset=True)

    if principal.role == "Odontologo":
        require_patient(db, principal, cita.id_paciente)
        for field in ("id_paciente", "id_odontologo"):
            if field in update_data and update_data[field] != getattr(cita, field):
                raise HTTPException(403, "Solo administración puede reasignar una cita")

    tratamiento_id = update_data.pop("id_tratamiento", None)
    if any(v is None for k,v in update_data.items() if k in {"fecha","hora","id_paciente","id_odontologo","id_consultorio","duracion_minutos"}):
        raise HTTPException(422, "Los datos de agenda no pueden ser nulos")
    tratamiento = db.get(models.Tratamiento, tratamiento_id) if tratamiento_id else None
    if tratamiento_id and not tratamiento:
        raise HTTPException(404, "Tratamiento no encontrado")
    if tratamiento and "duracion_minutos" not in update_data:
        update_data["duracion_minutos"] = duracion_tratamiento(tratamiento)
    valores = {k:getattr(cita,k) for k in ("fecha","hora","duracion_minutos","id_paciente","id_odontologo","id_consultorio","estado")}
    valores.update(update_data)
    validar_horario(db, valores, excluir=id)
    if tratamiento:
        cita.tratamientos = [tratamiento]
    if any(valores[key] != getattr(cita, key) for key in ("fecha", "hora")):
        cita.recordatorio_enviado = False

    # VALIDAR PACIENTE
    if "id_paciente" in update_data:
        paciente = (
            db.query(models.Paciente)
            .filter(models.Paciente.id_paciente == update_data["id_paciente"])
            .first()
        )
        if not paciente:
            raise HTTPException(status_code=400, detail="El paciente no existe")

    # VALIDAR ODONTÓLOGO
    if "id_odontologo" in update_data:
        odontologo = (
            db.query(models.Odontologo)
            .filter(models.Odontologo.id_odontologo == update_data["id_odontologo"])
            .first()
        )
        if not odontologo:
            raise HTTPException(status_code=400, detail="El odontólogo no existe")

    # VALIDAR CONSULTORIO
    if "id_consultorio" in update_data:
        consultorio = (
            db.query(models.Consultorio)
            .filter(models.Consultorio.id_consultorio == update_data["id_consultorio"])
            .first()
        )
        if not consultorio:
            raise HTTPException(status_code=400, detail="El consultorio no existe")

    cambio_de_programacion = any(
        key in update_data and update_data[key] != getattr(cita, key)
        for key in ("fecha", "hora", "id_odontologo", "id_consultorio", "id_paciente")
    ) or cita_programada(cita.estado) != cita_programada(valores["estado"])
    finalizacion = (
        principal.role == "Odontologo" and not cita_finalizada(cita.estado) and cita_finalizada(valores["estado"])
    )
    if finalizacion and cancelada(cita.estado):
        raise HTTPException(409, "Una cita cancelada o con inasistencia no se puede finalizar")
    for key, value in update_data.items():
        setattr(cita, key, value)
    if cambio_de_programacion:
        programar_cita(db, cita)
    if finalizacion:
        programar_encuesta(db, cita)
    db.commit()

    # DEVOLVER CITA ACTUALIZADA
    cita_actualizada = (
        db.query(models.Cita)
        .options(
            selectinload(models.Cita.tratamientos),
            selectinload(models.Cita.odontologo)
        )
        .filter(models.Cita.id_cita == id)
        .first()
    )

    return cita_actualizada


# ============================================================
# ELIMINAR CITA
# ============================================================

@router.delete("/{id}")
def delete_cita(
    id: int,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    bloquear_agenda(db)
    cita = (
        db.query(models.Cita)
        .filter(models.Cita.id_cita == id)
        .first()
    )

    if not cita:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada"
        )

    require_appointment(db, principal, cita, write=True)
    db.delete(cita)
    db.commit()

    return {
        "mensaje": "Cita eliminada correctamente",
        "id_cita": id
    }


# ============================================================
# OBTENER TRATAMIENTOS DE UNA CITA
# ============================================================

@router.get(
    "/{cita_id}/tratamientos",
    response_model=List[schemas.TratamientoOut]
)
def get_tratamientos_de_cita(
    cita_id: int,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    cita = (
        db.query(models.Cita)
        .options(selectinload(models.Cita.tratamientos))
        .filter(models.Cita.id_cita == cita_id)
        .first()
    )

    if not cita:
        raise HTTPException(
            status_code=404,
            detail="Cita no encontrada"
        )

    require_appointment(db, principal, cita)
    return cita.tratamientos


# ============================================================
# ASOCIAR TRATAMIENTO A UNA CITA
# ============================================================

@router.post("/{cita_id}/tratamientos/{tratamiento_id}")
def asociar_tratamiento(
    cita_id: int,
    tratamiento_id: int,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    bloquear_agenda(db)
    cita = db.query(models.Cita).filter(models.Cita.id_cita == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    require_appointment(db, principal, cita, write=True)
    tratamiento = db.query(models.Tratamiento).filter(models.Tratamiento.id_tratamiento == tratamiento_id).first()
    if not tratamiento:
        raise HTTPException(status_code=404, detail="Tratamiento no encontrado")

    if tratamiento in cita.tratamientos:
        raise HTTPException(status_code=409, detail="El tratamiento ya está asociado a esta cita")

    cita.tratamientos.append(tratamiento)
    nueva_duracion = sum(duracion_tratamiento(t) for t in cita.tratamientos) or 30
    nueva_duracion = min(480, nueva_duracion)
    valores = {k:getattr(cita,k) for k in ("fecha","hora","id_paciente","id_odontologo","id_consultorio","estado")}
    valores["duracion_minutos"] = nueva_duracion
    validar_horario(db, valores, excluir=cita_id)
    cita.duracion_minutos = nueva_duracion
    db.commit()
    db.refresh(cita)

    return {
        "mensaje": "Tratamiento asociado correctamente",
        "id_cita": cita_id,
        "id_tratamiento": tratamiento_id
    }


# ============================================================
# ACTUALIZAR TRATAMIENTO DE UNA CITA
# ============================================================

@router.put("/{cita_id}/tratamientos/{tratamiento_id}")
def actualizar_tratamiento(
    cita_id: int,
    tratamiento_id: int,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    bloquear_agenda(db)
    cita = db.query(models.Cita).filter(models.Cita.id_cita == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    require_appointment(db, principal, cita, write=True)
    tratamiento = db.query(models.Tratamiento).filter(models.Tratamiento.id_tratamiento == tratamiento_id).first()
    if not tratamiento:
        raise HTTPException(status_code=404, detail="Tratamiento no encontrado")

    cita.tratamientos.clear()
    cita.tratamientos.append(tratamiento)

    nueva_duracion = sum(duracion_tratamiento(t) for t in cita.tratamientos) or 30
    nueva_duracion = min(480, nueva_duracion)
    valores = {k:getattr(cita,k) for k in ("fecha","hora","id_paciente","id_odontologo","id_consultorio","estado")}
    valores["duracion_minutos"] = nueva_duracion
    validar_horario(db, valores, excluir=cita_id)
    cita.duracion_minutos = nueva_duracion
    db.commit()
    db.refresh(cita)

    return {
        "mensaje": "Tratamiento actualizado correctamente",
        "id_cita": cita_id,
        "id_tratamiento": tratamiento_id
    }


# ============================================================
# ELIMINAR TRATAMIENTO DE UNA CITA
# ============================================================

@router.delete("/{cita_id}/tratamientos/{tratamiento_id}")
def eliminar_tratamiento(
    cita_id: int,
    tratamiento_id: int,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    bloquear_agenda(db)
    cita = db.query(models.Cita).filter(models.Cita.id_cita == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    tratamiento = db.query(models.Tratamiento).filter(models.Tratamiento.id_tratamiento == tratamiento_id).first()
    if not tratamiento:
        raise HTTPException(status_code=404, detail="Tratamiento no encontrado")

    require_appointment(db, principal, cita, write=True)
    if tratamiento not in cita.tratamientos:
        raise HTTPException(status_code=404, detail="El tratamiento no está asociado a esta cita")

    cita.tratamientos.remove(tratamiento)
    nueva_duracion = sum(duracion_tratamiento(t) for t in cita.tratamientos) or 30
    nueva_duracion = min(480, nueva_duracion)
    valores = {k:getattr(cita,k) for k in ("fecha","hora","id_paciente","id_odontologo","id_consultorio","estado")}
    valores["duracion_minutos"] = nueva_duracion
    validar_horario(db, valores, excluir=cita_id)
    cita.duracion_minutos = nueva_duracion
    db.commit()

    return {
        "mensaje": "Tratamiento eliminado de la cita",
        "id_cita": cita_id,
        "id_tratamiento": tratamiento_id
    }
