from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from access import admin_user, current_user

router = APIRouter(prefix="/odontologos", tags=["Odontólogos"], dependencies=[Depends(current_user)])

@router.get("/", response_model=List[schemas.OdontologoOut])
def get_odontologos(db: Session = Depends(get_db)):
    return db.query(models.Odontologo).all()

@router.get("/{id}", response_model=schemas.OdontologoOut)
def get_odontologo(id: int, db: Session = Depends(get_db)):
    o = db.query(models.Odontologo).filter(models.Odontologo.id_odontologo == id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Odontólogo no encontrado")
    return o

@router.post("/", response_model=schemas.OdontologoOut, status_code=201, dependencies=[Depends(admin_user)])
def create_odontologo(data: schemas.OdontologoCreate, db: Session = Depends(get_db)):
    if db.query(models.Odontologo).filter(models.Odontologo.documento == data.documento).first():
        raise HTTPException(status_code=400, detail="Documento ya registrado")
    nuevo = models.Odontologo(**data.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.put("/{id}", response_model=schemas.OdontologoOut, dependencies=[Depends(admin_user)])
def update_odontologo(id: int, data: schemas.OdontologoCreate, db: Session = Depends(get_db)):
    o = db.query(models.Odontologo).filter(models.Odontologo.id_odontologo == id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Odontólogo no encontrado")
    for k, v in data.model_dump().items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    return o

@router.delete("/{id}", dependencies=[Depends(admin_user)])
def delete_odontologo(id: int, db: Session = Depends(get_db)):
    o = db.query(models.Odontologo).filter(models.Odontologo.id_odontologo == id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Odontólogo no encontrado")
    db.delete(o)
    db.commit()
    return {"mensaje": "Odontólogo eliminado correctamente"}