# routers/auth.py - Autenticación y Registro

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import models
import schemas
from database import get_db
from correos_programados import programar_bienvenida, programar_cumpleanos
from passwords import hash_password, password_needs_rehash, verificar_password
from utils import validar_correo
from access import (
    COOKIE_NAME, Principal, ROLES, check_origin, cookie_options, current_user,
    new_session, resolve_session, revoke_sessions,
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])


# ── LOGIN ─────────────────────────────────────────────────────────────────────

def authenticate(data, db):
    usuario = db.query(models.Usuario).filter_by(correo=data.correo).first()
    previous_hash = usuario.contrasena if usuario else None
    invalid = HTTPException(401, "Correo o contraseña incorrectos")
    if not verificar_password(data.contrasena, previous_hash) or usuario is None:
        raise invalid

    usuario = db.get(models.Usuario, usuario.id_usuario, populate_existing=True, with_for_update=True)
    if usuario is None or usuario.correo != data.correo or usuario.estado != "Activo" or usuario.rol not in ROLES:
        raise invalid
    if usuario.contrasena != previous_hash and not verificar_password(data.contrasena, usuario.contrasena):
        raise invalid
    if usuario.requiere_restablecer_contrasena:
        raise HTTPException(403, "Restablece tu contraseña con el enlace de recuperación o contacta a administración")
    if password_needs_rehash(usuario.contrasena):
        usuario.contrasena = hash_password(data.contrasena)
        revoke_sessions(db, usuario.id_usuario)
    return usuario


def profile(usuario):
    return schemas.LoginResponse(
        id_usuario=usuario.id_usuario,
        correo=usuario.correo,
        rol=usuario.rol,
        estado=usuario.estado,
        mensaje="Login exitoso"
    )


@router.post("/login", response_model=schemas.LoginResponse)
def login(data: schemas.LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    check_origin(request)
    usuario = authenticate(data, db)
    previous = resolve_session(request, db)
    if previous:
        db.delete(previous.session)
    token, seconds = new_session(db, usuario, "web")
    db.commit()
    response.set_cookie(COOKIE_NAME, token, max_age=seconds, **cookie_options(request))
    return profile(usuario)


@router.post("/login/consultorios")
def mobile_login(data: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    check_origin(request)
    usuario = authenticate(data, db)
    if usuario.rol != "Administrador":
        raise HTTPException(403, "Se requiere una cuenta de administrador")
    token, seconds = new_session(db, usuario, "consultorios")
    db.commit()
    return {"access_token": token, "token_type": "bearer", "expires_in": seconds}


@router.get("/me", response_model=schemas.LoginResponse)
def me(principal: Principal = Depends(current_user)):
    return profile(principal.user)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    check_origin(request)
    principal = resolve_session(request, db, mobile=True)
    if principal:
        db.delete(principal.session)
        db.commit()
    response.delete_cookie(COOKIE_NAME, **cookie_options(request))


# ── REGISTRO COMPLETO (Usuario + Paciente) ──────────────────────────────────

@router.post("/registro", response_model=schemas.RegistroResponse, status_code=status.HTTP_201_CREATED)
def registro_usuario(data: schemas.RegistroPacienteRequest, db: Session = Depends(get_db)):
    """
    Registro completo desde el frontend.
    Crea un usuario con rol 'Paciente' y un paciente asociado.
    """
    if data.rol != "Paciente" or data.estado != "Activo":
        raise HTTPException(403, "El registro público es para pacientes activos")
    # Validar correo
    if not validar_correo(data.correo):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico no tiene un formato válido"
        )
    
    # Verificar que el correo no esté registrado
    existing_user = db.query(models.Usuario).filter(
        models.Usuario.correo == data.correo
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya está registrado"
        )
    
    try:
        # 1. Crear el usuario
        nuevo_usuario = models.Usuario(
            correo=data.correo,
            contrasena=hash_password(data.contrasena),
            rol="Paciente",
            estado="Activo"
        )
        db.add(nuevo_usuario)
        db.flush()

        nuevo_paciente = models.Paciente(
            nombre=data.nombre,
            apellido=data.apellido,
            documento=data.documento,
            tipo_documento=data.tipo_documento,
            fecha_nacimiento=data.fecha_nacimiento,
            telefono=data.telefono,
            correo=data.correo
        )
        db.add(nuevo_paciente)
        db.flush()
        
        # 4. Crear la relación usuario-paciente
        stmt = models.usuario_paciente.insert().values(
            id_usuario=nuevo_usuario.id_usuario,
            id_paciente=nuevo_paciente.id_paciente
        )
        db.execute(stmt)
        programar_bienvenida(db, nuevo_usuario)
        programar_cumpleanos(db, nuevo_usuario.id_usuario, data.fecha_nacimiento)
        db.commit()
        
        return schemas.RegistroResponse(
            mensaje="Usuario y paciente registrados exitosamente",
            id_usuario=nuevo_usuario.id_usuario,
            id_paciente=nuevo_paciente.id_paciente,
            correo=nuevo_usuario.correo,
            rol=nuevo_usuario.rol
        )
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo registrar la cuenta con esos datos"
        )
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo registrar la cuenta"
        )

