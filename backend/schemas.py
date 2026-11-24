# schemas.py
# ============================================================
# SCHEMAS COMPLETOS - ODONTOSOFT
# ============================================================

from pydantic import AfterValidator, BaseModel, EmailStr, Field, ConfigDict, StringConstraints
from typing import Annotated, Literal, Optional, List
from datetime import date, time, datetime
from decimal import Decimal
from uuid import UUID
from passwords import MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, MAX_LOGIN_PASSWORD_LENGTH
from agenda import ZONA_AGENDA


def visible_password(value: str) -> str:
    if not value.strip():
        raise ValueError("La contraseña debe incluir algún carácter que no sea un espacio")
    return value


NewPassword = Annotated[
    str, Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH), AfterValidator(visible_password),
]


# ============================================================
# USUARIO
# ============================================================

class UsuarioBase(BaseModel):
    correo: EmailStr
    rol: str = "Paciente"
    estado: str = "Activo"

    # Datos personales del usuario
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    documento: Optional[str] = None
    telefono: Optional[str] = None


class UsuarioCreate(UsuarioBase):
    contrasena: NewPassword


class UsuarioUpdate(BaseModel):
    """
    Schema para actualizar usuario.
    Todos los campos son opcionales.
    """

    correo: Optional[EmailStr] = None

    contrasena: Optional[NewPassword] = None

    rol: Optional[str] = None
    estado: Optional[str] = None

    # Datos personales
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    documento: Optional[str] = None
    telefono: Optional[str] = None


class UsuarioOut(UsuarioBase):
    id_usuario: int
    requiere_restablecer_contrasena: bool = False

    fecha_registro: Optional[datetime] = None
    ultimo_acceso: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True
    )

# ============================================================
# PACIENTE
# ============================================================

TipoDocumento = Literal["CC", "TI", "CE", "PA", "RC", "PPT", "PEP", "OTRO"]
NumeroDocumento = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
CAMPOS_IDENTIFICACION_PACIENTE = {"tipo_documento", "documento", "fecha_nacimiento"}


def validar_nacimiento(value: date) -> date:
    if value > datetime.now(ZONA_AGENDA).date():
        raise ValueError("La fecha de nacimiento no puede estar en el futuro")
    return value


FechaNacimiento = Annotated[date, AfterValidator(validar_nacimiento)]


class PacienteBase(BaseModel):
    nombre: str = Field(..., min_length=1)
    apellido: str = Field(..., min_length=1)
    documento: str = Field(..., min_length=1)
    tipo_documento: Optional[TipoDocumento] = None

    fecha_nacimiento: Optional[date] = None
    genero: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None

    correo: Optional[EmailStr] = None

    eps: Optional[str] = None
    alergias: Optional[str] = None

class PacienteCreate(PacienteBase):
    model_config = ConfigDict(extra="forbid")


class PacienteUpdate(BaseModel):
    """
    Schema para actualizar paciente.
    Todos los campos son opcionales.
    """

    nombre: Optional[str] = Field(None, min_length=1)
    apellido: Optional[str] = Field(None, min_length=1)
    documento: Optional[NumeroDocumento] = None
    tipo_documento: Optional[TipoDocumento] = None

    fecha_nacimiento: Optional[FechaNacimiento] = None
    genero: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None

    correo: Optional[EmailStr] = None

    eps: Optional[str] = None
    alergias: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class PacienteOut(PacienteBase):
    id_paciente: int
    documento: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# LOGIN
# ============================================================

class LoginRequest(BaseModel):
    """
    Datos necesarios para iniciar sesión.
    """

    correo: EmailStr
    contrasena: str = Field(max_length=MAX_LOGIN_PASSWORD_LENGTH)


class LoginResponse(BaseModel):
    """
    Respuesta del login.
    """

    id_usuario: int
    correo: str
    rol: str
    estado: str
    mensaje: str


# ============================================================
# REGISTRO COMPLETO
# ============================================================

class RegistroRequest(BaseModel):
    """
    Registro completo de un usuario.

    Dependiendo del rol puede crear:
    - Paciente
    - Odontólogo
    - Administrador
    """

    correo: EmailStr

    contrasena: NewPassword

    rol: str = "Paciente"
    estado: str = "Activo"

    # --------------------------------------------------------
    # Datos comunes
    # --------------------------------------------------------

    nombre: Optional[str] = None
    apellido: Optional[str] = None
    documento: Optional[str] = None
    telefono: Optional[str] = None

    # --------------------------------------------------------
    # Datos del paciente
    # --------------------------------------------------------

    fecha_nacimiento: Optional[FechaNacimiento] = None
    tipo_documento: Optional[TipoDocumento] = None
    genero: Optional[str] = None
    direccion: Optional[str] = None
    eps: Optional[str] = None
    alergias: Optional[str] = None

    # --------------------------------------------------------
    # Datos del odontólogo
    # --------------------------------------------------------

    especialidad: Optional[str] = None

    # Consultorio del odontólogo
    id_consultorio: Optional[int] = None


