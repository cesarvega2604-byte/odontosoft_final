-- OdontoSoft: esquema completo y datos ficticios para la exposición.
-- Crear una base vacía llamada odontosoft_demo y abrir Query Tool sobre ella.
-- Ejecutar todo de una vez. Requiere PostgreSQL; no instala extensiones.
-- Contraseña de las seis cuentas de demostración: ExpoOdonto2026!
BEGIN;
SET LOCAL search_path TO public, pg_catalog;
DO $guard$
BEGIN
    IF current_database() <> 'odontosoft_demo' THEN
        RAISE EXCEPTION 'Abre Query Tool en la base odontosoft_demo.';
    END IF;
    IF EXISTS (SELECT FROM pg_catalog.pg_tables WHERE schemaname = 'public') THEN
        RAISE EXCEPTION 'La base odontosoft_demo debe estar vacía antes de ejecutar el script.';
    END IF;
END
$guard$;


CREATE TABLE consultorio (
	id_consultorio SERIAL NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	ubicacion VARCHAR(150), 
	numero_sala VARCHAR(20), 
	PRIMARY KEY (id_consultorio)
);

CREATE INDEX ix_consultorio_id_consultorio ON consultorio (id_consultorio);

CREATE TABLE paciente (
	id_paciente SERIAL NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	apellido VARCHAR(100) NOT NULL, 
	documento VARCHAR(20) NOT NULL, 
	tipo_documento VARCHAR(12),
	fecha_nacimiento DATE, 
	genero VARCHAR(20), 
	direccion VARCHAR(200), 
	telefono VARCHAR(20), 
	correo VARCHAR(100), 
	eps VARCHAR(100), 
	alergias TEXT, 

	PRIMARY KEY (id_paciente), 
	UNIQUE (documento)
);

CREATE INDEX ix_paciente_id_paciente ON paciente (id_paciente);

CREATE TABLE proveedor (
	id SERIAL NOT NULL, 
	empresa VARCHAR(200) NOT NULL, 
	contacto_asesor VARCHAR(100), 
	telefono VARCHAR(20), 
	suministro VARCHAR(200), 
	estado_convenio VARCHAR(30), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_proveedor_id ON proveedor (id);

CREATE TABLE rol (
	id SERIAL NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	descripcion TEXT, 
	permisos VARCHAR(50), 
	PRIMARY KEY (id), 
	UNIQUE (nombre)
);

CREATE INDEX ix_rol_id ON rol (id);

CREATE TABLE tratamiento (
	id_tratamiento SERIAL NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	descripcion TEXT, 
	costo NUMERIC(10, 2), 
	duracion_estimada VARCHAR(100), 
	PRIMARY KEY (id_tratamiento)
);

CREATE INDEX ix_tratamiento_id_tratamiento ON tratamiento (id_tratamiento);

CREATE TABLE usuario (
	id_usuario SERIAL NOT NULL, 
	correo VARCHAR(100) NOT NULL, 
	contrasena VARCHAR(255) NOT NULL,
	requiere_restablecer_contrasena BOOLEAN NOT NULL DEFAULT FALSE, 
	rol VARCHAR(30) NOT NULL, 
	estado VARCHAR(20) NOT NULL, 
	nombre VARCHAR(100), 
	apellido VARCHAR(100), 
	documento VARCHAR(20), 
	telefono VARCHAR(20), 
	PRIMARY KEY (id_usuario), 
	UNIQUE (correo)
);

CREATE INDEX ix_usuario_id_usuario ON usuario (id_usuario);

CREATE TABLE historia_clinica (
	id_historia SERIAL NOT NULL, 
	fecha_apertura DATE NOT NULL, 
	antecedentes TEXT, 
	diagnostico_general TEXT, 
	observaciones TEXT, 
	id_paciente INTEGER NOT NULL, 
	PRIMARY KEY (id_historia), 
	FOREIGN KEY(id_paciente) REFERENCES paciente (id_paciente) ON DELETE CASCADE
);

CREATE INDEX ix_historia_clinica_id_historia ON historia_clinica (id_historia);

CREATE TABLE historia_clinica_detallada (
	id_historia_detallada SERIAL NOT NULL, 
	id_paciente INTEGER NOT NULL, 
	datos_clinicos JSON NOT NULL, 
	fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id_historia_detallada), 
	UNIQUE (id_paciente), 
	FOREIGN KEY(id_paciente) REFERENCES paciente (id_paciente) ON DELETE CASCADE
);

