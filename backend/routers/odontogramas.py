from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from access import Principal, current_user
from clinical_audit import audit, authorize
from database import get_db

router = APIRouter(prefix="/odontogramas", tags=["Odontogramas"])
RESOURCE = models.Odontograma.__tablename__


@router.get("/paciente/{paciente_id}", response_model=schemas.OdontogramaOut)
def get_odontograma(paciente_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    authorize(db, principal, paciente_id, RESOURCE, "consulta")
    record = db.query(models.Odontograma).filter_by(id_paciente=paciente_id).first()
    if record is None:
        return schemas.OdontogramaOut(id_paciente=paciente_id)
    response = schemas.OdontogramaOut.model_validate(record)
    audit(db, principal, paciente_id, RESOURCE, "consulta", record.id_odontograma)
    db.commit()
    return response


@router.put("/paciente/{paciente_id}", response_model=schemas.OdontogramaOut)
def save_odontograma(
    paciente_id: int, data: schemas.OdontogramaCreate,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user),
):
    authorize(db, principal, paciente_id, RESOURCE, "guardado")
    if paciente_id != data.id_paciente:
        raise HTTPException(400, "El paciente no coincide con la información enviada")
    # Serializa el primer guardado para este paciente.
    patient = db.query(models.Paciente).filter_by(id_paciente=paciente_id).with_for_update().first()
    if patient is None:
        raise HTTPException(404, "Paciente no encontrado")
    record = db.query(models.Odontograma).filter_by(id_paciente=paciente_id).first()
    action = "creacion" if record is None else "actualizacion"
    if record is None:
        record = models.Odontograma(id_paciente=paciente_id)
        db.add(record)
    record.dientes = data.dientes
    record.fecha_actualizacion = datetime.now()
    db.flush()
    response = schemas.OdontogramaOut.model_validate(record)
    audit(db, principal, paciente_id, RESOURCE, action, record.id_odontograma)
    db.commit()
    return response
