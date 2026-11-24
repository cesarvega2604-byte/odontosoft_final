import logging
# routers/pacientes.py
# ============================================================
# CRUD COMPLETO DE PACIENTES - ODONTOSOFT
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import List

import models
import schemas

from database import get_db
from access import Principal, admin_user, current_user, patient_ids, require_patient, require_role
from clinical_audit import audit_patient_deletion
from correos_programados import paciente_de_cumpleanos, programar_cumpleanos


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/pacientes",
    tags=["Pacientes"]
)
IDENTIFICACION = schemas.CAMPOS_IDENTIFICACION_PACIENTE


def ficha_paciente(paciente, principal):
    if principal.role == "Odontologo":
        return schemas.PacienteOut.model_validate(paciente).model_copy(
            update=dict.fromkeys(IDENTIFICACION)
        )
    return paciente


# ============================================================
# GET - OBTENER TODOS LOS PACIENTES
# ============================================================

@router.get(
    "/",
    response_model=List[schemas.PacienteOut]
)
def get_pacientes(
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    """
    Obtener únicamente los pacientes que:
    - Tienen un usuario asociado.
    - El usuario tiene rol Paciente.
    - El usuario está Activo.

    Esto evita mostrar pacientes que quedaron sin usuario
    después de una eliminación.
    """

    if principal.role != "Administrador":
        pacientes = db.query(models.Paciente).filter(
            models.Paciente.id_paciente.in_(patient_ids(db, principal))
        ).all()
        return [ficha_paciente(paciente, principal) for paciente in pacientes]

    try:

        query = (
            db.query(models.Paciente)
            .join(
                models.usuario_paciente,
                models.usuario_paciente.c.id_paciente
                == models.Paciente.id_paciente
            )
            .join(
                models.Usuario,
                models.Usuario.id_usuario
                == models.usuario_paciente.c.id_usuario
            )
            .filter(
                models.Usuario.rol == "Paciente",
                models.Usuario.estado == "Activo"
            )
            .distinct()
        )

        return query.all()

    except Exception as e:

        logger.error("❌ Error al obtener pacientes (%s)", type(e).__name__)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener pacientes"
        )


# ============================================================
# GET - OBTENER PACIENTE POR ID
# ============================================================

@router.get(
    "/{id}",
    response_model=schemas.PacienteOut
)
def get_paciente(
    id: int,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    """
    Obtener un paciente por su ID.
    """

    require_patient(db, principal, id)
    paciente = (
        db.query(models.Paciente)
        .filter(
            models.Paciente.id_paciente == id
        )
        .first()
    )

    if not paciente:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado"
        )

    return ficha_paciente(paciente, principal)


# ============================================================
# GET - BUSCAR PACIENTE POR DOCUMENTO
# ============================================================

@router.get(
    "/documento/{documento}",
    response_model=schemas.PacienteOut
)
def get_paciente_by_documento(
    documento: str,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    """
    Obtener un paciente utilizando su número de documento.
    """

    require_role(principal, "Administrador", "Paciente")
    query = db.query(models.Paciente).filter(models.Paciente.documento == documento)
    if principal.role != "Administrador":
        query = query.filter(models.Paciente.id_paciente.in_(patient_ids(db, principal)))
    paciente = query.first()

    if not paciente:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado"
        )

    return paciente


# ============================================================
# POST - CREAR PACIENTE
# ============================================================

@router.post(
    "/",
    response_model=schemas.PacienteOut,
    status_code=status.HTTP_201_CREATED
)
def create_paciente(
    data: schemas.PacienteCreate,
    db: Session = Depends(get_db), _admin: Principal = Depends(admin_user)
):
    """
    Crear un nuevo paciente.
    """

    # --------------------------------------------------------
    # Verificar documento
    # --------------------------------------------------------

    paciente_existente = (
        db.query(models.Paciente)
        .filter(
            models.Paciente.documento == data.documento
        )
        .first()
    )

    if paciente_existente:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documento ya registrado"
        )

    # --------------------------------------------------------
    # Crear paciente
    # --------------------------------------------------------

    nuevo_paciente = models.Paciente(
        **data.model_dump()
    )

    try:

        db.add(nuevo_paciente)

        db.commit()

        db.refresh(nuevo_paciente)

        return nuevo_paciente

    except Exception as e:

        db.rollback()

        logger.error("❌ Error al crear paciente (%s)", type(e).__name__)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear paciente"
        )


# ============================================================
# PUT - ACTUALIZAR PACIENTE
# ============================================================

