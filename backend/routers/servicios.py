from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
from database import get_db
from access import Principal, admin_user, current_user, patient_ids, require_patient

router = APIRouter(prefix="/servicios", tags=["Servicios"])

@router.get("/", response_model=List[schemas.ServicioOut])
def get_servicios(db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    query = db.query(models.Servicio)
    if principal.role != "Administrador":
        query = query.filter(models.Servicio.paciente_id.in_(patient_ids(db, principal)))
    return query.all()

@router.get("/{id}", response_model=schemas.ServicioOut)
def get_servicio(id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    s = db.query(models.Servicio).filter(models.Servicio.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    require_patient(db, principal, s.paciente_id)
    return s

@router.get("/paciente/{paciente_id}", response_model=List[schemas.ServicioOut])
def get_servicios_por_paciente(paciente_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    require_patient(db, principal, paciente_id)
    return db.query(models.Servicio).filter(models.Servicio.paciente_id == paciente_id).all()

@router.post("/", response_model=schemas.ServicioOut, status_code=201, dependencies=[Depends(admin_user)])
def create_servicio(data: schemas.ServicioCreate, db: Session = Depends(get_db)):
    nuevo = models.Servicio(**data.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.put("/{id}", response_model=schemas.ServicioOut, dependencies=[Depends(admin_user)])
def update_servicio(id: int, data: schemas.ServicioUpdate, db: Session = Depends(get_db)):
    s = db.query(models.Servicio).filter(models.Servicio.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(s, key, value)
    
    db.commit()
    db.refresh(s)
    return s

@router.delete("/{id}", dependencies=[Depends(admin_user)])
def delete_servicio(id: int, db: Session = Depends(get_db)):
    s = db.query(models.Servicio).filter(models.Servicio.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    db.delete(s)
    db.commit()
    return {"mensaje": "Servicio eliminado correctamente"}