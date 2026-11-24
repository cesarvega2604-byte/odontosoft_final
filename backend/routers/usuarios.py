import logging
from correos_programados import programar_bienvenida, programar_cumpleanos
from datetime import datetime
# ============================================================
# routers/usuarios.py
# CRUD COMPLETO DE USUARIOS - ODONTOSOFT
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas

from database import get_db
from access import admin_user, change_password, invalidate_reset_links, revoke_sessions
from clinical_audit import audit_patient_deletion
from passwords import hash_password
from utils import (
    validar_correo,
    generar_documento_unico
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"], dependencies=[Depends(admin_user)]
)


# ============================================================
# GET - OBTENER TODOS LOS USUARIOS
# ============================================================

@router.get(
    "/",
    response_model=List[schemas.UsuarioOut]
)
def get_usuarios(
    db: Session = Depends(get_db)
):
    """
    Obtener todos los usuarios.
    """

    try:

        usuarios = (
            db.query(models.Usuario)
            .order_by(models.Usuario.id_usuario)
            .all()
        )

        return usuarios

    except Exception as e:

        logger.error("❌ Error en get_usuarios (%s)", type(e).__name__)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener usuarios"
        )


# ============================================================
# GET - OBTENER USUARIO POR CORREO
# ============================================================

@router.get(
    "/correo/{correo}",
    response_model=schemas.UsuarioOut
)
def get_usuario_by_correo(
    correo: str,
    db: Session = Depends(get_db)
):
    """
    Obtener un usuario por correo electrónico.
    """

    usuario = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.correo == correo
        )
        .first()
    )

    if not usuario:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    return usuario


# ============================================================
# GET - OBTENER USUARIO POR ID
# ============================================================

@router.get(
    "/{id}",
    response_model=schemas.UsuarioOut
)
def get_usuario(
    id: int,
    db: Session = Depends(get_db)
):
    """
    Obtener un usuario por ID.

    Administrador:
        Los datos personales salen directamente
        de la tabla usuario.

    Paciente:
        Los datos personales salen de paciente.

    Odontólogo:
        Los datos personales salen de odontologo.
    """

    usuario = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.id_usuario == id
        )
        .first()
    )

    if not usuario:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )


    # ========================================================
    # DATOS BASE
    # ========================================================

    nombre = usuario.nombre
    apellido = usuario.apellido
    documento = usuario.documento
    telefono = usuario.telefono

    # ========================================================
    # PACIENTE
    # ========================================================

    if usuario.rol == "Paciente":

        relacion = (
            db.query(models.usuario_paciente)
            .filter(
                models.usuario_paciente.c.id_usuario == id
            )
            .first()
        )

        if relacion:

            paciente = (
                db.query(models.Paciente)
                .filter(
                    models.Paciente.id_paciente
                    == relacion.id_paciente
                )
                .first()
            )

            if paciente:

                nombre = paciente.nombre
                apellido = paciente.apellido
                documento = paciente.documento
                telefono = paciente.telefono



    # ========================================================
    # ODONTÓLOGO
    # ========================================================

    elif usuario.rol == "Odontologo":

        odontologo = (
            db.query(models.Odontologo)
            .filter(
                models.Odontologo.correo
                == usuario.correo
            )
            .first()
        )

        if odontologo:

            nombre = odontologo.nombre
            apellido = odontologo.apellido
            documento = odontologo.documento
            telefono = odontologo.telefono


    # ========================================================
    # RESPUESTA
    # ========================================================

    return {

        "id_usuario":
            usuario.id_usuario,

        "correo":
            usuario.correo,



        "rol":
            usuario.rol,

        "estado":
            usuario.estado,

        "requiere_restablecer_contrasena": usuario.requiere_restablecer_contrasena,

        "nombre":
            nombre,

        "apellido":
            apellido,

        "documento":
            documento,

        "telefono":
            telefono,

        "fecha_registro":
            getattr(
                usuario,
                "fecha_registro",
                None
            ),

        "ultimo_acceso":
            getattr(
                usuario,
                "ultimo_acceso",
                None
            )
    }


# ============================================================
# POST - CREAR USUARIO
# ============================================================

