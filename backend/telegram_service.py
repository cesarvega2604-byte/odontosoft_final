import os
import httpx
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

async def enviar_mensaje_telegram(mensaje: str, chat_id: str = None) -> bool:
    """Envía un mensaje formateado a Telegram mediante el Bot API."""
    destinatario = chat_id or TELEGRAM_CHAT_ID
    
    if not TELEGRAM_BOT_TOKEN or not destinatario:
        logger.error("❌ Faltan credenciales de Telegram (BOT_TOKEN o CHAT_ID)")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": destinatario,
        "text": mensaje,
        "parse_mode": "HTML"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            data = response.json()
            
            if response.status_code == 200 and data.get("ok"):
                logger.info("Notificación de Telegram enviada")
                return True
            else:
                logger.error("El servicio de Telegram devolvió un error HTTP %d", response.status_code)
                return False
    except Exception as e:
        logger.error("Fallo al conectar con Telegram (%s)", type(e).__name__)
        return False


async def notificar_confirmacion_cita_telegram(paciente_nombre: str, fecha: str, hora: str, odontologo_nombre: str, motivo: str, chat_id: str = None):
    """Construye y envía la plantilla de confirmación de cita a Telegram."""
    mensaje = (
        "<b>🦷 OdontoSoft — Cita Confirmada</b>\n\n"
        f"Hola <b>{paciente_nombre}</b>, tu cita ha sido registrada exitosamente. 👇\n\n"
        f"📅 <b>Fecha:</b> {fecha}\n"
        f"⏰ <b>Hora:</b> {hora}\n"
        f"👨‍⚕️ <b>Odontólogo:</b> {odontologo_nombre}\n"
        f"📋 <b>Motivo:</b> {motivo}\n\n"
        "📍 <i>Por favor llega 10 minutos antes de tu cita. ¡Te esperamos!</i>"
    )
    return await enviar_mensaje_telegram(mensaje, chat_id=chat_id)
