BEGIN;

ALTER TABLE paciente ADD COLUMN IF NOT EXISTS tipo_documento varchar(12);
ALTER TABLE correo_programado ADD COLUMN IF NOT EXISTS ultimo_envio timestamptz;
ALTER TABLE correo_programado DROP CONSTRAINT IF EXISTS ck_correo_destino;
ALTER TABLE correo_programado ADD CONSTRAINT ck_correo_destino CHECK (
    (tipo IN ('bienvenida', 'cumpleanos') AND id_usuario IS NOT NULL AND id_cita IS NULL)
    OR (tipo IN ('cita', 'recordatorio_24h', 'recordatorio_1h', 'encuesta') AND id_cita IS NOT NULL AND id_usuario IS NULL)
);

WITH perfiles AS (
    SELECT DISTINCT ON (u.id_usuario) u.id_usuario, p.fecha_nacimiento
    FROM usuario u
    JOIN usuario_paciente up ON up.id_usuario = u.id_usuario
    JOIN paciente p ON p.id_paciente = up.id_paciente
    WHERE u.rol = 'Paciente'
    ORDER BY u.id_usuario, (lower(p.correo) = lower(u.correo)) DESC NULLS LAST, p.id_paciente
), calendario AS (
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date AS hoy
), meses AS (
    SELECT id_usuario, hoy, extract(day FROM fecha_nacimiento)::int AS dia,
           make_date(extract(year FROM hoy)::int + desplazamiento, extract(month FROM fecha_nacimiento)::int, 1) AS inicio_mes
    FROM perfiles CROSS JOIN calendario CROSS JOIN generate_series(0, 1) AS anos(desplazamiento)
    WHERE fecha_nacimiento IS NOT NULL AND fecha_nacimiento <= hoy
), candidatos AS (
    SELECT id_usuario, hoy, LEAST(inicio_mes + (dia - 1), (inicio_mes + interval '1 month')::date - 1) AS fecha
    FROM meses
), proximos AS (
    SELECT id_usuario, min(fecha) AS fecha
    FROM candidatos WHERE fecha >= hoy GROUP BY id_usuario
)
INSERT INTO correo_programado (tipo, id_usuario, programado_para, vence)
SELECT 'cumpleanos', id_usuario, (fecha + time '09:00') AT TIME ZONE 'America/Bogota',
       (fecha + 1)::timestamp AT TIME ZONE 'America/Bogota'
FROM proximos
ON CONFLICT (id_usuario, tipo) DO NOTHING;

COMMIT;
