# models.py
# ============================================================
# MODELOS COMPLETOS - ODONTOSOFT
# ============================================================

from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Text,
    Date,
    Time,
    Numeric,
    TIMESTAMP,
    Table,
    JSON,
    Boolean,
    CheckConstraint,
    Index,
    LargeBinary,
    UniqueConstraint,
    false,
    func,
    text,
)
from sqlalchemy.orm import backref, deferred, relationship
from database import Base


class SesionAcceso(Base):
    __tablename__ = "sesion_acceso"

    token_hash = Column(String(64), primary_key=True)
    id_usuario = Column(Integer, ForeignKey("usuario.id_usuario", ondelete="CASCADE"), nullable=False, index=True)
    usuario_version = Column(String(64), nullable=False)
    expira = Column(TIMESTAMP(timezone=True), nullable=False)
    canal = Column(String(16), nullable=False)


class Producto(Base):
    __tablename__ = "producto"

    id_producto = Column(Integer, primary_key=True)
    nombre = Column(String(120), nullable=False)
    descripcion = Column(Text, nullable=False)
    precio = Column(Numeric(12, 2), nullable=False)
    imagen = deferred(Column(LargeBinary))
    __table_args__ = (CheckConstraint("precio >= 0", name="ck_producto_precio"),)


class CorreoProgramado(Base):
    __tablename__ = "correo_programado"
    __table_args__ = (
        UniqueConstraint("id_usuario", "tipo", name="uq_correo_usuario_tipo"),
        UniqueConstraint("id_cita", "tipo", name="uq_correo_cita_tipo"),
        UniqueConstraint("id_factura", name="uq_correo_factura"),
        CheckConstraint(
            "(tipo IN ('bienvenida', 'cumpleanos') AND id_usuario IS NOT NULL AND id_cita IS NULL AND id_factura IS NULL) OR "
            "(tipo IN ('cita', 'recordatorio_24h', 'recordatorio_1h', 'encuesta') AND id_cita IS NOT NULL AND id_usuario IS NULL AND id_factura IS NULL) OR "
            "(tipo = 'factura' AND id_factura IS NOT NULL AND id_usuario IS NULL AND id_cita IS NULL)",
            name="ck_correo_destino",
        ),
        Index("ix_correo_programado_pendiente", "estado", "programado_para"),
    )

    id = Column(Integer, primary_key=True)
    tipo = Column(String(24), nullable=False)
    id_usuario = Column(Integer, ForeignKey("usuario.id_usuario", ondelete="CASCADE"))
    id_cita = Column(Integer, ForeignKey("cita.id_cita", ondelete="CASCADE"))
    id_factura = Column(Integer, ForeignKey("factura.id_factura", ondelete="CASCADE"))
    programado_para = Column(TIMESTAMP(timezone=True), nullable=False)
    vence = Column(TIMESTAMP(timezone=True), nullable=False)
    estado = Column(String(12), nullable=False, default="pendiente")
    intentos = Column(Integer, nullable=False, default=0)
    ultimo_envio = Column(TIMESTAMP(timezone=True))


class EncuestaCita(Base):
    __tablename__ = "encuesta_cita"
    __table_args__ = (
        CheckConstraint(
            "(respondida IS NULL AND estrellas IS NULL AND comentario IS NULL) OR "
            "(respondida IS NOT NULL AND estrellas IS NOT NULL AND comentario IS NOT NULL "
            "AND estrellas BETWEEN 1 AND 5)",
            name="ck_encuesta_respuesta",
        ),
    )

    id = Column(Integer, primary_key=True)
    id_cita = Column(Integer, ForeignKey("cita.id_cita", ondelete="SET NULL"), unique=True)
    token_hash = Column(String(64), unique=True)
    vence = Column(TIMESTAMP(timezone=True))
    respondida = Column(TIMESTAMP(timezone=True))
    estrellas = Column(Integer)
    comentario = Column(String(600))


