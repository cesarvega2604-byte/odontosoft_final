import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from time import perf_counter

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

import models
from access import PRODUCTION, WEB_ORIGINS
from database import engine
from middleware.error_handler import route_template, setup_error_handlers
from correos_programados import procesar_correos

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").disabled = True
logger = logging.getLogger(__name__)


class SafeServerErrors(logging.Filter):
    """Keep ASGI tracebacks and request data out of the server log."""

    def filter(self, record):
        if record.exc_info:
            exception_type = record.exc_info[0].__name__
            record.msg = "Error del servidor ASGI (%s)"
            record.args = (exception_type,)
            record.exc_info = None
            record.exc_text = None
        return True


for name in ("uvicorn.error", "asyncio", "apscheduler.executors.default"):
    logging.getLogger(name).addFilter(SafeServerErrors())


def verify_schema():
    try:
        if PRODUCTION:
            with engine.connect() as connection:
                (protected_audit, blocks_ready, catalogo_correos_ready, encuestas_ready,
                 identificacion_ready, facturacion_ready, adjuntos_ready) = connection.execute(text("""
                    SELECT EXISTS (
                        SELECT 1 FROM pg_trigger
                        WHERE tgrelid = to_regclass('public.auditoria_clinica')
                          AND tgname = 'auditoria_clinica_solo_inserciones' AND tgenabled IN ('O', 'A')
                    ), to_regclass('public.bloqueo_agenda') IS NOT NULL,
                       to_regclass('public.producto') IS NOT NULL AND to_regclass('public.correo_programado') IS NOT NULL,
                       to_regclass('public.encuesta_cita') IS NOT NULL,
                       EXISTS (
                           SELECT 1 FROM pg_attribute
                           WHERE attrelid = to_regclass('public.paciente') AND attname = 'tipo_documento' AND NOT attisdropped
                       ) AND EXISTS (
                           SELECT 1 FROM pg_attribute
                           WHERE attrelid = to_regclass('public.correo_programado') AND attname = 'ultimo_envio' AND NOT attisdropped
                       ), to_regclass('public.fase_tratamiento') IS NOT NULL
                          AND to_regclass('public.compra_servicio') IS NOT NULL AND EXISTS (
                           SELECT 1 FROM pg_attribute
                           WHERE attrelid = to_regclass('public.correo_programado') AND attname = 'id_factura' AND NOT attisdropped
                       ), to_regclass('public.adjunto_clinico') IS NOT NULL
                """)).one()
        else:
            models.Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.error("No se pudo verificar el esquema (%s)", type(exc).__name__)
        raise RuntimeError("No se pudo verificar el esquema de OdontoSoft") from None
    if PRODUCTION and not protected_audit:
        raise RuntimeError("Falta la migración de auditoría clínica")
    if PRODUCTION and not blocks_ready:
        raise RuntimeError("Falta la migración de bloqueos de agenda")
    if PRODUCTION and not catalogo_correos_ready:
        raise RuntimeError("Falta la migración de catálogo y correos")
    if PRODUCTION and not encuestas_ready:
        raise RuntimeError("Falta la migración de encuestas")
    if PRODUCTION and not identificacion_ready:
        raise RuntimeError("Falta la migración de identificación y cumpleaños")
    if PRODUCTION and not facturacion_ready:
        raise RuntimeError("Falta la migración de Mi tratamiento y Facturación")
    if PRODUCTION and not adjuntos_ready:
        raise RuntimeError("Falta la migración de adjuntos clínicos")


verify_schema()
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(procesar_correos, "interval", seconds=30, max_instances=1,
                      next_run_time=datetime.now(timezone.utc))
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown()


app = FastAPI(
    title="OdontoSoft API",
    description="Sistema de Gestión Odontológica — Backend REST con FastAPI + PostgreSQL",
    version="2.0.0",
    debug=False,
    docs_url=None if PRODUCTION else "/docs",
    redoc_url=None if PRODUCTION else "/redoc",
    openapi_url=None if PRODUCTION else "/openapi.json",
    lifespan=lifespan,
)
setup_error_handlers(app)


