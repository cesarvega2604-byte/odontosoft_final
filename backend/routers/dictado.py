from functools import lru_cache
from io import BytesIO
import json
import logging
import os
from pathlib import Path
import wave

from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from access import Principal, current_user, require_role
from carga_binaria import leer_con_limite

router = APIRouter(prefix="/dictado", tags=["Dictado"])
logger = logging.getLogger(__name__)
MAX_SEGUNDOS = 60
TASA_MAX = 48000


@lru_cache(maxsize=1)
def modelo_espanol():
    from vosk import Model, SetLogLevel

    SetLogLevel(-1)
    ruta = Path(os.getenv("ODONTO_DICTADO_MODELO") or
                Path(__file__).resolve().parents[1] / "modelos" / "vosk-model-small-es-0.42")
    return Model(str(ruta))


def transcribir(contenido):
    try:
        with wave.open(BytesIO(contenido), "rb") as audio:
            tasa = audio.getframerate()
            cuadros = audio.getnframes()
            if (audio.getnchannels() != 1 or audio.getsampwidth() != 2 or not 16000 <= tasa <= TASA_MAX
                    or not 0 < cuadros <= tasa * MAX_SEGUNDOS):
                raise HTTPException(422, "La grabación debe ser WAV mono de hasta 60 segundos")
            muestras = audio.readframes(cuadros)
            if len(muestras) != cuadros * 2:
                raise HTTPException(422, "La grabación está incompleta")
    except (wave.Error, EOFError, ValueError):
        raise HTTPException(422, "El audio no se pudo leer") from None

    try:
        from vosk import KaldiRecognizer

        recognizer = KaldiRecognizer(modelo_espanol(), tasa)
    except Exception as error:
        logger.warning("Dictado local no disponible (%s)", type(error).__name__)
        raise HTTPException(503, "El modelo de dictado en español no está disponible") from None

    fragmentos = []
    for inicio in range(0, len(muestras), 8000):
        if recognizer.AcceptWaveform(muestras[inicio:inicio + 8000]):
            fragmentos.append(json.loads(recognizer.Result()).get("text"))
    fragmentos.append(json.loads(recognizer.FinalResult()).get("text"))
    return " ".join(filter(None, fragmentos))


@router.post("/transcribir")
async def dictar(request: Request, principal: Principal = Depends(current_user)):
    require_role(principal, "Administrador", "Odontologo")
    audio = await leer_con_limite(request, MAX_SEGUNDOS * TASA_MAX * 2 + 1024)
    return {"texto": await run_in_threadpool(transcribir, audio)}
