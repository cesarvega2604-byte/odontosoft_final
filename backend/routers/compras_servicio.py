from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from access import Principal, admin_user, current_user, patient_ids, require_patient, require_role
from agenda import ZONA_AGENDA
from database import get_db
from facturacion import emitir_factura

router = APIRouter(prefix="/compras-servicio", tags=["Compras de servicios"])
COMPRA = models.CompraServicio


@router.get("/", response_model=list[schemas.CompraServicioOut])
def listar_compras(db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    require_role(principal, "Administrador", "Paciente")
    query = select(COMPRA, models.Factura.id_factura).outerjoin(
        models.Pago, models.Pago.id_compra == COMPRA.id,
    ).outerjoin(models.Factura, models.Factura.id_pago == models.Pago.id_pago)
    if principal.role == "Paciente":
        query = query.where(COMPRA.id_paciente.in_(patient_ids(db, principal)))
    else:
        query = query.where(COMPRA.id_paciente.is_not(None))
    return [
        schemas.CompraServicioOut.model_validate(compra).model_copy(update={"id_factura": factura})
        for compra, factura in db.execute(query.order_by(COMPRA.solicitada_en.desc(), COMPRA.id.desc()))
    ]


@router.post("/paciente/{paciente_id}", response_model=schemas.CompraServicioOut, status_code=201)
def solicitar_compra(paciente_id: int, data: schemas.CompraServicioCreate,
                     db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    require_role(principal, "Administrador", "Paciente")
    require_patient(db, principal, paciente_id)
    paciente = db.scalar(select(models.Paciente).filter_by(id_paciente=paciente_id).with_for_update())
    if paciente is None:
        raise HTTPException(404, "No se encontró al paciente")
    clave = str(data.clave)
    compra = db.scalar(select(COMPRA).filter_by(id_paciente=paciente_id, clave=clave))
    if compra is not None:
        if compra.precio != data.precio or compra.id_tratamiento != data.id_tratamiento:
            raise HTTPException(409, "La solicitud ya corresponde a otro servicio o precio")
        return compra

    tratamiento = db.get(models.Tratamiento, data.id_tratamiento)
    if tratamiento is None or tratamiento.costo is None or tratamiento.costo <= 0:
        raise HTTPException(409, "El servicio no tiene un precio disponible")
    if tratamiento.costo != data.precio:
        raise HTTPException(409, "El precio del servicio cambió. Actualiza el catálogo y vuelve a seleccionarlo.")
    compra = COMPRA(
        id_paciente=paciente_id, id_tratamiento=tratamiento.id_tratamiento,
        concepto=tratamiento.nombre, cliente=f"{paciente.nombre} {paciente.apellido}".strip(),
        precio=tratamiento.costo, clave=clave,
    )
    db.add(compra)
    db.commit()
    db.refresh(compra)
    return compra


@router.post("/{compra_id}/confirmar-pago", response_model=schemas.FacturaOut)
def confirmar_pago(compra_id: int, data: schemas.ConfirmacionCompra,
                   db: Session = Depends(get_db), _: Principal = Depends(admin_user)):
    compra = db.scalar(select(COMPRA).filter_by(id=compra_id).with_for_update())
    if compra is None or compra.id_paciente is None:
        raise HTTPException(404, "No hay una compra disponible para confirmar")
    pago = db.scalar(select(models.Pago).filter_by(id_compra=compra_id).with_for_update())
    if pago is None:
        pago = models.Pago(
            compra=compra, monto=compra.precio, fecha_pago=datetime.now(ZONA_AGENDA).date(),
            estado_pago="Pagado", metodo_pago=data.metodo,
        )
        db.add(pago)
        db.flush()
    factura = emitir_factura(db, pago)
    respuesta = schemas.FacturaOut.model_validate(factura)
    db.commit()
    return respuesta