@router.post(
    "/",
    response_model=schemas.UsuarioOut,
    status_code=status.HTTP_201_CREATED
)
def create_usuario(
    data: schemas.UsuarioCreate,
    db: Session = Depends(get_db)
):
    """
    Crear un usuario.

    Se utiliza principalmente para:
    - Administrador
    - Usuario básico
    """

    # ========================================================
    # VALIDAR CORREO
    # ========================================================

    if not validar_correo(
        data.correo
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "El correo electrónico "
                "no tiene un formato válido"
            )
        )


    # ========================================================
    # VERIFICAR CORREO
    # ========================================================

    existente = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.correo
            == data.correo
        )
        .first()
    )

    if existente:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "El correo electrónico "
                "ya está registrado"
            )
        )


    # ========================================================
    # VALIDAR ROL
    # ========================================================

    roles_validos = [
        "Administrador",
        "Odontologo",
        "Paciente"
    ]

    if data.rol not in roles_validos:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Rol inválido. Debe ser uno de: "
                + ", ".join(roles_validos)
            )
        )


    # ========================================================
    # CREAR USUARIO
    # ========================================================

    try:

        nuevo_usuario = models.Usuario(

            correo=data.correo,

            contrasena=hash_password(
                data.contrasena
            ),

            rol=data.rol,

            estado=data.estado,

            # DATOS PERSONALES
            nombre=data.nombre,

            apellido=data.apellido,

            documento=data.documento,

            telefono=data.telefono
        )


        db.add(
            nuevo_usuario
        )

        db.commit()

        db.refresh(
            nuevo_usuario
        )


        return nuevo_usuario


    except Exception as e:

        db.rollback()

        logger.error("❌ Error creando usuario (%s)", type(e).__name__)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "No se pudo crear el usuario"
            )
        )


# ============================================================
# PUT - ACTUALIZAR USUARIO
# ============================================================

@router.put(
    "/{id}",
    response_model=schemas.UsuarioOut
)
def update_usuario(
    id: int,
    data: schemas.UsuarioUpdate,
    db: Session = Depends(get_db)
):
    """
    Actualizar un usuario.

    También actualiza los datos personales:
    - nombre
    - apellido
    - documento
    - telefono
    """

    # ========================================================
    # BUSCAR USUARIO
    # ========================================================

    usuario = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.id_usuario == id
        )
        .with_for_update().first()
    )

    if not usuario:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )


    # ========================================================
    # DATOS ENVIADOS
    # ========================================================

    update_data = data.model_dump(
        exclude_unset=True
    )

    if usuario.rol == "Paciente" and update_data.get("rol", usuario.rol) == "Paciente":
        update_data.pop("documento", None)

    # ========================================================
    # VALIDAR CORREO
    # ========================================================

    if "correo" in update_data:

        nuevo_correo = update_data["correo"]


        if not validar_correo(
            nuevo_correo
        ):

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "El correo electrónico "
                    "no tiene un formato válido"
                )
            )


        otro_usuario = (
            db.query(models.Usuario)
            .filter(
                models.Usuario.correo
                == nuevo_correo,

                models.Usuario.id_usuario
                != id
            )
            .first()
        )


        if otro_usuario:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "El correo electrónico "
                    "ya está registrado "
                    "por otro usuario"
                )
            )


    nueva_contrasena = update_data.pop("contrasena", None)

    # ========================================================
    # VALIDAR ROL
    # ========================================================

    if "rol" in update_data:

        roles_validos = [
            "Administrador",
            "Odontologo",
            "Paciente"
        ]


        if update_data["rol"] not in roles_validos:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Rol inválido. Debe ser uno de: "
                    + ", ".join(roles_validos)
                )
            )


    # ========================================================
    # VALIDAR ESTADO
    # ========================================================

    if "estado" in update_data:

        if update_data["estado"] not in [
            "Activo",
            "Inactivo"
        ]:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Estado debe ser "
                    "'Activo' o 'Inactivo'"
                )
            )


    # ========================================================
    # ACTUALIZAR
    # ========================================================

    try:
        version_changed = any(
            key in update_data and update_data[key] != getattr(usuario, key)
            for key in ("correo", "rol", "estado")
        )

        for key, value in update_data.items():

            setattr(
                usuario,
                key,
                value
            )


        if nueva_contrasena is not None:
            change_password(db, usuario, nueva_contrasena)
        elif version_changed:
            revoke_sessions(db, id)
            invalidate_reset_links(db, id)
        db.commit()

        db.refresh(
            usuario
        )


        return usuario


    except HTTPException:
        db.rollback()
        raise
    except Exception as e:

        db.rollback()

        logger.error("❌ Error actualizando usuario (%s)", type(e).__name__)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "No se pudo actualizar el usuario"
            )
        )


