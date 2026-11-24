from datetime import datetime
from io import BytesIO
from pathlib import PurePosixPath
import unicodedata
from urllib.parse import quote, unquote

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from PIL import Image
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from access import Principal, current_user
from carga_binaria import leer_con_limite
from clinical_audit import audit, authorize
from database import get_db
from models import AdjuntoClinico, Paciente

router = APIRouter(prefix="/historias-clinicas-detalladas/paciente/{paciente_id}/adjuntos",
                   tags=["Adjuntos clínicos"])
RECURSO = AdjuntoClinico.__tablename__
MAX_BYTES = 15 * 1024 * 1024
IMAGENES = {
    ".jpg": ("JPEG", "image/jpeg"), ".jpeg": ("JPEG", "image/jpeg"),
    ".png": ("PNG", "image/png"), ".webp": ("WEBP", "image/webp"),
    ".tif": ("TIFF", "image/tiff"), ".tiff": ("TIFF", "image/tiff"),
}


class AdjuntoOut(BaseModel):
    id: int
    nombre: str
    tipo: str
    tamano: int
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)


def identificar_archivo(nombre, contenido):
    extension = PurePosixPath(nombre).suffix.lower()
    if extension in IMAGENES:
        formato, tipo = IMAGENES[extension]
        try:
            with Image.open(BytesIO(contenido), formats=(formato,)) as imagen:
                if imagen.width * imagen.height > 32_000_000:
                    raise HTTPException(422, "La imagen supera el tamaño de 32 megapíxeles")
                imagen.verify()
            return tipo
        except (OSError, ValueError, SyntaxError, Image.DecompressionBombError):
            pass
    elif extension == ".pdf" and contenido.startswith(b"%PDF-"):
        return "application/pdf"
    elif extension in {".dcm", ".dicom"} and contenido[128:132] == b"DICM":
        return "application/dicom"
    raise HTTPException(415, "Adjunta un JPG, PNG, WebP, TIFF, PDF o DICOM válido")


@router.get("", response_model=list[AdjuntoOut])
def listar(paciente_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    authorize(db, principal, paciente_id, RECURSO, "consulta")
    adjuntos = db.scalars(select(AdjuntoClinico).filter_by(id_paciente=paciente_id)
                          .order_by(AdjuntoClinico.id.desc())).all()
    respuesta = [AdjuntoOut.model_validate(adjunto) for adjunto in adjuntos]
    audit(db, principal, paciente_id, RECURSO, "consulta", paciente_id)
    db.commit()
    return respuesta


@router.post("", response_model=AdjuntoOut, status_code=201)
async def subir(paciente_id: int, request: Request, nombre: str = Header(alias="X-Nombre-Archivo", max_length=1200),
                db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    authorize(db, principal, paciente_id, RECURSO, "creacion")
    db.commit()
    contenido = await leer_con_limite(request, MAX_BYTES)
    nombre = unicodedata.normalize("NFC", unquote(nombre))
    nombre = "".join(c for c in nombre if not unicodedata.category(c).startswith("C")).strip()
    nombre = PurePosixPath(nombre.replace("\\", "/")).name
    if not nombre or len(nombre) > 180:
        raise HTTPException(422, "El nombre del archivo debe tener hasta 180 caracteres")
    tipo = await run_in_threadpool(identificar_archivo, nombre, contenido)
    authorize(db, principal, paciente_id, RECURSO, "creacion")
    if db.get(Paciente, paciente_id) is None:
        raise HTTPException(404, "Paciente no encontrado")
    adjunto = AdjuntoClinico(
        id_paciente=paciente_id, id_usuario=principal.user_id, nombre=nombre,
        tipo=tipo, tamano=len(contenido), contenido=contenido,
    )
    db.add(adjunto)
    db.flush()
    respuesta = AdjuntoOut.model_validate(adjunto)
    audit(db, principal, paciente_id, RECURSO, "creacion", adjunto.id)
    db.commit()
    return respuesta


@router.get("/{adjunto_id}")
def descargar(paciente_id: int, adjunto_id: int, vista: bool = False,
              db: Session = Depends(get_db), principal: Principal = Depends(current_user)):
    authorize(db, principal, paciente_id, RECURSO, "consulta", adjunto_id)
    adjunto = db.scalar(select(AdjuntoClinico).filter_by(id=adjunto_id, id_paciente=paciente_id))
    if adjunto is None:
        raise HTTPException(404, "Adjunto no encontrado")
    disposition = "inline" if vista and adjunto.tipo in {"image/jpeg", "image/png", "image/webp"} else "attachment"
    respuesta = Response(
        adjunto.contenido, media_type=adjunto.tipo,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(adjunto.nombre, safe='')}",
        },
    )
    audit(db, principal, paciente_id, RECURSO, "consulta", adjunto.id)
    db.commit()
    return respuesta