CREATE INDEX ix_historia_clinica_detallada_id_historia_detallada ON historia_clinica_detallada (id_historia_detallada);

CREATE TABLE odontograma (
	id_odontograma SERIAL NOT NULL, 
	id_paciente INTEGER NOT NULL, 
	dientes JSON NOT NULL, 
	fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id_odontograma), 
	UNIQUE (id_paciente), 
	FOREIGN KEY(id_paciente) REFERENCES paciente (id_paciente) ON DELETE CASCADE
);

CREATE INDEX ix_odontograma_id_odontograma ON odontograma (id_odontograma);

CREATE TABLE odontologo (
	id_odontologo SERIAL NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	apellido VARCHAR(100) NOT NULL, 
	documento VARCHAR(20) NOT NULL, 
	telefono VARCHAR(20), 
	correo VARCHAR(100), 
	especialidad VARCHAR(100), 
	registro_profesional VARCHAR(100), 
	horario VARCHAR(200), 
	id_consultorio INTEGER NOT NULL, 
	PRIMARY KEY (id_odontologo), 
	UNIQUE (documento), 
	FOREIGN KEY(id_consultorio) REFERENCES consultorio (id_consultorio) ON DELETE CASCADE
);

CREATE INDEX ix_odontologo_id_odontologo ON odontologo (id_odontologo);

