BEGIN TRANSACTION READ ONLY;

DO $$
DECLARE
    enlace record;
BEGIN
    FOR enlace IN
        SELECT * FROM (VALUES
            ('usuario_paciente', 'usuario'),
            ('usuario_paciente', 'paciente'),
            ('cita', 'paciente'),
            ('cita', 'odontologo'),
            ('cita', 'consultorio'),
            ('cita_tratamiento', 'cita'),
            ('cita_tratamiento', 'tratamiento'),
            ('historia_clinica', 'paciente'),
            ('historia_clinica_detallada', 'paciente'),
            ('odontograma', 'paciente'),
            ('bloqueo_agenda', 'odontologo'),
            ('correo_programado', 'usuario'),
            ('correo_programado', 'cita'),
            ('encuesta_cita', 'cita')
        ) AS v(tabla, referencia)
        WHERE v.tabla NOT IN ('bloqueo_agenda', 'correo_programado', 'encuesta_cita') OR to_regclass(format('public.%I', v.tabla)) IS NOT NULL
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint c
            WHERE c.contype = 'f' AND c.convalidated
                AND c.conrelid = to_regclass(format('public.%I', enlace.tabla))
                AND c.confrelid = to_regclass(format('public.%I', enlace.referencia))
        ) THEN
            RAISE EXCEPTION 'Falta una clave foránea validada de % a %', enlace.tabla, enlace.referencia;
        END IF;
    END LOOP;

    IF to_regclass('public.auditoria_clinica') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = to_regclass('public.auditoria_clinica')
            AND tgname = 'auditoria_clinica_solo_inserciones' AND tgenabled IN ('O', 'A')
    ) THEN
        RAISE EXCEPTION 'Falta la protección de la auditoría clínica';
    END IF;
END
$$;

SELECT format('SELECT %L AS tabla, count(*) AS filas FROM %I.%I;',
    tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec

COMMIT;