class RegistroPacienteRequest(RegistroRequest):
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    documento: NumeroDocumento
    tipo_documento: TipoDocumento
    fecha_nacimiento: FechaNacimiento


class RegistroResponse(BaseModel):
    """
    Respuesta del registro completo.
    """

    mensaje: str

    id_usuario: int

    id_paciente: Optional[int] = None
    id_odontologo: Optional[int] = None

    correo: str
    rol: str


# ============================================================
# CONSULTORIO
# ============================================================

class ConsultorioBase(BaseModel):
    nombre: str = Field(..., min_length=1)

    ubicacion: Optional[str] = None
    numero_sala: Optional[str] = None


class ConsultorioCreate(ConsultorioBase):
    pass


class ConsultorioUpdate(BaseModel):
    """
    Actualización de consultorio.
    """

    nombre: Optional[str] = Field(None, min_length=1)
    ubicacion: Optional[str] = None
    numero_sala: Optional[str] = None


class ConsultorioOut(ConsultorioBase):
    id_consultorio: int

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# ODONTOLOGO
# ============================================================

class OdontologoBase(BaseModel):
    nombre: str = Field(..., min_length=1)
    apellido: str = Field(..., min_length=1)
    documento: str = Field(..., min_length=1)

    telefono: Optional[str] = None
    correo: Optional[EmailStr] = None
    especialidad: Optional[str] = None

    id_consultorio: int


class OdontologoCreate(OdontologoBase):
    pass


class OdontologoUpdate(BaseModel):
    """
    Actualización de odontólogo.
    Todos los campos son opcionales.
    """

    nombre: Optional[str] = Field(None, min_length=1)
    apellido: Optional[str] = Field(None, min_length=1)
    documento: Optional[str] = Field(None, min_length=1)

    telefono: Optional[str] = None
    correo: Optional[EmailStr] = None
    especialidad: Optional[str] = None

    registro_profesional: Optional[str] = None
    horario: Optional[str] = None

    id_consultorio: Optional[int] = None


class OdontologoOut(OdontologoBase):
    id_odontologo: int

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# HISTORIA CLÍNICA
# ============================================================

class HistoriaClinicaBase(BaseModel):
    fecha_apertura: date

    antecedentes: Optional[str] = None
    diagnostico_general: Optional[str] = None
    observaciones: Optional[str] = None

    id_paciente: int


class HistoriaClinicaCreate(HistoriaClinicaBase):
    pass


class HistoriaClinicaUpdate(BaseModel):
    """
    Actualización de historia clínica.
    """

    fecha_apertura: Optional[date] = None
    antecedentes: Optional[str] = None
    diagnostico_general: Optional[str] = None
    observaciones: Optional[str] = None

    id_paciente: Optional[int] = None


class HistoriaClinicaOut(HistoriaClinicaBase):
    id_historia: int

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# TRATAMIENTO
# ============================================================

class TratamientoBase(BaseModel):
    nombre: str = Field(..., min_length=1)

    descripcion: Optional[str] = None

    costo: Optional[Decimal] = Field(
        None,
        gt=0,
        max_digits=10,
        decimal_places=2
    )

    duracion_estimada: Optional[str] = None


class TratamientoCreate(TratamientoBase):
    pass


class TratamientoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1)

    descripcion: Optional[str] = None

    costo: Optional[Decimal] = Field(
        None,
        gt=0,
        max_digits=10,
        decimal_places=2
    )

    duracion_estimada: Optional[str] = None


class TratamientoOut(TratamientoBase):
    id_tratamiento: int

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# CITA
# ============================================================

class CitaBase(BaseModel):
    fecha: date
    hora: time
    duracion_minutos: int = Field(default=30, ge=5, le=480)

    estado: Optional[str] = "Pendiente"

    motivo_consulta: Optional[str] = None
    observaciones: Optional[str] = None

    id_paciente: int
    id_odontologo: int
    id_consultorio: int


class CitaCreate(CitaBase):
    id_tratamiento: Optional[int] = Field(default=None, gt=0)


class CitaUpdate(BaseModel):
    """
    Actualización de cita.
    Todos los campos son opcionales.
    """

    fecha: Optional[date] = None
    hora: Optional[time] = None
    duracion_minutos: Optional[int] = Field(default=None, ge=5, le=480)
    id_tratamiento: Optional[int] = Field(default=None, gt=0)

    estado: Optional[str] = None

    motivo_consulta: Optional[str] = None
    observaciones: Optional[str] = None

    id_paciente: Optional[int] = None
    id_odontologo: Optional[int] = None
    id_consultorio: Optional[int] = None


