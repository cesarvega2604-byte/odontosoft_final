from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from access import admin_user
from facturacion import emitir_factura, pago_confirmado

router = APIRouter(prefix="/pagos", tags=["Pagos"], dependencies=[Depends(admin_user)])

@router.get("/", response_model=List[schemas.PagoOut])
def get_pagos(db: Session = Depends(get_db)):
    return db.query(models.Pago).all()

@router.get("/cita/{cita_id}", response_model=List[schemas.PagoOut])
def get_pagos_por_cita(cita_id: int, db: Session = Depends(get_db)):
    return db.query(models.Pago).filter(models.Pago.id_cita == cita_id).all()

@router.post("/", response_model=schemas.PagoOut, status_code=201)
def create_pago(data: schemas.PagoCreate, db: Session = Depends(get_db)):
    if db.get(models.Cita, data.id_cita) is None:
        raise HTTPException(404, "No se encontró la cita")
    nuevo = models.Pago(**data.model_dump())
    db.add(nuevo)
    if pago_confirmado(nuevo):
        db.flush()
        emitir_factura(db, nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.put("/{id}", response_model=schemas.PagoOut)
def update_pago(id: int, data: schemas.PagoCreate, db: Session = Depends(get_db)):
    p = db.query(models.Pago).filter(models.Pago.id_pago == id).with_for_update().first()
    if not p:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    cambios = data.model_dump()
    if p.id_compra is not None or p.factura is not None:
        if any(getattr(p, k) != v for k, v in cambios.items()):
            raise HTTPException(409, "El pago facturado se conserva en el historial")
        return p
    if db.get(models.Cita, data.id_cita) is None:
        raise HTTPException(404, "No se encontró la cita")
    for k, v in cambios.items():
        setattr(p, k, v)
    if pago_confirmado(p):
        db.flush()
        db.expire(p, ["cita"])
        emitir_factura(db, p)
    db.commit()
    db.refresh(p)
    return p

@router.delete("/{id}")
def delete_pago(id: int, db: Session = Depends(get_db)):
    p = db.query(models.Pago).filter(models.Pago.id_pago == id).with_for_update().first()
    if not p:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if p.id_compra is not None or p.factura is not None:
        raise HTTPException(409, "El pago facturado se conserva en el historial")
    db.delete(p)
    db.commit()
    return {"mensaje": "Pago eliminado correctamente"}