@router.put(
    "/{id}",
    response_model=schemas.PacienteOut
)
def update_paciente(
    id: int,
    data: schemas.PacienteUpdate,
    db: Session = Depends(get_db), principal: Principal = Depends(current_user)
):
    """
    Actualizar un paciente existente.

    Solo se modifican los campos enviados.
    """

    # --------------------------------------------------------
    # Buscar paciente
    # --------------------------------------------------------

    require_role(principal, "Administrador", "Paciente")
    require_patient(db, principal, id)
    paciente = (
        db.query(models.Paciente)
        .filter(
            models.Paciente.id_paciente == id
        )
        .with_for_update()
        .first()
    )

    if not paciente:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado"
        )

    # --------------------------------------------------------
    # Obtener solamente los campos enviados
    # --------------------------------------------------------

    update_data = data.model_dump(
        exclude_unset=True
    )

    # --------------------------------------------------------
    # Verificar documento
    # --------------------------------------------------------

    for key in IDENTIFICACION | {"correo"}:
        if key in update_data and update_data[key] == getattr(paciente, key):
            update_data.pop(key)
    if principal.role == "Paciente":
        if update_data.keys() - (IDENTIFICACION | {"nombre", "apellido", "telefono"}):
            raise HTTPException(403, "Los datos clínicos se actualizan en la historia clínica")
        if any(update_data[key] is None for key in update_data.keys() & IDENTIFICACION):
            raise HTTPException(422, "Completa el tipo y número de documento y la fecha de nacimiento")
    elif update_data.keys() & IDENTIFICACION:
        raise HTTPException(403, "El paciente actualiza su identificación desde su perfil")

    if "documento" in update_data:

        otro_paciente = (
            db.query(models.Paciente)
            .filter(
                models.Paciente.documento
                == update_data["documento"],

                models.Paciente.id_paciente != id
            )
            .first()
        )

        if otro_paciente:

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Documento ya registrado por otro paciente"
            )

    # --------------------------------------------------------
    # Aplicar cambios
    # --------------------------------------------------------

    try:

        for key, value in update_data.items():

            setattr(
                paciente,
                key,
                value
            )
        if "fecha_nacimiento" in update_data:
            titular = paciente_de_cumpleanos(db, principal.user_id)
            if titular is not None and titular.id_paciente == id:
                programar_cumpleanos(db, principal.user_id, paciente.fecha_nacimiento)

        db.commit()

        db.refresh(paciente)

        return paciente

    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Los datos del paciente entran en conflicto con otro registro") from None
    except Exception as e:

        db.rollback()

        logger.error("❌ Error al actualizar paciente (%s)", type(e).__name__)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar paciente"
        )


# ============================================================
# DELETE - ELIMINAR PACIENTE
# ============================================================

@router.delete(
    "/{id}"
)
def delete_paciente(
    id: int,
    db: Session = Depends(get_db), admin: Principal = Depends(admin_user)
):
    """
    Eliminar un paciente y toda su información relacionada.

    Se eliminan:
    - Relación usuario_paciente
    - Paciente
    - Citas
    - Historias clínicas
    - Servicios
    - Recordatorios de sus citas
    - Pagos de sus citas
    - Facturas relacionadas
    - Relaciones cita_tratamiento
    """

    # --------------------------------------------------------
    # Buscar paciente
    # --------------------------------------------------------

    paciente = (
        db.query(models.Paciente)
        .filter(
            models.Paciente.id_paciente == id
        )
        .first()
    )

    if not paciente:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado"
        )

    try:

        # ====================================================
        # 1. ELIMINAR RELACIONES USUARIO - PACIENTE
        # ====================================================

        db.execute(
            models.usuario_paciente.delete().where(
                models.usuario_paciente.c.id_paciente == id
            )
        )

        # ====================================================
        # 2. ELIMINAR PACIENTE
        #
        # Las relaciones ORM de Paciente tienen:
        #
        # cascade="all, delete-orphan"
        #
        # para historias, citas y servicios.
        # ====================================================

        audit_patient_deletion(db, admin, id)
        db.delete(paciente)

        # ====================================================
        # 3. GUARDAR CAMBIOS
        # ====================================================

        db.commit()

        return {
            "mensaje": "Paciente eliminado correctamente",
            "id_paciente": id
        }

    except Exception as e:

        db.rollback()

        logger.error("❌ Error al eliminar paciente (%s)", type(e).__name__)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar paciente"
        )