# ============================================================
# DELETE - ELIMINAR USUARIO
# ============================================================

@router.delete(
    "/{id}"
)
def delete_usuario(
    id: int,
    db: Session = Depends(get_db),
    admin=Depends(admin_user),
):
    """
    Eliminar un usuario y su información relacionada.
    """

    usuario = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.id_usuario == id
        )
        .first()
    )


    if not usuario:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )


    try:

        # ====================================================
        # PACIENTE
        # ====================================================

        if usuario.rol == "Paciente":

            relaciones = (
                db.query(
                    models.usuario_paciente
                )
                .filter(
                    models.usuario_paciente.c.id_usuario
                    == id
                )
                .all()
            )


            pacientes_ids = [

                relacion.id_paciente

                for relacion in relaciones

            ]


            for paciente_id in pacientes_ids:

                paciente = (
                    db.query(
                        models.Paciente
                    )
                    .filter(
                        models.Paciente.id_paciente
                        == paciente_id
                    )
                    .first()
                )


                if paciente:

                    audit_patient_deletion(db, admin, paciente_id)
                    db.delete(
                        paciente
                    )


        # ====================================================
        # ODONTÓLOGO
        # ====================================================

        elif usuario.rol == "Odontologo":

            odontologo = (
                db.query(
                    models.Odontologo
                )
                .filter(
                    models.Odontologo.correo
                    == usuario.correo
                )
                .first()
            )


            if odontologo:

                db.delete(
                    odontologo
                )


        # ====================================================
        # ELIMINAR USUARIO
        # ====================================================

        db.delete(
            usuario
        )


        db.commit()


        return {

            "mensaje":
                "Usuario y toda la información "
                "relacionada eliminados correctamente",

            "id_usuario":
                id
        }


    except Exception as e:

        db.rollback()

        logger.error("❌ Error eliminando usuario (%s)", type(e).__name__)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Error al eliminar usuario"
            )
        )


# ============================================================
# POST - REGISTRO COMPLETO
# ============================================================

