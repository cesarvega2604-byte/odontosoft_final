from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

import models
import schemas
from access import Principal, admin_user, current_user, patient_ids, require_role
from database import get_db
from facturacion import emitir_factura, factura_pdf

router = APIRouter(prefix="/facturas", tags=["Facturas"])
FACTURA = models.Factura


def facturas_visibles(db, principal):
    require_role(principal, "Administrador", "Paciente")
    query = select(FACTURA).options(selectinload(FACTURA.envio))
    if principal.role == "Paciente":
        query = query.where(FACTURA.id_paciente.in_(patient_ids(db, principal)))
    return query


def buscar_factura(db, principal, id):
    factura = db.scalar(facturas_visibles(db, principal).where(FACTURA.id_factura == id))
    if factura is None:
        raise HTTPException(404, "No se encontró el comprobante")
    return factura


@router.get("/", response_model=list[schemas.FacturaOut])
def get_facturas(paciente_id: int | None = None, db: Session = Depends(get_db),
                 principal: Principal = Depends(current_user)):
    query = facturas_visibles(db, principal)
    if paciente_id is not None:
        query = query.where(FACTURA.id_paciente == paciente_id)
    return db.scalars(query.order_by(
        FACTURA.fecha_emision.desc(), FACTURA.emitida_en.desc().nulls_last(), FACTURA.id_factura.desc(),
    )).all()


@router.get("/{id}", response_model=schemas.FacturaOut)
def get_factura(id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    return buscar_factura(db, principal, id)


@router.get("/{id}/pdf")
def descargar_factura(id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    factura = buscar_factura(db, principal, id)
    return Response(
        factura_pdf(factura), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{factura.numero}.pdf"', "Cache-Control": "no-store"},
    )


@router.post("/", response_model=schemas.FacturaOut, status_code=201, dependencies=[Depends(admin_user)])
def create_factura(data: schemas.FacturaCreate, db: Session = Depends(get_db)):
    pago = db.scalar(select(models.Pago).filter_by(id_pago=data.id_pago).with_for_update())
    if pago is None:
        raise HTTPException(404, "No se encontró el pago")
    factura = emitir_factura(db, pago, data.model_dump(exclude={"id_pago"}))
    respuesta = schemas.FacturaOut.model_validate(factura)
    db.commit()
    return respuesta


@router.put("/{id}", dependencies=[Depends(admin_user)])
@router.delete("/{id}", dependencies=[Depends(admin_user)])
def proteger_factura_emitida(id: int, db: Session = Depends(get_db)):
    if db.get(FACTURA, id) is None:
        raise HTTPException(404, "No se encontró el comprobante")
    raise HTTPException(409, "El comprobante emitido se conserva en el historial de facturación")
