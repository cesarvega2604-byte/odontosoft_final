from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from access import Principal, current_user
from clinical_audit import audit, authorize
from database import get_db

router = APIRouter(prefix="/historias-clinicas-detalladas", tags=["Historias Clínicas Detalladas"])
RESOURCE = models.HistoriaClinicaDetallada.__tablename__
DATOS_DEL_PERFIL = schemas.CAMPOS_IDENTIFICACION_PACIENTE | {
    "numero_documento", "edad", "consentimiento_cedula_paciente", "nombre", "apellido", "telefono", "correo",
}
DATOS_CLINICOS_PACIENTE = {"genero": 20, "direccion": 200, "eps": 100, "alergias": None}


def detalle(paciente, record):
    response = (
        schemas.HistoriaClinicaDetalladaOut.model_validate(record)
        if record is not None else schemas.HistoriaClinicaDetalladaOut(id_paciente=paciente.id_paciente)
    )
    return response.model_copy(update={
        "paciente": schemas.PacienteOut.model_validate(paciente),
        "datos_clinicos": {key: value for key, value in response.datos_clinicos.items() if key not in DATOS_DEL_PERFIL},
    })


@router.get("/paciente/{paciente_id}", response_model=schemas.HistoriaClinicaDetalladaOut)
def get_historia_detallada(paciente_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    authorize(db, principal, paciente_id, RESOURCE, "consulta")
    paciente = db.get(models.Paciente, paciente_id)
    if paciente is None:
        raise HTTPException(404, "Paciente no encontrado")
    record = db.query(models.HistoriaClinicaDetallada).filter_by(id_paciente=paciente_id).first()
    response = detalle(paciente, record)
    audit(db, principal, paciente_id, "identificacion_paciente", "consulta", paciente_id)
    if record is not None:
        audit(db, principal, paciente_id, RESOURCE, "consulta", record.id_historia_detallada)
    db.commit()
    return response


@router.put("/paciente/{paciente_id}", response_model=schemas.HistoriaClinicaDetalladaOut)
def save_historia_detallada(
    paciente_id: int, data: schemas.HistoriaClinicaDetalladaCreate,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user),
):
    authorize(db, principal, paciente_id, RESOURCE, "guardado")
    if paciente_id != data.id_paciente:
        raise HTTPException(400, "El paciente no coincide con la información enviada")
    if data.datos_clinicos.keys() & DATOS_DEL_PERFIL:
        raise HTTPException(403, "Los datos del perfil solo se pueden consultar en la historia clínica")
    # Serializa el primer guardado para este paciente.
    patient = db.query(models.Paciente).filter_by(id_paciente=paciente_id).with_for_update().first()
    if patient is None:
        raise HTTPException(404, "Paciente no encontrado")
    for key, limit in DATOS_CLINICOS_PACIENTE.items():
        if key not in data.datos_clinicos:
            continue
        value = data.datos_clinicos[key]
        if value is not None and (not isinstance(value, str) or (limit is not None and len(value.strip()) > limit)):
            raise HTTPException(422, f"El campo {key} no tiene un valor válido")
        setattr(patient, key, (value or "").strip() or None)
    record = db.query(models.HistoriaClinicaDetallada).filter_by(id_paciente=paciente_id).first()
    action = "creacion" if record is None else "actualizacion"
    if record is None:
        record = models.HistoriaClinicaDetallada(id_paciente=paciente_id)
        db.add(record)
    datos_anteriores = record.datos_clinicos or {}
    record.datos_clinicos = {
        **{key: datos_anteriores[key] for key in DATOS_DEL_PERFIL & datos_anteriores.keys()},
        **data.datos_clinicos,
    }
    record.fecha_actualizacion = datetime.now()
    db.flush()
    response = detalle(patient, record)
    audit(db, principal, paciente_id, RESOURCE, action, record.id_historia_detallada)
    db.commit()
    return response
