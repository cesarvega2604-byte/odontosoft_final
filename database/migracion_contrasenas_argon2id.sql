-- Ejecutar con FastAPI detenido, sobre la base de OdontoSoft que se actualizará.
BEGIN;
SET LOCAL search_path TO pg_catalog, public;

ALTER TABLE usuario ALTER COLUMN contrasena TYPE VARCHAR(255);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS requiere_restablecer_contrasena BOOLEAN NOT NULL DEFAULT FALSE;

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'public.paciente'::regclass
          AND attname = 'contrasena_plano'
          AND NOT attisdropped
    ) THEN
        -- La comprobación usa únicamente la presencia del valor. Las claves antiguas
        -- no se copian ni se reutilizan como contraseñas de las cuentas afectadas.
        UPDATE usuario AS u
        SET requiere_restablecer_contrasena = TRUE
        WHERE EXISTS (
            SELECT 1
            FROM paciente AS p
            LEFT JOIN usuario_paciente AS up ON up.id_paciente = p.id_paciente
                AND up.id_usuario = u.id_usuario
            WHERE p.contrasena_plano IS NOT NULL
              AND p.contrasena_plano <> ''
              AND (up.id_usuario IS NOT NULL OR lower(p.correo) = lower(u.correo))
        );

        ALTER TABLE paciente DROP COLUMN contrasena_plano;
    END IF;
END
$migration$;

-- La migración de sesiones debe ejecutarse primero en instalaciones antiguas.
DELETE FROM sesion_acceso AS s USING usuario AS u
WHERE s.id_usuario = u.id_usuario AND u.requiere_restablecer_contrasena;

-- Los enlaces antiguos contenían un token de 43 caracteres en texto plano.
-- Los enlaces nuevos conservan en la base únicamente su digest hexadecimal.
DELETE FROM password_reset_token WHERE token !~ '^[0-9a-f]{64}$';

COMMIT;

SELECT count(*) AS cuentas_que_requieren_restablecimiento
FROM usuario WHERE requiere_restablecer_contrasena;
