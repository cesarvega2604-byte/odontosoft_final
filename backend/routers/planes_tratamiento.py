from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from access import Principal, current_user, dentist_id, patient_ids, require_role
from clinical_audit import audit, authorize
from database import get_db

router = APIRouter(prefix="/planes-tratamiento", tags=["Mi tratamiento"])
FASE = models.FaseTratamiento
RECURSO = FASE.__tablename__


@router.get("/", response_model=list[schemas.FaseTratamientoOut])
def mi_plan(db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    require_role(principal, "Paciente")
    return db.scalars(select(FASE).where(
        FASE.id_paciente.in_(patient_ids(db, principal)), FASE.compartida.is_(True),
    ).order_by(FASE.id)).all()


@router.get("/paciente/{paciente_id}", response_model=list[schemas.FaseTratamientoOut])
def plan_clinico(paciente_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    authorize(db, principal, paciente_id, RECURSO, "consulta")
    autor = dentist_id(db, principal)
    fases = db.scalars(select(FASE).filter_by(id_paciente=paciente_id).order_by(FASE.id)).all()
    respuesta = [
        schemas.FaseTratamientoOut.model_validate(fase).model_copy(update={"editable": fase.id_odontologo == autor})
        for fase in fases
    ]
    audit(db, principal, paciente_id, RECURSO, "consulta", paciente_id)
    db.commit()
    return respuesta


@router.post("/paciente/{paciente_id}", response_model=schemas.FaseTratamientoOut, status_code=201)
def crear_fase(paciente_id: int, data: schemas.FaseTratamientoCreate,
               db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    authorize(db, principal, paciente_id, RECURSO, "creacion")
    fase = FASE(id_paciente=paciente_id, id_odontologo=dentist_id(db, principal), **data.model_dump())
    db.add(fase)
    db.flush()
    respuesta = schemas.FaseTratamientoOut.model_validate(fase).model_copy(update={"editable": True})
    audit(db, principal, paciente_id, RECURSO, "creacion", fase.id)
    db.commit()
    return respuesta


@router.put("/paciente/{paciente_id}/{fase_id}", response_model=schemas.FaseTratamientoOut)
def guardar_fase(paciente_id: int, fase_id: int, data: schemas.FaseTratamientoCreate,
                 db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    authorize(db, principal, paciente_id, RECURSO, "actualizacion", fase_id)
    fase = db.scalar(select(FASE).filter_by(id=fase_id, id_paciente=paciente_id).with_for_update())
    if fase is None:
        raise HTTPException(404, "No se encontró la fase")
    if fase.id_odontologo != dentist_id(db, principal):
        audit(db, principal, paciente_id, RECURSO, "actualizacion", fase_id, result="denegado")
        db.commit()
        raise HTTPException(403, "La fase la edita el odontólogo que la creó")
    for campo, valor in data.model_dump().items():
        setattr(fase, campo, valor)
    fase.actualizada_en = datetime.now(timezone.utc)
    respuesta = schemas.FaseTratamientoOut.model_validate(fase).model_copy(update={"editable": True})
    audit(db, principal, paciente_id, RECURSO, "actualizacion", fase.id)
    db.commit()
    return respuesta
