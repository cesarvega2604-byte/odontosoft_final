from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException

import logging

logger = logging.getLogger(__name__)


def route_template(request: Request):
    return getattr(request.scope.get("route"), "path", "(sin ruta)")


def setup_error_handlers(app: FastAPI):
    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"detail": "Error de validación de datos"})

    @app.exception_handler(IntegrityError)
    async def integrity_error(request: Request, exc: IntegrityError):
        constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None) or ""
        code = getattr(exc.orig, "pgcode", None)
        if code == "23505":
            match = next((key for key in ("correo", "documento", "usuario_paciente") if key in constraint), None)
            detail, error = {
                "correo": ("El correo electrónico ya está registrado", "duplicate_email"),
                "documento": ("El documento ya está registrado", "duplicate_document"),
                "usuario_paciente": ("La relación usuario-paciente ya existe", "duplicate_relation"),
            }.get(match, ("El registro ya existe en la base de datos", "duplicate_entry"))
        elif code == "23503":
            detail, error = "El registro está siendo referenciado por otros datos", "foreign_key_violation"
        else:
            detail, error = "Conflicto con los datos existentes", "integrity_conflict"
        return JSONResponse(status_code=409, content={"detail": detail, "error": error})

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_error(request: Request, exc: SQLAlchemyError):
        logger.error("Error de base de datos en %s (%s)", route_template(request), type(exc).__name__)
        return JSONResponse(status_code=500, content={"detail": "Error en la base de datos"})

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            headers=exc.headers,
            content={"detail": exc.detail if exc.status_code < 500 else "Error interno del servidor"},
        )