@app.middleware("http")
async def safe_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        logger.error("Error no controlado en %s (%s)", route_template(request), type(exc).__name__)
        return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=WEB_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Nombre-Archivo"],
    expose_headers=["X-Process-Time"],
)


@app.middleware("http")
async def secure_http(request: Request, call_next):
    start = perf_counter()
    if PRODUCTION and request.url.scheme != "https":
        response = JSONResponse(status_code=400, content={"detail": "La API requiere HTTPS"})
    else:
        response = await call_next(request)

    elapsed = perf_counter() - start
    logger.info("HTTP %s %s %.3fs", route_template(request), response.status_code, elapsed)
    response.headers["X-Process-Time"] = f"{elapsed:.6f}"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    if PRODUCTION and request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


from routers import (
    adjuntos_clinicos,
    auth,
    usuarios,
    pacientes,
    odontologos,
    consultorios,
    historias_clinicas,
    citas,
    productos,
    encuestas,
    bloqueos_agenda,
    tratamientos,
    recordatorios,
    pagos,
    facturas,
    compras_servicio,
    dictado,
    planes_tratamiento,
    roles,
    proveedores,
    servicios,
    historias_clinicas_detalladas,
    odontogramas,
    password_reset
)


# Registrar todos los routers

app.include_router(auth.router)
app.include_router(adjuntos_clinicos.router)
app.include_router(dictado.router)
app.include_router(usuarios.router)
app.include_router(pacientes.router)
app.include_router(odontologos.router)
app.include_router(consultorios.router)
app.include_router(historias_clinicas.router)
app.include_router(citas.router)
app.include_router(productos.router)
app.include_router(encuestas.router)
app.include_router(bloqueos_agenda.router)
app.include_router(tratamientos.router)
app.include_router(recordatorios.router)
app.include_router(pagos.router)
app.include_router(facturas.router)
app.include_router(compras_servicio.router)
app.include_router(planes_tratamiento.router)
app.include_router(roles.router)
app.include_router(proveedores.router)
app.include_router(servicios.router)
app.include_router(historias_clinicas_detalladas.router)
app.include_router(odontogramas.router)
app.include_router(password_reset.router)

logger.info("✅ Todos los routers registrados correctamente")


# ── Endpoint raíz ──────────────────────────────────────────────────────────

@app.get("/", tags=["Root"])
async def root():
    """Endpoint de bienvenida de la API"""

    return {
        "sistema": "OdontoSoft API",
        "version": "2.0.0",
        "documentacion": app.docs_url,
        "documentacion_alternativa": app.redoc_url,
        "estado": "Activo",
        "base_datos": "PostgreSQL - ProyectoApi",
        "timestamp": datetime.now().isoformat()
    }


# ── Endpoint de salud (health check) ──────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    """Verificar el estado de la API y conexión a la base de datos"""

    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "api": "running",
            "database": "unknown"
        }
    }

    try:

        from database import SessionLocal

        with SessionLocal() as db:
            db.execute(text("SELECT 1"))

        health_status["services"]["database"] = "connected"
        health_status["database"] = "connected"

        return health_status

    except Exception as e:

        logger.error("Fallo de verificación de base de datos (%s)", type(e).__name__)

        health_status["status"] = "unhealthy"
        health_status["services"]["database"] = "disconnected"
        health_status["database"] = "disconnected"

        return JSONResponse(
            status_code=503,
            content=health_status
        )


# ── Endpoint de información del sistema ──────────────────────────────────

@app.get("/info", tags=["Info"])
async def system_info():
    """Obtener información del sistema"""

    return {
        "sistema": "OdontoSoft",
        "version": "2.0.0",
        "framework": "FastAPI",
        "base_datos": "PostgreSQL",
        "ambiente": "producción" if PRODUCTION else "desarrollo",
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn

    if PRODUCTION:
        raise SystemExit("Inicia producción con el comando HTTPS de la guía de despliegue")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True, access_log=False)
