"""Registra acciones clínicas sin guardar el contenido del expediente."""

from fastapi import HTTPException

import models
from access import require_patient


def audit(db, principal, patient_id, resource, action, record_id=None, *, result="permitido"):
    db.add(models.AuditoriaClinica(
        id_usuario=principal.user_id, id_paciente=patient_id, recurso=resource,
        operacion=action, id_registro=record_id, resultado=result,
    ))


def authorize(db, principal, patient_id, resource, action, record_id=None):
    try:
        require_patient(db, principal, patient_id, clinical=True)
    except HTTPException as error:
        if error.status_code == 403:
            audit(db, principal, patient_id, resource, action, record_id, result="denegado")
            db.commit()
        raise


def audit_patient_deletion(db, principal, patient_id):
    for model, id_column in (
        (models.HistoriaClinica, models.HistoriaClinica.id_historia),
        (models.HistoriaClinicaDetallada, models.HistoriaClinicaDetallada.id_historia_detallada),
        (models.Odontograma, models.Odontograma.id_odontograma),
        (models.AdjuntoClinico, models.AdjuntoClinico.id),
        (models.FaseTratamiento, models.FaseTratamiento.id),
    ):
        for record_id, in db.query(id_column).filter(model.id_paciente == patient_id):
            audit(db, principal, patient_id, model.__tablename__, "eliminacion", record_id)
