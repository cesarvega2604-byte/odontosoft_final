-- OdontoSoft: tablas adicionales para el panel del odontólogo
-- No elimina ni modifica las tablas existentes.

CREATE TABLE IF NOT EXISTS historia_clinica_detallada (
    id_historia_detallada SERIAL PRIMARY KEY,
    id_paciente INTEGER NOT NULL UNIQUE,
    datos_clinicos JSON NOT NULL DEFAULT '{}'::json,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_historia_detallada_paciente
        FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS odontograma (
    id_odontograma SERIAL PRIMARY KEY,
    id_paciente INTEGER NOT NULL UNIQUE,
    dientes JSON NOT NULL DEFAULT '{}'::json,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_odontograma_paciente
        FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente) ON DELETE CASCADE
);
