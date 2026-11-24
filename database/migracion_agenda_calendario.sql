-- OdontoSoft: duración de citas para detectar cruces de horario.
-- Ejecutar UNA VEZ sobre la base que utiliza backend/.env, antes de reiniciar la API.
-- No borra tablas, pacientes ni citas.
BEGIN;
-- Solo la primera ejecución importa la duración del catálogo a las citas existentes.
-- Las siguientes ejecuciones conservan cualquier duración editada posteriormente.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='cita'::regclass AND attname='duracion_minutos' AND NOT attisdropped) THEN
  ALTER TABLE cita ADD COLUMN duracion_minutos INTEGER NOT NULL DEFAULT 30;
  UPDATE cita c SET duracion_minutos = sub.minutos
  FROM (
   SELECT ct.id_cita, LEAST(480, GREATEST(5, SUM(
    CASE
      WHEN lower(COALESCE(t.duracion_estimada,'')) ~ '^[[:space:]]*[0-9]+[[:space:]]*(min|minuto|minutos)[[:space:]]*$'
        THEN (substring(t.duracion_estimada from '[0-9]+'))::integer
      WHEN lower(COALESCE(t.duracion_estimada,'')) ~ '^[[:space:]]*[0-9]+[[:space:]]*(h|hora|horas)[[:space:]]*$'
        THEN (substring(t.duracion_estimada from '[0-9]+'))::integer * 60
      ELSE 30
    END)))::integer AS minutos
   FROM cita_tratamiento ct JOIN tratamiento t ON t.id_tratamiento=ct.id_tratamiento
   GROUP BY ct.id_cita
  ) sub WHERE c.id_cita=sub.id_cita;
 END IF;
END $$;
ALTER TABLE cita DROP CONSTRAINT IF EXISTS cita_duracion_minutos_rango;
ALTER TABLE cita ADD CONSTRAINT cita_duracion_minutos_rango CHECK (duracion_minutos BETWEEN 5 AND 480);
CREATE INDEX IF NOT EXISTS ix_cita_fecha_agenda ON cita(fecha);
COMMIT;
