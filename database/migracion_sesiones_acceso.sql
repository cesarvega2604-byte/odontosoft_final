-- Sesiones de servidor para instalaciones existentes de OdontoSoft.
BEGIN;

CREATE TABLE IF NOT EXISTS sesion_acceso (
    token_hash VARCHAR(64) PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    usuario_version VARCHAR(64) NOT NULL,
    expira TIMESTAMP WITH TIME ZONE NOT NULL,
    canal VARCHAR(16) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sesion_acceso_id_usuario ON sesion_acceso (id_usuario);

COMMIT;
