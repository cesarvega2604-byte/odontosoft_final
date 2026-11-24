from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# CONFIGURACIÓN DE POSTGRESQL
# ─────────────────────────────────────────────

if os.getenv("ODONTO_ENV", "development").strip().lower() == "production":
    required_settings = ("DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT", "DB_NAME")
    if any(not os.getenv(name) for name in required_settings):
        raise RuntimeError("Configura explícitamente la conexión de producción (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT y DB_NAME)")

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "1234")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "BASE_DE_DATOS_FINAL")

DATABASE_URL = URL.create(
    "postgresql+psycopg2", username=DB_USER, password=DB_PASSWORD,
    host=DB_HOST, port=int(DB_PORT), database=DB_NAME,
)


# ─────────────────────────────────────────────
# CONEXIÓN A LA BASE DE DATOS
# ─────────────────────────────────────────────

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
    hide_parameters=True,
    connect_args={
        "connect_timeout": 5
    }
)


# ─────────────────────────────────────────────
# SESIONES
# ─────────────────────────────────────────────

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# ─────────────────────────────────────────────
# BASE PARA LOS MODELOS
# ─────────────────────────────────────────────

Base = declarative_base()


# ─────────────────────────────────────────────
# DEPENDENCIA DE BASE DE DATOS
# ─────────────────────────────────────────────

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