class AuditoriaClinica(Base):
    __tablename__ = "auditoria_clinica"
    __table_args__ = (
        CheckConstraint("resultado IN ('permitido', 'denegado')", name="ck_auditoria_clinica_resultado"),
        Index("ix_auditoria_clinica_paciente_fecha", "id_paciente", "fecha"),
    )

    id_evento = Column(Integer, primary_key=True)
    fecha = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    # Conserva las referencias históricas aunque se eliminen los registros originales.
    id_usuario = Column(Integer, nullable=False)
    id_paciente = Column(Integer, nullable=False)
    recurso = Column(String(32), nullable=False)
    operacion = Column(String(16), nullable=False)
    id_registro = Column(Integer)
    resultado = Column(String(10), nullable=False)


# ============================================================
# TABLAS PIVOTE
# ============================================================

usuario_paciente = Table(
    "usuario_paciente",
    Base.metadata,

    Column(
        "id_usuario",
        Integer,
        ForeignKey(
            "usuario.id_usuario",
            ondelete="CASCADE"
        ),
        primary_key=True
    ),

    Column(
        "id_paciente",
        Integer,
        ForeignKey(
            "paciente.id_paciente",
            ondelete="CASCADE"
        ),
        primary_key=True
    ),

    extend_existing=True
)


usuario_tratamiento = Table(
    "usuario_tratamiento",
    Base.metadata,

    Column(
        "id_usuario",
        Integer,
        ForeignKey(
            "usuario.id_usuario",
            ondelete="CASCADE"
        ),
        primary_key=True
    ),

    Column(
        "id_tratamiento",
        Integer,
        ForeignKey(
            "tratamiento.id_tratamiento",
            ondelete="CASCADE"
        ),
        primary_key=True
    ),

    extend_existing=True
)


cita_tratamiento = Table(
    "cita_tratamiento",
    Base.metadata,

    Column(
        "id_cita",
        Integer,
        ForeignKey(
            "cita.id_cita",
            ondelete="CASCADE"
        ),
        primary_key=True
    ),

    Column(
        "id_tratamiento",
        Integer,
        ForeignKey(
            "tratamiento.id_tratamiento",
            ondelete="CASCADE"
        ),
        primary_key=True
    ),

    extend_existing=True
)


# ============================================================
# PACIENTE
# ============================================================