# ============================================================
# ODONTÓLOGO PARA MOSTRAR EN UNA CITA
# ============================================================

class OdontologoCitaOut(BaseModel):

    id_odontologo: int

    nombre: str

    apellido: str

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# RESPUESTA DE CITA
# ============================================================

class CitaOut(CitaBase):

    id_cita: int

    # --------------------------------------------------------
    # Odontólogo asignado
    # --------------------------------------------------------

    odontologo: Optional[OdontologoCitaOut] = None

    # --------------------------------------------------------
    # Tratamientos asignados
    #
    # Una cita puede tener uno o varios tratamientos.
    # --------------------------------------------------------

    tratamientos: List[TratamientoOut] = Field(
        default_factory=list
    )

    model_config = ConfigDict(
        from_attributes=True
    )

# ============================================================
# RECORDATORIO
# ============================================================

class RecordatorioBase(BaseModel):
    tipo: Optional[str] = None

    fecha_envio: Optional[datetime] = None

    estado: Optional[str] = "Pendiente"

    id_cita: int


class RecordatorioCreate(RecordatorioBase):
    pass


class RecordatorioUpdate(BaseModel):
    """
    Actualización de recordatorio.
    """

    tipo: Optional[str] = None
    fecha_envio: Optional[datetime] = None
    estado: Optional[str] = None
    id_cita: Optional[int] = None


class RecordatorioOut(RecordatorioBase):
    id_recordatorio: int

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# PAGO
# ============================================================

class PagoBase(BaseModel):
    fecha_pago: date

    monto: Decimal = Field(
        ...,
        gt=0
    )

    metodo_pago: Optional[str] = None

    estado_pago: Optional[str] = "Pendiente"

    referencia: Optional[str] = None

    id_cita: int


class PagoCreate(PagoBase):
    pass


class PagoUpdate(BaseModel):
    """
    Actualización de pago.
    """

    fecha_pago: Optional[date] = None

    monto: Optional[Decimal] = Field(
        None,
        gt=0
    )

    metodo_pago: Optional[str] = None
    estado_pago: Optional[str] = None
    referencia: Optional[str] = None

    id_cita: Optional[int] = None


class PagoOut(PagoBase):
    id_pago: int
    id_cita: Optional[int] = None
    id_compra: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# FACTURA
# ============================================================

class FacturaBase(BaseModel):
    fecha_emision: date

    subtotal: Optional[Decimal] = Field(
        None,
        ge=0
    )

    impuesto: Optional[Decimal] = Field(
        None,
        ge=0
    )

    total: Optional[Decimal] = Field(
        None,
        ge=0
    )

    id_pago: int


class FacturaCreate(FacturaBase):
    pass


class FacturaUpdate(BaseModel):
    """
    Actualización de factura.
    """

    fecha_emision: Optional[date] = None

    subtotal: Optional[Decimal] = Field(
        None,
        ge=0
    )

    impuesto: Optional[Decimal] = Field(
        None,
        ge=0
    )

    total: Optional[Decimal] = Field(
        None,
        ge=0
    )

    id_pago: Optional[int] = None


class FacturaOut(FacturaBase):
    id_factura: int
    id_pago: Optional[int] = None
    id_paciente: Optional[int] = None
    numero: str
    cliente: Optional[str] = None
    concepto: Optional[str] = None
    metodo_pago: Optional[str] = None
    fecha_pago: Optional[date] = None
    emitida_en: Optional[datetime] = None
    solicitada_en: Optional[datetime] = None
    estado_correo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CompraServicioCreate(BaseModel):
    id_tratamiento: int = Field(gt=0)
    clave: UUID
    precio: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    model_config = ConfigDict(extra="forbid")


class CompraServicioOut(BaseModel):
    id: int
    id_paciente: Optional[int] = None
    id_tratamiento: Optional[int] = None
    cliente: str
    concepto: str
    precio: Decimal
    solicitada_en: datetime
    id_factura: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


class ConfirmacionCompra(BaseModel):
    metodo: Literal["Efectivo", "Transferencia", "Tarjeta", "Otro"]
    model_config = ConfigDict(extra="forbid")


def validar_pieza(numero: int) -> int:
    if numero not in range(11, 49) or numero % 10 not in range(1, 9):
        raise ValueError("Selecciona una pieza del odontograma")
    return numero


