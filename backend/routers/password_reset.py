from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from access import change_password, digest, invalidate_reset_links
from database import get_db
from notifications import NotificationService
from utils import generar_token_seguro

router = APIRouter(prefix="/auth", tags=["Restablecimiento de Contraseña"])

TOKEN_LIFETIME = timedelta(minutes=15)
REQUEST_INTERVAL = timedelta(minutes=1)
GENERIC_RESPONSE = "Si el correo está registrado, recibirás un enlace de recuperación en los próximos minutos."


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.post("/solicitar-reset", response_model=schemas.MensajeResponse)
def solicitar_reset(data: schemas.SolicitarResetRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    response = schemas.MensajeResponse(mensaje=GENERIC_RESPONSE)
    user = db.scalar(select(models.Usuario).where(
        models.Usuario.correo == data.correo,
        models.Usuario.estado == "Activo",
    ).with_for_update())
    if not user:
        return response

    now = utc_now()
    recent_token = db.scalar(select(models.PasswordResetToken.id_token).where(
        models.PasswordResetToken.id_usuario == user.id_usuario,
        models.PasswordResetToken.fecha_creacion > now - REQUEST_INTERVAL,
        models.PasswordResetToken.usado.is_(False),
    ).limit(1))
    if recent_token:
        return response

    invalidate_reset_links(db, user.id_usuario)
    token = generar_token_seguro()
    db.add(models.PasswordResetToken(
        token=digest(token), id_usuario=user.id_usuario,
        fecha_creacion=now, fecha_expiracion=now + TOKEN_LIFETIME, usado=False,
    ))
    recipient = user.correo
    name = user.nombre or recipient
    db.commit()
    background_tasks.add_task(NotificationService.enviar_reset_password, recipient, name, token)
    return response


@router.post("/reset-password", response_model=schemas.MensajeResponse)
def reset_password(data: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = digest(data.token)
    user_id = db.scalar(select(models.PasswordResetToken.id_usuario).where(
        models.PasswordResetToken.token == token_hash
    ))
    invalid = HTTPException(400, "El enlace de restablecimiento no es válido o expiró. Solicita uno nuevo.")
    if user_id is None:
        raise invalid

    # Todos los cambios de credenciales toman primero el bloqueo de la cuenta.
    user = db.get(models.Usuario, user_id, with_for_update=True)
    record = db.scalar(select(models.PasswordResetToken).where(
        models.PasswordResetToken.token == token_hash,
        models.PasswordResetToken.id_usuario == user_id,
        models.PasswordResetToken.usado.is_(False),
    ))
    if user is None or user.estado != "Activo" or record is None or record.fecha_expiracion <= utc_now():
        raise invalid

    change_password(db, user, data.nueva_contrasena)
    db.commit()
    return schemas.MensajeResponse(
        mensaje="Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.",
    )
