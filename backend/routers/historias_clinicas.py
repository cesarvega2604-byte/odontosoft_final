from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from access import Principal, current_user, dentist_user, patient_ids
from clinical_audit import audit, authorize
from database import get_db

router = APIRouter(prefix="/historias-clinicas", tags=["Historias Clínicas"])
RESOURCE = models.HistoriaClinica.__tablename__


def historia_autorizada(db, principal, id, action):
    historia = db.get(models.HistoriaClinica, id)
    if historia is None:
        raise HTTPException(404, "Historia clínica no encontrada")
    authorize(db, principal, historia.id_paciente, RESOURCE, action, historia.id_historia)
    return historia


def devolver_historias(db, principal, historias):
    response = [schemas.HistoriaClinicaOut.model_validate(historia) for historia in historias]
    for historia in response:
        audit(db, principal, historia.id_paciente, RESOURCE, "consulta", historia.id_historia)
    db.commit()
    return response


@router.get("/", response_model=List[schemas.HistoriaClinicaOut])
def get_historias(db: Session = Depends(get_db), principal: Principal = Depends(dentist_user)):
    historias = db.query(models.HistoriaClinica).filter(
        models.HistoriaClinica.id_paciente.in_(patient_ids(db, principal))
    ).all()
    return devolver_historias(db, principal, historias)


@router.get("/paciente/{paciente_id}", response_model=List[schemas.HistoriaClinicaOut])
def get_historias_por_paciente(
    paciente_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_user),
):
    authorize(db, principal, paciente_id, RESOURCE, "consulta")
    historias = db.query(models.HistoriaClinica).filter_by(id_paciente=paciente_id).all()
    return devolver_historias(db, principal, historias)


@router.get("/{id}", response_model=schemas.HistoriaClinicaOut)
def get_historia(id: int, db: Session = Depends(get_db), principal: Principal = Depends(dentist_user)):
    historia = historia_autorizada(db, principal, id, "consulta")
    return devolver_historias(db, principal, [historia])[0]


@router.post("/", response_model=schemas.HistoriaClinicaOut, status_code=201)
def create_historia(
    data: schemas.HistoriaClinicaCreate, db: Session = Depends(get_db), principal: Principal = Depends(current_user),
):
    authorize(db, principal, data.id_paciente, RESOURCE, "creacion")
    historia = models.HistoriaClinica(**data.model_dump())
    db.add(historia)
    db.flush()
    response = schemas.HistoriaClinicaOut.model_validate(historia)
    audit(db, principal, historia.id_paciente, RESOURCE, "creacion", historia.id_historia)
    db.commit()
    return response


@router.put("/{id}", response_model=schemas.HistoriaClinicaOut)
def update_historia(
    id: int, data: schemas.HistoriaClinicaCreate, db: Session = Depends(get_db),
    principal: Principal = Depends(dentist_user),
):
    historia = historia_autorizada(db, principal, id, "actualizacion")
    if historia.id_paciente != data.id_paciente:
        raise HTTPException(403, "La historia clínica debe permanecer con el mismo paciente")
    for field, value in data.model_dump(exclude={"id_paciente"}).items():
        setattr(historia, field, value)
    response = schemas.HistoriaClinicaOut.model_validate(historia)
    audit(db, principal, historia.id_paciente, RESOURCE, "actualizacion", historia.id_historia)
    db.commit()
    return response


@router.delete("/{id}")
def delete_historia(id: int, db: Session = Depends(get_db), principal: Principal = Depends(dentist_user)):
    historia = historia_autorizada(db, principal, id, "eliminacion")
    audit(db, principal, historia.id_paciente, RESOURCE, "eliminacion", historia.id_historia)
    db.delete(historia)
    db.commit()
    return {"mensaje": "Historia clínica eliminada correctamente"}