CREATE TABLE password_reset_token (
	id_token SERIAL NOT NULL, 
	token VARCHAR(255) NOT NULL, 
	id_usuario INTEGER NOT NULL, 
	fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	fecha_expiracion TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	usado BOOLEAN NOT NULL, 
	PRIMARY KEY (id_token), 
	FOREIGN KEY(id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE
);

CREATE INDEX ix_password_reset_token_id_token ON password_reset_token (id_token);

CREATE UNIQUE INDEX ix_password_reset_token_token ON password_reset_token (token);

CREATE TABLE servicio (
	id SERIAL NOT NULL, 
	paciente_id INTEGER NOT NULL, 
	tratamiento_nombre VARCHAR(100) NOT NULL, 
	odontologo_nombre VARCHAR(100), 
	proxima_cita VARCHAR(50), 
	estado_cuenta VARCHAR(30), 
	PRIMARY KEY (id), 
	FOREIGN KEY(paciente_id) REFERENCES paciente (id_paciente) ON DELETE CASCADE
);

CREATE INDEX ix_servicio_id ON servicio (id);

CREATE TABLE usuario_paciente (
	id_usuario INTEGER NOT NULL, 
	id_paciente INTEGER NOT NULL, 
	PRIMARY KEY (id_usuario, id_paciente), 
	FOREIGN KEY(id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE, 
	FOREIGN KEY(id_paciente) REFERENCES paciente (id_paciente) ON DELETE CASCADE
);

CREATE TABLE usuario_tratamiento (
	id_usuario INTEGER NOT NULL, 
	id_tratamiento INTEGER NOT NULL, 
	PRIMARY KEY (id_usuario, id_tratamiento), 
	FOREIGN KEY(id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE, 
	FOREIGN KEY(id_tratamiento) REFERENCES tratamiento (id_tratamiento) ON DELETE CASCADE
);

CREATE TABLE cita (
	id_cita SERIAL NOT NULL, 
	fecha DATE NOT NULL, 
	hora TIME WITHOUT TIME ZONE NOT NULL, 
	duracion_minutos INTEGER DEFAULT '30' NOT NULL, 
	estado VARCHAR(30), 
	motivo_consulta TEXT, 
	observaciones TEXT, 
	recordatorio_enviado BOOLEAN NOT NULL, 
	id_paciente INTEGER NOT NULL, 
	id_odontologo INTEGER NOT NULL, 
	id_consultorio INTEGER NOT NULL, 
	PRIMARY KEY (id_cita), 
	FOREIGN KEY(id_paciente) REFERENCES paciente (id_paciente) ON DELETE CASCADE, 
	FOREIGN KEY(id_odontologo) REFERENCES odontologo (id_odontologo) ON DELETE CASCADE, 
	FOREIGN KEY(id_consultorio) REFERENCES consultorio (id_consultorio) ON DELETE CASCADE
);

CREATE INDEX ix_cita_id_cita ON cita (id_cita);

CREATE TABLE cita_tratamiento (
	id_cita INTEGER NOT NULL, 
	id_tratamiento INTEGER NOT NULL, 
	PRIMARY KEY (id_cita, id_tratamiento), 
	FOREIGN KEY(id_cita) REFERENCES cita (id_cita) ON DELETE CASCADE, 
	FOREIGN KEY(id_tratamiento) REFERENCES tratamiento (id_tratamiento) ON DELETE CASCADE
);

CREATE TABLE pago (
	id_pago SERIAL NOT NULL, 
	fecha_pago DATE NOT NULL, 
	monto NUMERIC(10, 2) NOT NULL, 
	metodo_pago VARCHAR(50), 
	estado_pago VARCHAR(30), 
	referencia VARCHAR(100), 
	id_cita INTEGER NOT NULL, 
	PRIMARY KEY (id_pago), 
	FOREIGN KEY(id_cita) REFERENCES cita (id_cita) ON DELETE CASCADE
);

CREATE INDEX ix_pago_id_pago ON pago (id_pago);

CREATE TABLE recordatorio (
	id_recordatorio SERIAL NOT NULL, 
	tipo VARCHAR(50), 
	fecha_envio TIMESTAMP WITHOUT TIME ZONE, 
	estado VARCHAR(30), 
	id_cita INTEGER NOT NULL, 
	PRIMARY KEY (id_recordatorio), 
	FOREIGN KEY(id_cita) REFERENCES cita (id_cita) ON DELETE CASCADE
);

CREATE INDEX ix_recordatorio_id_recordatorio ON recordatorio (id_recordatorio);

CREATE TABLE factura (
	id_factura SERIAL NOT NULL, 
	fecha_emision DATE NOT NULL, 
	subtotal NUMERIC(10, 2), 
	impuesto NUMERIC(10, 2), 
	total NUMERIC(10, 2), 
	id_pago INTEGER NOT NULL, 
	PRIMARY KEY (id_factura), 
	UNIQUE (id_pago), 
	FOREIGN KEY(id_pago) REFERENCES pago (id_pago) ON DELETE CASCADE
);

CREATE INDEX ix_factura_id_factura ON factura (id_factura);

CREATE TABLE sesion_acceso (
    token_hash VARCHAR(64) PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    usuario_version VARCHAR(64) NOT NULL,
    expira TIMESTAMP WITH TIME ZONE NOT NULL,
    canal VARCHAR(16) NOT NULL
);

CREATE INDEX ix_sesion_acceso_id_usuario ON sesion_acceso (id_usuario);

ALTER TABLE cita ADD CONSTRAINT cita_duracion_minutos_rango CHECK (duracion_minutos BETWEEN 5 AND 480);
CREATE INDEX ix_cita_fecha_agenda ON cita(fecha);

INSERT INTO rol (nombre, descripcion, permisos) VALUES
    ('Administrador', 'Gestión administrativa de la clínica', 'FULL ACCESS'),
    ('Odontologo', 'Agenda y atención clínica', 'READ / UPDATE'),
    ('Paciente', 'Portal y reservas del paciente', 'READ ONLY');

INSERT INTO consultorio (nombre, ubicacion, numero_sala) VALUES
    ('Consultorio Central', 'Sede de demostración', '101'),
    ('Consultorio Norte', 'Sede de demostración', '202');

INSERT INTO usuario (correo, contrasena, rol, estado, nombre, apellido, documento, telefono)
SELECT correo, hash_argon2id, rol, 'Activo', nombre, apellido, documento, telefono
FROM (VALUES
    ('admin@odontosoft.example', '$argon2id$v=19$m=19456,t=2,p=1$+vCSRjjIJeRFru7dvHkKKQ$ZNtWVUc3VTK+iFp8tpOjoRaGX+T4IKCIuzQ8+6kZJlw', 'Administrador', 'Camila', 'Demo', 'DEMO-A01', '0000000001'),
    ('admin2@odontosoft.example', '$argon2id$v=19$m=19456,t=2,p=1$9K97XsvRN42kJEgLC3MY8w$BeWH32BhHJpDfGl5gbcBa1YNto/AIrmyFfzrPpbDp5E', 'Administrador', 'Mateo', 'Demo', 'DEMO-A02', '0000000002'),
    ('odontologo@odontosoft.example', '$argon2id$v=19$m=19456,t=2,p=1$+Cluq6KzYa1LR0n1oBh/tA$ZyAtAb9Yyh1r0ZAqLINviEddn+FQiYxDcjm7nYO1wB0', 'Odontologo', 'Lucía', 'Demo', 'DEMO-O01', '0000000003'),
    ('odontologo2@odontosoft.example', '$argon2id$v=19$m=19456,t=2,p=1$81WlsWEYpkduiC9TrRffWg$t9hNYCR63GmkZxMRn6fHLqet90v16Dc9ualWmnc1UN8', 'Odontologo', 'Santiago', 'Demo', 'DEMO-O02', '0000000004'),
    ('paciente@odontosoft.example', '$argon2id$v=19$m=19456,t=2,p=1$DBcEM8vaF/7zT/fwQ3IXgQ$R/ynzFDPqwkqOOk+9ON0JK9ysgwesfEV57WUcTobB44', 'Paciente', 'Valentina', 'Demo', 'DEMO-P01', '0000000005'),
    ('paciente2@odontosoft.example', '$argon2id$v=19$m=19456,t=2,p=1$rn/knZ8vqkugCrPKhnLMIg$WlTsQVOxq7SPngP2IkOa3KsmZjPFG0PCS36a8Laq/jQ', 'Paciente', 'Nicolás', 'Demo', 'DEMO-P02', '0000000006')
) AS demo(correo, hash_argon2id, rol, nombre, apellido, documento, telefono);

INSERT INTO odontologo (nombre, apellido, documento, telefono, correo, especialidad, registro_profesional, horario, id_consultorio)
SELECT u.nombre, u.apellido, u.documento, u.telefono, u.correo, d.especialidad, d.registro,
       'Lunes a viernes de 08:00 a 17:30', c.id_consultorio
FROM (VALUES
    ('odontologo@odontosoft.example', 'Odontología general', 'DEMO-REG-01', '101'),
    ('odontologo2@odontosoft.example', 'Ortodoncia', 'DEMO-REG-02', '202')
) AS d(correo, especialidad, registro, sala)
JOIN usuario u ON u.correo = d.correo JOIN consultorio c ON c.numero_sala = d.sala;

INSERT INTO paciente (nombre, apellido, documento, tipo_documento, telefono, correo, fecha_nacimiento, genero, eps)
SELECT u.nombre, u.apellido, u.documento, 'CC', u.telefono, u.correo, p.nacimiento, p.genero, 'EPS Ficticia'
FROM (VALUES
    ('paciente@odontosoft.example', DATE '1995-08-10', 'Femenino'),
    ('paciente2@odontosoft.example', DATE '1990-04-23', 'Masculino')
) AS p(correo, nacimiento, genero) JOIN usuario u ON u.correo = p.correo;

INSERT INTO usuario_paciente (id_usuario, id_paciente)
SELECT u.id_usuario, p.id_paciente FROM usuario u JOIN paciente p ON p.correo = u.correo WHERE u.rol = 'Paciente';

INSERT INTO tratamiento (nombre, descripcion, costo, duracion_estimada) VALUES
    ('Valoración inicial', 'Consulta de demostración', 60000, '30 min'),
    ('Limpieza dental', 'Procedimiento de demostración', 120000, '45 min'),
    ('Control de ortodoncia', 'Control de demostración', 90000, '30 min');

INSERT INTO proveedor (empresa, contacto_asesor, telefono, suministro, estado_convenio)
VALUES ('Suministros Dentales Demo', 'Contacto ficticio', '0000000007', 'Material odontológico', 'Vigente');

-- Próximo martes en Colombia. Si el script se ejecuta un martes, usa ese mismo día.
WITH reloj AS (
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date AS hoy
), exposicion AS (
    SELECT hoy + ((2 - EXTRACT(ISODOW FROM hoy)::integer + 7) % 7) AS fecha FROM reloj
), creadas AS (
    INSERT INTO cita (fecha, hora, duracion_minutos, estado, motivo_consulta, recordatorio_enviado,
                      id_paciente, id_odontologo, id_consultorio)
    SELECT x.fecha, d.hora, d.duracion, d.estado, 'Cita ficticia para exposición', TRUE,
           p.id_paciente, o.id_odontologo, o.id_consultorio
    FROM exposicion x CROSS JOIN (VALUES
        ('paciente@odontosoft.example', 'odontologo@odontosoft.example', TIME '09:00', 30, 'En Consulta'),
        ('paciente2@odontosoft.example', 'odontologo@odontosoft.example', TIME '10:00', 45, 'En Espera'),
        ('paciente2@odontosoft.example', 'odontologo2@odontosoft.example', TIME '11:00', 30, 'En Espera')
    ) AS d(paciente, odontologo, hora, duracion, estado)
    JOIN paciente p ON p.correo = d.paciente JOIN odontologo o ON o.correo = d.odontologo
    RETURNING id_cita, hora
)
INSERT INTO cita_tratamiento (id_cita, id_tratamiento)
SELECT c.id_cita, t.id_tratamiento FROM creadas c
JOIN tratamiento t ON t.nombre = CASE c.hora
    WHEN TIME '09:00' THEN 'Valoración inicial'
    WHEN TIME '10:00' THEN 'Limpieza dental'
    ELSE 'Control de ortodoncia'
END;

CREATE TABLE IF NOT EXISTS auditoria_clinica (
    id_evento integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    fecha timestamptz NOT NULL DEFAULT now(),
    id_usuario integer NOT NULL,
    id_paciente integer NOT NULL,
    recurso varchar(32) NOT NULL,
    operacion varchar(16) NOT NULL,
    id_registro integer,
    resultado varchar(10) NOT NULL,
    CONSTRAINT ck_auditoria_clinica_resultado CHECK (resultado IN ('permitido', 'denegado'))
);

CREATE INDEX IF NOT EXISTS ix_auditoria_clinica_paciente_fecha
    ON auditoria_clinica (id_paciente, fecha);

CREATE OR REPLACE FUNCTION rechazar_cambio_auditoria_clinica() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'La auditoría clínica solo admite inserciones' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS auditoria_clinica_solo_inserciones ON auditoria_clinica;
CREATE TRIGGER auditoria_clinica_solo_inserciones
    BEFORE UPDATE OR DELETE OR TRUNCATE ON auditoria_clinica
    FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_auditoria_clinica();

CREATE TABLE IF NOT EXISTS bloqueo_agenda (
    id_bloqueo integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    id_odontologo integer NOT NULL REFERENCES odontologo(id_odontologo) ON DELETE CASCADE,
    tipo varchar(20) NOT NULL,
    fecha_desde date,
    fecha_hasta date,
    hora_desde time,
    hora_hasta time,
    CONSTRAINT ck_bloqueo_agenda_periodo CHECK (
        (tipo = 'vacaciones' AND fecha_desde IS NOT NULL AND fecha_hasta IS NOT NULL
            AND fecha_desde <= fecha_hasta AND hora_desde IS NULL AND hora_hasta IS NULL)
        OR
        (tipo IN ('descanso_puntual', 'descanso_diario') AND fecha_hasta IS NULL
            AND (fecha_desde IS NOT NULL) = (tipo = 'descanso_puntual')
            AND hora_desde IS NOT NULL AND hora_hasta IS NOT NULL AND hora_desde < hora_hasta)
    )
);

CREATE INDEX IF NOT EXISTS ix_bloqueo_agenda_odontologo_fechas
    ON bloqueo_agenda (id_odontologo, fecha_desde, fecha_hasta);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bloqueo_agenda_descanso_diario
    ON bloqueo_agenda (id_odontologo) WHERE tipo = 'descanso_diario';

CREATE UNIQUE INDEX IF NOT EXISTS uq_bloqueo_agenda_descanso_puntual
    ON bloqueo_agenda (id_odontologo, fecha_desde) WHERE tipo = 'descanso_puntual';

CREATE TABLE IF NOT EXISTS producto (
    id_producto integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nombre varchar(120) NOT NULL,
    descripcion text NOT NULL,
    precio numeric(12, 2) NOT NULL CONSTRAINT ck_producto_precio CHECK (precio >= 0),
    imagen bytea
);

CREATE TABLE IF NOT EXISTS correo_programado (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    tipo varchar(24) NOT NULL,
    id_usuario integer REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    id_cita integer REFERENCES cita(id_cita) ON DELETE CASCADE,
    programado_para timestamptz NOT NULL,
    vence timestamptz NOT NULL,
    estado varchar(12) NOT NULL DEFAULT 'pendiente',
    intentos integer NOT NULL DEFAULT 0,
    ultimo_envio timestamptz,
    CONSTRAINT uq_correo_usuario_tipo UNIQUE (id_usuario, tipo),
    CONSTRAINT uq_correo_cita_tipo UNIQUE (id_cita, tipo),
    CONSTRAINT ck_correo_destino CHECK (
        (tipo IN ('bienvenida', 'cumpleanos') AND id_usuario IS NOT NULL AND id_cita IS NULL) OR
        (tipo IN ('cita', 'recordatorio_24h', 'recordatorio_1h', 'encuesta') AND id_cita IS NOT NULL AND id_usuario IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS ix_correo_programado_pendiente ON correo_programado (estado, programado_para);

WITH calendario AS (
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date AS hoy
), cumpleanos_demo AS (
    SELECT up.id_usuario, hoy, make_date(extract(year FROM hoy)::int,
           extract(month FROM p.fecha_nacimiento)::int, extract(day FROM p.fecha_nacimiento)::int) AS fecha
    FROM usuario_paciente up
    JOIN paciente p ON p.id_paciente = up.id_paciente
    CROSS JOIN calendario
), proximos AS (
    SELECT id_usuario, CASE WHEN fecha >= hoy THEN fecha ELSE (fecha + interval '1 year')::date END AS fecha
    FROM cumpleanos_demo
)
INSERT INTO correo_programado (tipo, id_usuario, programado_para, vence)
SELECT 'cumpleanos', id_usuario, (fecha + time '09:00') AT TIME ZONE 'America/Bogota',
       (fecha + 1)::timestamp AT TIME ZONE 'America/Bogota'
FROM proximos;

CREATE TABLE IF NOT EXISTS encuesta_cita (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    id_cita integer UNIQUE REFERENCES cita(id_cita) ON DELETE SET NULL,
    token_hash varchar(64) UNIQUE,
    vence timestamptz,
    respondida timestamptz,
    estrellas integer,
    comentario varchar(600),
    CONSTRAINT ck_encuesta_respuesta CHECK (
        (respondida IS NULL AND estrellas IS NULL AND comentario IS NULL)
        OR (respondida IS NOT NULL AND estrellas IS NOT NULL AND comentario IS NOT NULL AND estrellas BETWEEN 1 AND 5)
    )
);

COMMIT;

-- Resumen de carga para la exposición.
SELECT rol, correo, estado FROM usuario ORDER BY rol, correo;