class Paciente(Base):

    __tablename__ = "paciente"

    __table_args__ = {
        "extend_existing": True
    }

    id_paciente = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String(100),
        nullable=False
    )

    apellido = Column(
        String(100),
        nullable=False
    )

    documento = Column(
        String(20),
        unique=True,
        nullable=False
    )

    fecha_nacimiento = Column(
        Date,
        nullable=True
    )
    tipo_documento = Column(String(12))

    genero = Column(
        String(20),
        nullable=True
    )

    direccion = Column(
        String(200),
        nullable=True
    )

    telefono = Column(
        String(20),
        nullable=True
    )

    correo = Column(
        String(100),
        nullable=True
    )

    eps = Column(
        String(100),
        nullable=True
    )

    alergias = Column(
        Text,
        nullable=True
    )

    usuarios = relationship(
        "Usuario",
        secondary=usuario_paciente,
        back_populates="pacientes"
    )

    historias = relationship(
        "HistoriaClinica",
        back_populates="paciente",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    citas = relationship(
        "Cita",
        back_populates="paciente",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    servicios = relationship(
        "Servicio",
        back_populates="paciente",
        cascade="all, delete-orphan",
        passive_deletes=True
    )


# ============================================================
# USUARIO
# ============================================================

class Usuario(Base):

    __tablename__ = "usuario"

    __table_args__ = {
        "extend_existing": True
    }

    id_usuario = Column(
        Integer,
        primary_key=True,
        index=True
    )

    correo = Column(
        String(100),
        nullable=False,
        unique=True
    )

    contrasena = Column(
        String(255),
        nullable=False
    )

    requiere_restablecer_contrasena = Column(Boolean, nullable=False, default=False, server_default=false())

    rol = Column(
        String(30),
        nullable=False,
        default="Paciente"
    )

    estado = Column(
        String(20),
        nullable=False,
        default="Activo"
    )

    # ========================================================
    # DATOS PERSONALES DEL USUARIO
    #
    # Se utilizan principalmente para Administrador.
    # También permiten conservar la información común
    # directamente en la tabla usuario.
    # ========================================================

    nombre = Column(
        String(100),
        nullable=True
    )

    apellido = Column(
        String(100),
        nullable=True
    )

    documento = Column(
        String(20),
        nullable=True
    )

    telefono = Column(
        String(20),
        nullable=True
    )

    # ========================================================
    # RELACIÓN USUARIO - PACIENTE
    # ========================================================

    pacientes = relationship(
        "Paciente",
        secondary=usuario_paciente,
        back_populates="usuarios"
    )

    # ========================================================
    # RELACIÓN USUARIO - TRATAMIENTO
    # ========================================================

    tratamientos = relationship(
        "Tratamiento",
        secondary=usuario_tratamiento,
        back_populates="usuarios"
    )


# ============================================================
# CONSULTORIO
# ============================================================

class Consultorio(Base):

    __tablename__ = "consultorio"

    __table_args__ = {
        "extend_existing": True
    }

    id_consultorio = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String(100),
        nullable=False
    )

    ubicacion = Column(
        String(150),
        nullable=True
    )

    numero_sala = Column(
        String(20),
        nullable=True
    )

    odontologos = relationship(
        "Odontologo",
        back_populates="consultorio",
        passive_deletes=True
    )

    citas = relationship(
        "Cita",
        back_populates="consultorio",
        passive_deletes=True
    )


# ============================================================
# ODONTÓLOGO
# ============================================================

class Odontologo(Base):

    __tablename__ = "odontologo"

    __table_args__ = {
        "extend_existing": True
    }

    id_odontologo = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String(100),
        nullable=False
    )

    apellido = Column(
        String(100),
        nullable=False
    )

    documento = Column(
        String(20),
        unique=True,
        nullable=False
    )

    telefono = Column(
        String(20),
        nullable=True
    )

    correo = Column(
        String(100),
        nullable=True
    )

    especialidad = Column(
        String(100),
        nullable=True
    )

    registro_profesional = Column(
        String(100),
        nullable=True
    )

    horario = Column(
        String(200),
        nullable=True
    )

    id_consultorio = Column(
        Integer,
        ForeignKey(
            "consultorio.id_consultorio",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    consultorio = relationship(
        "Consultorio",
        back_populates="odontologos"
    )

    citas = relationship(
        "Cita",
        back_populates="odontologo",
        passive_deletes=True
    )


# ============================================================
# HISTORIA CLÍNICA
# ============================================================

class HistoriaClinica(Base):

    __tablename__ = "historia_clinica"

    __table_args__ = {
        "extend_existing": True
    }

    id_historia = Column(
        Integer,
        primary_key=True,
        index=True
    )

    fecha_apertura = Column(
        Date,
        nullable=False
    )

    antecedentes = Column(
        Text,
        nullable=True
    )

    diagnostico_general = Column(
        Text,
        nullable=True
    )

    observaciones = Column(
        Text,
        nullable=True
    )

    id_paciente = Column(
        Integer,
        ForeignKey(
            "paciente.id_paciente",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    paciente = relationship(
        "Paciente",
        back_populates="historias"
    )


# ============================================================
# ODONTOGRAMA
# ============================================================

class Odontograma(Base):

    __tablename__ = "odontograma"

    __table_args__ = {"extend_existing": True}

    id_odontograma = Column(Integer, primary_key=True, index=True)

    id_paciente = Column(
        Integer,
        ForeignKey("paciente.id_paciente", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    dientes = Column(JSON, nullable=False, default=dict)
    fecha_actualizacion = Column(TIMESTAMP, nullable=False)

    paciente = relationship("Paciente", backref=backref("odontograma", passive_deletes="all"), uselist=False)


# ============================================================
# HISTORIA CLÍNICA DETALLADA DEL PACIENTE
# ============================================================

class HistoriaClinicaDetallada(Base):

    __tablename__ = "historia_clinica_detallada"

    __table_args__ = {
        "extend_existing": True
    }

    id_historia_detallada = Column(Integer, primary_key=True, index=True)

    id_paciente = Column(
        Integer,
        ForeignKey("paciente.id_paciente", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    datos_clinicos = Column(JSON, nullable=False, default=dict)

    fecha_actualizacion = Column(
        TIMESTAMP,
        nullable=False
    )

    paciente = relationship("Paciente", backref=backref("historia_detallada", passive_deletes="all"), uselist=False)



# ============================================================
# CITA
# ============================================================

class BloqueoAgenda(Base):
    __tablename__ = "bloqueo_agenda"
    __table_args__ = (
        CheckConstraint(
            "(tipo = 'vacaciones' AND fecha_desde IS NOT NULL AND fecha_hasta IS NOT NULL "
            "AND fecha_desde <= fecha_hasta AND hora_desde IS NULL AND hora_hasta IS NULL) OR "
            "(tipo IN ('descanso_puntual', 'descanso_diario') AND fecha_hasta IS NULL "
            "AND (fecha_desde IS NOT NULL) = (tipo = 'descanso_puntual') "
            "AND hora_desde IS NOT NULL AND hora_hasta IS NOT NULL AND hora_desde < hora_hasta)",
            name="ck_bloqueo_agenda_periodo",
        ),
        Index("ix_bloqueo_agenda_odontologo_fechas", "id_odontologo", "fecha_desde", "fecha_hasta"),
        Index(
            "uq_bloqueo_agenda_descanso_diario", "id_odontologo", unique=True,
            postgresql_where=text("tipo = 'descanso_diario'"), sqlite_where=text("tipo = 'descanso_diario'"),
        ),
        Index(
            "uq_bloqueo_agenda_descanso_puntual", "id_odontologo", "fecha_desde", unique=True,
            postgresql_where=text("tipo = 'descanso_puntual'"), sqlite_where=text("tipo = 'descanso_puntual'"),
        ),
    )

    id_bloqueo = Column(Integer, primary_key=True)
    id_odontologo = Column(Integer, ForeignKey("odontologo.id_odontologo", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(20), nullable=False)
    fecha_desde = Column(Date)
    fecha_hasta = Column(Date)
    hora_desde = Column(Time)
    hora_hasta = Column(Time)


class Cita(Base):

    __tablename__ = "cita"

    __table_args__ = {
        "extend_existing": True
    }

    id_cita = Column(
        Integer,
        primary_key=True,
        index=True
    )

    fecha = Column(
        Date,
        nullable=False
    )

    hora = Column(
        Time,
        nullable=False
    )

    duracion_minutos = Column(Integer, nullable=False, default=30, server_default="30")

    estado = Column(
        String(30),
        nullable=True,
        default="Pendiente"
    )

    motivo_consulta = Column(
        Text,
        nullable=True
    )

    observaciones = Column(
        Text,
        nullable=True
    )
    
    recordatorio_enviado = Column(
        Boolean,
        default=False,
        nullable=False
    )
    
    id_paciente = Column(
        Integer,
        ForeignKey(
            "paciente.id_paciente",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    id_odontologo = Column(
        Integer,
        ForeignKey(
            "odontologo.id_odontologo",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    id_consultorio = Column(
        Integer,
        ForeignKey(
            "consultorio.id_consultorio",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    paciente = relationship(
        "Paciente",
        back_populates="citas"
    )

    odontologo = relationship(
        "Odontologo",
        back_populates="citas"
    )

    consultorio = relationship(
        "Consultorio",
        back_populates="citas"
    )

    tratamientos = relationship(
        "Tratamiento",
        secondary=cita_tratamiento,
        back_populates="citas"
    )

    recordatorios = relationship(
        "Recordatorio",
        back_populates="cita",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    pagos = relationship(
        "Pago",
        back_populates="cita",
        cascade="all, delete-orphan",
        passive_deletes=True
    )


# ============================================================
# TRATAMIENTO
# ============================================================

class Tratamiento(Base):

    __tablename__ = "tratamiento"

    __table_args__ = {
        "extend_existing": True
    }

    id_tratamiento = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String(100),
        nullable=False
    )

    descripcion = Column(
        Text,
        nullable=True
    )

    costo = Column(
        Numeric(10, 2),
        nullable=True
    )

    duracion_estimada = Column(
        String(100),
        nullable=True
    )

    citas = relationship(
        "Cita",
        secondary=cita_tratamiento,
        back_populates="tratamientos"
    )

    usuarios = relationship(
        "Usuario",
        secondary=usuario_tratamiento,
        back_populates="tratamientos"
    )


# ============================================================
# RECORDATORIO
# ============================================================

class Recordatorio(Base):

    __tablename__ = "recordatorio"

    __table_args__ = {
        "extend_existing": True
    }

    id_recordatorio = Column(
        Integer,
        primary_key=True,
        index=True
    )

    tipo = Column(
        String(50),
        nullable=True
    )

    fecha_envio = Column(
        TIMESTAMP,
        nullable=True
    )

    estado = Column(
        String(30),
        nullable=True,
        default="Pendiente"
    )

    id_cita = Column(
        Integer,
        ForeignKey(
            "cita.id_cita",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    cita = relationship(
        "Cita",
        back_populates="recordatorios"
    )


# ============================================================
# PAGO
# ============================================================

class AdjuntoClinico(Base):
    __tablename__ = "adjunto_clinico"
    __table_args__ = (
        CheckConstraint("tamano BETWEEN 1 AND 15728640", name="ck_adjunto_clinico_tamano"),
    )

    id = Column(Integer, primary_key=True)
    id_paciente = Column(Integer, ForeignKey("paciente.id_paciente", ondelete="CASCADE"), nullable=False, index=True)
    id_usuario = Column(Integer, ForeignKey("usuario.id_usuario", ondelete="SET NULL"))
    nombre = Column(String(180), nullable=False)
    tipo = Column(String(40), nullable=False)
    tamano = Column(Integer, nullable=False)
    creado_en = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    contenido = deferred(Column(LargeBinary, nullable=False))


class FaseTratamiento(Base):
    __tablename__ = "fase_tratamiento"
    __table_args__ = (
        CheckConstraint("estado IN ('pendiente', 'en_curso', 'completada')", name="ck_fase_tratamiento_estado"),
        CheckConstraint(
            "pieza IS NULL OR (pieza BETWEEN 11 AND 48 AND pieza % 10 BETWEEN 1 AND 8)",
            name="ck_fase_tratamiento_pieza",
        ),
    )

    id = Column(Integer, primary_key=True)
    id_paciente = Column(Integer, ForeignKey("paciente.id_paciente", ondelete="CASCADE"), nullable=False, index=True)
    id_odontologo = Column(Integer, ForeignKey("odontologo.id_odontologo", ondelete="SET NULL"))
    titulo = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=False)
    pieza = Column(Integer)
    estado = Column(String(12), nullable=False, server_default="pendiente")
    compartida = Column(Boolean, nullable=False, server_default=false())
    actualizada_en = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class CompraServicio(Base):
    __tablename__ = "compra_servicio"
    __table_args__ = (
        UniqueConstraint("id_paciente", "clave", name="uq_compra_paciente_clave"),
        CheckConstraint("precio > 0", name="ck_compra_precio"),
    )

    id = Column(Integer, primary_key=True)
    id_paciente = Column(Integer, ForeignKey("paciente.id_paciente", ondelete="SET NULL"), index=True)
    id_tratamiento = Column(Integer, ForeignKey("tratamiento.id_tratamiento", ondelete="SET NULL"))
    concepto = Column(String(100), nullable=False)
    cliente = Column(String(201), nullable=False)
    precio = Column(Numeric(10, 2), nullable=False)
    clave = Column(String(36), nullable=False)
    solicitada_en = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class Pago(Base):

    __tablename__ = "pago"

    __table_args__ = (
        CheckConstraint("(id_cita IS NULL) <> (id_compra IS NULL)", name="ck_pago_origen"),
    )

    id_pago = Column(
        Integer,
        primary_key=True,
        index=True
    )

    fecha_pago = Column(
        Date,
        nullable=False
    )

    monto = Column(
        Numeric(10, 2),
        nullable=False
    )

    metodo_pago = Column(
        String(50),
        nullable=True
    )

    estado_pago = Column(
        String(30),
        nullable=True,
        default="Pendiente"
    )

    referencia = Column(
        String(100),
        nullable=True
    )

    id_cita = Column(
        Integer,
        ForeignKey(
            "cita.id_cita",
            ondelete="CASCADE"
        ),
        nullable=True
    )
    id_compra = Column(Integer, ForeignKey("compra_servicio.id", ondelete="RESTRICT"), unique=True)
    compra = relationship("CompraServicio")

    cita = relationship(
        "Cita",
        back_populates="pagos"
    )

    factura = relationship(
        "Factura",
        back_populates="pago",
        uselist=False,
        passive_deletes=True
    )


# ============================================================
# FACTURA
# ============================================================

class Factura(Base):

    __tablename__ = "factura"

    __table_args__ = {
        "extend_existing": True
    }

    id_factura = Column(
        Integer,
        primary_key=True,
        index=True
    )

    fecha_emision = Column(
        Date,
        nullable=False
    )

    subtotal = Column(
        Numeric(10, 2),
        nullable=True
    )

    impuesto = Column(
        Numeric(10, 2),
        nullable=True
    )

    total = Column(
        Numeric(10, 2),
        nullable=True
    )

    id_pago = Column(
        Integer,
        ForeignKey(
            "pago.id_pago",
            ondelete="SET NULL"
        ),
        unique=True,
        nullable=True
    )
    id_paciente = Column(Integer, ForeignKey("paciente.id_paciente", ondelete="SET NULL"), index=True)
    emitida_en = Column(TIMESTAMP(timezone=True))
    cliente = Column(String(201))
    concepto = Column(Text)
    metodo_pago = Column(String(50))
    fecha_pago = Column(Date)
    solicitada_en = Column(TIMESTAMP(timezone=True))

    pago = relationship(
        "Pago",
        back_populates="factura"
    )
    envio = relationship("CorreoProgramado", uselist=False, passive_deletes=True)

    @property
    def numero(self):
        return f"OS-{self.id_factura:06d}"

    @property
    def estado_correo(self):
        return self.envio.estado if self.envio else None


# ============================================================
# ROL
# ============================================================

class Rol(Base):

    __tablename__ = "rol"

    __table_args__ = {
        "extend_existing": True
    }

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String(100),
        nullable=False,
        unique=True
    )

    descripcion = Column(
        Text,
        nullable=True
    )

    permisos = Column(
        String(50),
        nullable=True,
        default="READ ONLY"
    )


# ============================================================
# PROVEEDOR
# ============================================================

class Proveedor(Base):

    __tablename__ = "proveedor"

    __table_args__ = {
        "extend_existing": True
    }

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    empresa = Column(
        String(200),
        nullable=False
    )

    contacto_asesor = Column(
        String(100),
        nullable=True
    )

    telefono = Column(
        String(20),
        nullable=True
    )

    suministro = Column(
        String(200),
        nullable=True
    )

    estado_convenio = Column(
        String(30),
        nullable=True,
        default="Vigente"
    )


# ============================================================
# SERVICIO
# ============================================================

class Servicio(Base):

    __tablename__ = "servicio"

    __table_args__ = {
        "extend_existing": True
    }

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    paciente_id = Column(
        Integer,
        ForeignKey(
            "paciente.id_paciente",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    tratamiento_nombre = Column(
        String(100),
        nullable=False
    )

    odontologo_nombre = Column(
        String(100),
        nullable=True
    )

    proxima_cita = Column(
        String(50),
        nullable=True
    )

    estado_cuenta = Column(
        String(30),
        nullable=True,
        default="Pendiente"
    )

    paciente = relationship(
        "Paciente",
        back_populates="servicios"
    )

# ============================================================
# RECUPERAR CONTRASEÑA SISABE PAPI
class PasswordResetToken(Base):

    __tablename__ = "password_reset_token"

    __table_args__ = {
        "extend_existing": True
    }

    id_token = Column(
        Integer,
        primary_key=True,
        index=True
    )

    token = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    id_usuario = Column(
        Integer,
        ForeignKey(
            "usuario.id_usuario",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    fecha_creacion = Column(
        TIMESTAMP,
        nullable=False
    )

    fecha_expiracion = Column(
        TIMESTAMP,
        nullable=False
    )

    usado = Column(
        Boolean,
        nullable=False,
        default=False
    )

    usuario = relationship(
        "Usuario",
        backref="reset_tokens"
    )
