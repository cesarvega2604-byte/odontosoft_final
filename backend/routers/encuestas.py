from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session

import models
from access import digest
from database import get_db
from encuestas import cita_finalizada


router = APIRouter(tags=["Encuestas de satisfacción"])


class RespuestaEncuesta(BaseModel):
    token: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    estrellas: int = Field(ge=1, le=5, strict=True)
    comentario: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]
    publicar: Literal[True]


@router.post("/encuestas/responder", status_code=201)
def responder(datos: RespuestaEncuesta, db: Session = Depends(get_db)):
    encuesta = db.query(models.EncuestaCita).filter_by(token_hash=digest(datos.token)).with_for_update().first()
    if encuesta is None or encuesta.vence is None:
        raise HTTPException(404, "El enlace de la encuesta no es válido.")
    if encuesta.respondida is not None:
        raise HTTPException(409, "Ya respondiste esta encuesta.")
    ahora = datetime.now(timezone.utc)
    vence = encuesta.vence.replace(tzinfo=timezone.utc) if encuesta.vence.tzinfo is None else encuesta.vence
    cita = db.get(models.Cita, encuesta.id_cita) if encuesta.id_cita is not None else None
    if ahora >= vence or cita is None or not cita_finalizada(cita.estado):
        raise HTTPException(410, "Esta encuesta ya no está disponible.")

    encuesta.estrellas = datos.estrellas
    encuesta.comentario = datos.comentario
    encuesta.respondida = ahora
    db.commit()
    return {"mensaje": "Gracias. Tu opinión ya está publicada."}


@router.get("/opiniones")
def listar_opiniones(
    antes_de: int | None = Query(default=None, gt=0), db: Session = Depends(get_db),
):
    tabla = models.EncuestaCita
    consulta = db.query(tabla.id, tabla.estrellas, tabla.comentario).filter(tabla.respondida.is_not(None))
    if antes_de is not None:
        consulta = consulta.filter(tabla.id < antes_de)
    filas = consulta.order_by(tabla.id.desc()).limit(13).all()
    return {
        "opiniones": [{"estrellas": item.estrellas, "comentario": item.comentario} for item in filas[:12]],
        "siguiente": filas[11].id if len(filas) > 12 else None,
    }