@router.post(
    "/registro",
    response_model=schemas.RegistroResponse,
    status_code=status.HTTP_201_CREATED
)
def registro_usuario(
    data: schemas.RegistroRequest,
    db: Session = Depends(get_db)
):
    """
    Registro completo:

    Paciente:
        Usuario + Paciente + relación

    Odontólogo:
        Usuario + Odontólogo

    Administrador:
        Usuario
    """

    # ========================================================
    # VALIDAR CORREO
    # ========================================================

    if not validar_correo(
        data.correo
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Correo inválido"
        )


    # ========================================================
    # VERIFICAR CORREO
    # ========================================================

    existe = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.correo
            == data.correo
        )
        .first()
    )


    if existe:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya está registrado"
        )


    # ========================================================
    # ROLES
    # ========================================================

    roles_validos = [
        "Administrador",
        "Odontologo",
        "Paciente"
    ]


    if data.rol not in roles_validos:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rol inválido"
        )


    try:

        # ====================================================
        # CREAR USUARIO
        # ====================================================

        usuario = models.Usuario(

            correo=data.correo,

            contrasena=hash_password(
                data.contrasena
            ),

            rol=data.rol,

            estado=data.estado,

            # DATOS PERSONALES
            nombre=data.nombre,

            apellido=data.apellido,

            documento=data.documento,

            telefono=data.telefono
        )


        db.add(
            usuario
        )

        db.flush()


        id_paciente = None

        id_odontologo = None


        # ====================================================
        # PACIENTE
        # ====================================================

        if data.rol == "Paciente":

            documento = data.documento


            if not documento:

                documento = generar_documento_unico(
                    db
                )


            # ------------------------------------------------
            # VERIFICAR DOCUMENTO
            # ------------------------------------------------

            documento_existente = (
                db.query(
                    models.Paciente
                )
                .filter(
                    models.Paciente.documento
                    == documento
                )
                .first()
            )


            if documento_existente:

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "El documento "
                        "ya está registrado"
                    )
                )


            # ------------------------------------------------
            # CREAR PACIENTE
            # ------------------------------------------------

            paciente = models.Paciente(

                nombre=data.nombre or "",

                apellido=data.apellido or "",

                documento=documento,

                tipo_documento=data.tipo_documento,

                fecha_nacimiento=
                    data.fecha_nacimiento,

                genero=
                    data.genero,

                direccion=
                    data.direccion,

                telefono=
                    data.telefono,

                correo=
                    data.correo,

                eps=
                    data.eps,

                alergias=data.alergias
            )


            db.add(
                paciente
            )

            db.flush()


            id_paciente =paciente.id_paciente


            # ------------------------------------------------
            # RELACIÓN
            # ------------------------------------------------

            db.execute(

                models.usuario_paciente.insert().values(

                    id_usuario=
                        usuario.id_usuario,

                    id_paciente=
                        id_paciente
                )

            )


        # ====================================================
        # ODONTÓLOGO
        # ====================================================

        elif data.rol == "Odontologo":

            documento = data.documento


            if not documento:

                documento = generar_documento_unico(
                    db
                )


            # ------------------------------------------------
            # VERIFICAR DOCUMENTO
            # ------------------------------------------------

            documento_existente = (
                db.query(
                    models.Odontologo
                )
                .filter(
                    models.Odontologo.documento
                    == documento
                )
                .first()
            )


            if documento_existente:

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "El documento "
                        "ya está registrado"
                    )
                )


            # ------------------------------------------------
            # CONSULTORIO
            # ------------------------------------------------

            id_consultorio = (
                data.id_consultorio
                or 1
            )


            consultorio = (
                db.query(
                    models.Consultorio
                )
                .filter(
                    models.Consultorio.id_consultorio
                    == id_consultorio
                )
                .first()
            )


            if not consultorio:

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "El consultorio seleccionado "
                        "no existe"
                    )
                )


            # ------------------------------------------------
            # CREAR ODONTÓLOGO
            # ------------------------------------------------

            odontologo = models.Odontologo(

                nombre=
                    data.nombre or "",

                apellido=
                    data.apellido or "",

                documento=
                    documento,

                telefono=
                    data.telefono,

                correo=
                    data.correo,

                especialidad=
                    data.especialidad,

                id_consultorio=
                    id_consultorio
            )


            db.add(
                odontologo
            )

            db.flush()


            id_odontologo =odontologo.id_odontologo


        # ====================================================
        # ADMINISTRADOR
        # ====================================================

        elif data.rol == "Administrador":

            # Los datos personales ya se guardaron
            # directamente en Usuario.

            pass



        # ====================================================
        # GUARDAR
        # ====================================================
        if usuario.rol == "Paciente":
            programar_bienvenida(db, usuario)
            if data.fecha_nacimiento:
                programar_cumpleanos(db, usuario.id_usuario, data.fecha_nacimiento)
        db.commit()

        return schemas.RegistroResponse(
            mensaje="Usuario registrado correctamente",
            id_usuario=usuario.id_usuario,
            id_paciente=id_paciente,
            id_odontologo=id_odontologo,
            correo=usuario.correo,
            rol=usuario.rol
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()
        logger.error("Error en registro de usuario (%s)", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo registrar el usuario"
        )

# ============================================================
# POST - CAMBIAR CONTRASEÑA
# ============================================================

@router.post(
    "/{id}/cambiar-contrasena",
    status_code=status.HTTP_200_OK
)
def cambiar_contrasena(
    id: int,
    data: schemas.CambiarContrasenaRequest,
    db: Session = Depends(get_db),
):
    usuario = db.get(models.Usuario, id, with_for_update=True)
    if usuario is None:
        raise HTTPException(404, "Usuario no encontrado")
    change_password(db, usuario, data.contrasena)
    db.commit()
    return {"mensaje": "Contraseña actualizada correctamente", "id_usuario": id}