class FaseTratamientoCreate(BaseModel):
    titulo: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    descripcion: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1500)]
    pieza: Optional[Annotated[int, AfterValidator(validar_pieza)]] = None
    estado: Literal["pendiente", "en_curso", "completada"] = "pendiente"
    compartida: bool = False
    model_config = ConfigDict(extra="forbid")


class FaseTratamientoOut(FaseTratamientoCreate):
    id: int
    id_paciente: int
    actualizada_en: datetime
    editable: bool = False
    model_config = ConfigDict(from_attributes=True)


# ============================================================
# ROL
# ============================================================

class RolBase(BaseModel):
    nombre: str = Field(..., min_length=1)

    descripcion: Optional[str] = None

    permisos: Optional[str] = "READ ONLY"


class RolCreate(RolBase):
    pass


class RolUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1)

    descripcion: Optional[str] = None

    permisos: Optional[str] = None


class RolOut(RolBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# PROVEEDOR
# ============================================================

class ProveedorBase(BaseModel):
    empresa: str = Field(..., min_length=1)

    contacto_asesor: Optional[str] = None
    telefono: Optional[str] = None
    suministro: Optional[str] = None

    estado_convenio: Optional[str] = "Vigente"


class ProveedorCreate(ProveedorBase):
    pass


class ProveedorUpdate(BaseModel):
    empresa: Optional[str] = Field(None, min_length=1)

    contacto_asesor: Optional[str] = None
    telefono: Optional[str] = None
    suministro: Optional[str] = None
    estado_convenio: Optional[str] = None


class ProveedorOut(ProveedorBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# SERVICIO
# ============================================================

class ServicioBase(BaseModel):
    paciente_id: int

    tratamiento_nombre: str = Field(
        ...,
        min_length=1
    )

    odontologo_nombre: Optional[str] = None

    proxima_cita: Optional[str] = None

    estado_cuenta: Optional[str] = "Pendiente"


class ServicioCreate(ServicioBase):
    pass


class ServicioUpdate(BaseModel):
    paciente_id: Optional[int] = None

    tratamiento_nombre: Optional[str] = Field(
        None,
        min_length=1
    )

    odontologo_nombre: Optional[str] = None
    proxima_cita: Optional[str] = None
    estado_cuenta: Optional[str] = None


class ServicioOut(ServicioBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# RESOLVER REFERENCIAS ADELANTADAS
# ============================================================

CitaOut.model_rebuild()

# ============================================================
# HISTORIA CLÍNICA DETALLADA
# ============================================================

class HistoriaClinicaDetalladaBase(BaseModel):
    id_paciente: int
    datos_clinicos: dict = {}


class HistoriaClinicaDetalladaCreate(HistoriaClinicaDetalladaBase):
    model_config = ConfigDict(extra="forbid")


class HistoriaClinicaDetalladaOut(HistoriaClinicaDetalladaBase):
    id_historia_detallada: Optional[int] = None
    fecha_actualizacion: Optional[datetime] = None
    paciente: Optional[PacienteOut] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# ODONTOGRAMA
# ============================================================

class OdontogramaBase(BaseModel):
    id_paciente: int
    dientes: dict = {}

class OdontogramaCreate(OdontogramaBase):
    pass

class OdontogramaOut(OdontogramaBase):
    id_odontograma: Optional[int] = None
    fecha_actualizacion: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ============================================================

#recuperarcontraseña

class SolicitarResetRequest(BaseModel):
    """Datos para solicitar el restablecimiento de contraseña."""
    correo: EmailStr


class ResetPasswordRequest(BaseModel):
    """Datos para confirmar el restablecimiento con el token recibido."""
    token: str = Field(min_length=43, max_length=43, pattern=r"^[A-Za-z0-9_-]+$")
    nueva_contrasena: NewPassword


class CambiarContrasenaRequest(BaseModel):
    contrasena: NewPassword


class MensajeResponse(BaseModel):
    """Respuesta genérica con un mensaje informativo."""
    mensaje: str

class ReservaPaciente(BaseModel):
    id_usuario: int = Field(gt=0)
    id_odontologo: int = Field(gt=0)
    id_tratamiento: Optional[int] = Field(default=None, gt=0)
    fecha: date
    hora: time
    motivo_consulta: Optional[str] = Field(default=None, max_length=1000)


class HorarioAlternativo(BaseModel):
    id_odontologo: int
    odontologo: str
    consultorio: str
    fecha: date
    hora: str


class BloqueoAgendaIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tipo: Literal["descanso_diario", "descanso_puntual", "vacaciones"]
    fecha_desde: date | None = None
    fecha_hasta: date | None = None
    hora_desde: time | None = None
    hora_hasta: time | None = None


class BloqueoAgendaOut(BloqueoAgendaIn):
    model_config = ConfigDict(from_attributes=True)

    id_bloqueo: int
