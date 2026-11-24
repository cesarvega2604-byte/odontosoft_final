import asyncio
from telegram_service import enviar_mensaje_telegram

async def main():
    mensaje = (
        "<b>🦷 OdontoSoft Notificaciones</b>\n\n"
        "¡Hola Cesar! 👋\n"
        "La integración con Telegram está funcionando correctamente. 🚀"
    )
    print("Enviando mensaje de prueba...")
    exito = await enviar_mensaje_telegram(mensaje)
    if exito:
        print("¡Mensaje enviado con éxito! Revisa tu Telegram.")
    else:
        print("Error al enviar el mensaje. Revisa los logs.")

if __name__ == "__main__":
    asyncio.run(main())