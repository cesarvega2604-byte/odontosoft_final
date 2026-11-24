"""Inicia la aplicación local de OdontoSoft desde el acceso directo de Windows."""

from contextlib import contextmanager
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
from time import monotonic, sleep
from urllib.request import HTTPRedirectHandler, ProxyHandler, build_opener
import webbrowser


RAIZ = Path(__file__).resolve().parents[1]
FRONTEND = RAIZ / "frontend"
WEB = FRONTEND / "dist-desktop"
BACKEND = RAIZ / "backend"
HOST, PUERTO = "127.0.0.1", 8765
ORIGEN = f"http://{HOST}:{PUERTO}"
ESTADO = "/_odontosoft_escritorio"
INSTANCIA = hashlib.sha256(os.fsencode(RAIZ)).hexdigest()


class SinRedireccion(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def revision_de(archivos):
    revision = hashlib.sha256()
    for archivo in sorted(archivos):
        revision.update(os.fsencode(archivo.relative_to(RAIZ)))
        revision.update(b"\0")
        revision.update(hashlib.sha256(archivo.read_bytes()).digest())
    return revision.hexdigest()


def revision_backend():
    modulos = (archivo for archivo in BACKEND.glob("*.py") if not archivo.name.startswith("test_"))
    return revision_de([*modulos, *(BACKEND / "routers").rglob("*.py"), *(BACKEND / "middleware").rglob("*.py")])


@contextmanager
def apertura_exclusiva():
    WEB.mkdir(parents=True, exist_ok=True)
    with (WEB / ".apertura.lock").open("ab") as archivo:
        archivo.seek(0)
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(archivo.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(archivo, fcntl.LOCK_EX)
        yield


def preparar_web():
    fuentes = [
        RAIZ / "OdontoSoft.ico",
        *(FRONTEND / name for name in ("index.html", "build.mjs", "package.json", "package-lock.json")),
        *(archivo for carpeta in ("src", "css", "assets") for archivo in (FRONTEND / carpeta).rglob("*") if archivo.is_file()),
    ]
    revision = revision_de(fuentes)
    sello = WEB / ".revision-react"
    if (sello.is_file() and sello.read_text(encoding="ascii") == revision
            and (WEB / "index.html").is_file() and (WEB / "react" / "app.js").is_file()):
        return
    node = shutil.which("node")
    if not node or not (FRONTEND / "node_modules" / "esbuild").is_dir():
        raise RuntimeError("Instala Node.js y ejecuta npm.cmd --prefix frontend ci una vez para preparar React.")
    resultado = subprocess.run(
        [node, str(FRONTEND / "build.mjs"), "--desktop"], cwd=FRONTEND,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, encoding="utf-8", errors="replace",
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    if resultado.returncode:
        raise RuntimeError("No se pudo compilar la interfaz de OdontoSoft.\n" + resultado.stdout.strip()[-1200:])
    sello.write_text(revision, encoding="ascii")


def solicitud_reinicio(pid, revision):
    return WEB / f".reiniciar-{pid}-{revision}"


def construir_app(revision):
    os.environ.update(
        ODONTO_ENV="development",
        ODONTO_DESKTOP_MODE="1",
        ODONTO_WEB_ORIGINS=ORIGEN,
        FRONTEND_URL=ORIGEN,
    )
    from contextlib import asynccontextmanager
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles
    from starlette.middleware.trustedhost import TrustedHostMiddleware
    from main import app as api, health_check, lifespan as api_lifespan

    @asynccontextmanager
    async def lifespan(_app):
        async with api_lifespan(api):
            yield

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=[HOST])

    @app.get(ESTADO)
    async def estado():
        resultado = await health_check()
        return {"instancia": INSTANCIA, "listo": isinstance(resultado, dict), "pid": os.getpid(), "revision": revision}

    app.mount("/api", api)
    for ruta in ("assets", "css", "react"):
        app.mount("/" + ruta, StaticFiles(directory=WEB / ruta), name=ruta)

    @app.get("/favicon.ico", include_in_schema=False)
    def icono():
        return FileResponse(WEB / "favicon.ico", media_type="image/x-icon")

    @app.get("/{ruta:path}", include_in_schema=False)
    def pagina(ruta: str):
        if ruta.split("/", 1)[0] in {"api", "react", "css", "assets"}:
            raise HTTPException(404)
        return FileResponse(WEB / "index.html", headers={"Cache-Control": "no-cache"})

    return app


def servir():
    import uvicorn

    revision = revision_backend()
    solicitud = solicitud_reinicio(os.getpid(), revision)
    solicitud.unlink(missing_ok=True)

    class ServidorEscritorio(uvicorn.Server):
        async def on_tick(self, counter):
            if counter % 10 == 0 and solicitud.exists():
                return True
            return await super().on_tick(counter)

    # Reserva el puerto antes de inicializar FastAPI para que dos clics no inicien dos servidores.
    with socket.socket() as listener:
        if os.name == "nt":
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        listener.bind((HOST, PUERTO))
        listener.listen()
        config = uvicorn.Config(
            construir_app(revision), host=HOST, port=PUERTO, access_log=False, proxy_headers=False,
        )
        try:
            ServidorEscritorio(config).run(sockets=[listener])
        finally:
            solicitud.unlink(missing_ok=True)


def leer_estado():
    local = build_opener(ProxyHandler({}), SinRedireccion())
    try:
        with local.open(ORIGEN + ESTADO, timeout=1.5) as response:
            estado = json.load(response)
            return estado if isinstance(estado, dict) else None
    except (OSError, ValueError):
        return None


def puerto_ocupado():
    with socket.socket() as puerto:
        puerto.settimeout(0.2)
        return puerto.connect_ex((HOST, PUERTO)) == 0


def esperar_servidor():
    estado = leer_estado()
    if estado and estado.get("instancia") == INSTANCIA and estado.get("revision") != revision_backend():
        revision = estado.get("revision", "")
        pid = estado.get("pid")
        if (not isinstance(pid, int) or pid <= 0 or not isinstance(revision, str)
                or len(revision) != 64 or any(c not in "0123456789abcdef" for c in revision)):
            raise RuntimeError("Cierra tu sesión de Windows una vez para sustituir el servidor anterior de OdontoSoft.")
        solicitud_reinicio(pid, revision).touch()
        limite = monotonic() + 30
        while puerto_ocupado() and monotonic() < limite:
            sleep(0.2)
        if puerto_ocupado():
            raise RuntimeError("El servidor anterior de OdontoSoft todavía está cerrando. Vuelve a abrir el acceso directo.")
        estado = None

    if estado is None:
        python = Path(sys.executable)
        if python.name.lower() == "pythonw.exe":
            python = python.with_name("python.exe")
        proceso = subprocess.Popen(
            [str(python), str(Path(__file__).resolve()), "--servidor"],
            cwd=BACKEND, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        limite = monotonic() + 30
        while estado is None and monotonic() < limite:
            sleep(0.3)
            estado = leer_estado()
            if estado is None and proceso.poll() is not None and not puerto_ocupado():
                break

    if estado is None:
        raise RuntimeError("No se pudo iniciar OdontoSoft. Comprueba que PostgreSQL esté encendido, que la base esté configurada y que el puerto 8765 esté libre.")
    if estado.get("instancia") != INSTANCIA:
        raise RuntimeError("El puerto 8765 está ocupado por otra instalación. Cierra esa instalación antes de abrir esta.")
    if estado.get("listo") is not True:
        raise RuntimeError("OdontoSoft no puede conectarse a PostgreSQL. Inicia la base y vuelve a abrir el acceso directo.")
    return estado


def abrir_ventana():
    ruta = ORIGEN + "/login"
    edge = shutil.which("msedge")
    if not edge and os.name == "nt":
        for variable in ("ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"):
            carpeta = os.getenv(variable)
            if carpeta:
                candidato = Path(carpeta) / "Microsoft" / "Edge" / "Application" / "msedge.exe"
                if candidato.is_file():
                    edge = candidato
                    break
    if edge:
        subprocess.Popen([str(edge), "--app=" + ruta])
    elif not webbrowser.open(ruta):
        raise RuntimeError(f"Abre {ruta} en tu navegador para entrar a OdontoSoft.")


def main():
    if sys.argv[1:] == ["--servidor"]:
        servir()
        return 0

    comprobar = sys.argv[1:] == ["--comprobar"]
    try:
        with apertura_exclusiva():
            preparar_web()
            estado = esperar_servidor()
        if comprobar:
            print(f"OdontoSoft listo en {ORIGEN} (PID {estado['pid']}).")
        else:
            abrir_ventana()
        return 0
    except (OSError, RuntimeError) as exc:
        mensaje = str(exc) if isinstance(exc, RuntimeError) else "Windows no pudo iniciar OdontoSoft. Revisa la instalación local."
        if os.name == "nt" and not comprobar:
            ctypes.windll.user32.MessageBoxW(0, mensaje, "OdontoSoft", 0x10)
        else:
            print(mensaje, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
