import logging
import os
from html import escape
from io import BytesIO
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from dotenv import load_dotenv
from access import PRODUCTION, WEB_ORIGINS
from starlette.datastructures import Headers, UploadFile

load_dotenv()
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv(
    "FRONTEND_URL", WEB_ORIGINS[0] if PRODUCTION else "http://127.0.0.1:5173",
).rstrip("/")
if PRODUCTION and FRONTEND_URL not in WEB_ORIGINS:
    raise ValueError("FRONTEND_URL debe ser un origen web autorizado")


def mail_config():
    server = os.getenv("MAIL_SERVER", "smtp.gmail.com").strip()
    port = int(os.getenv("MAIL_PORT", 587))
    password = os.getenv("MAIL_PASSWORD", "")
    if server.lower() == "smtp.gmail.com":
        password = "".join(password.split())
    return ConnectionConfig(
        MAIL_USERNAME=os.getenv("MAIL_USERNAME", "").strip(),
        MAIL_PASSWORD=password,
        MAIL_FROM=os.getenv("MAIL_FROM", "").strip(),
        MAIL_PORT=port,
        MAIL_SERVER=server,
        MAIL_STARTTLS=port != 465,
        MAIL_SSL_TLS=port == 465,
        MAIL_FROM_NAME="OdontoSoft",
        USE_CREDENTIALS=True,
        TIMEOUT=10,
    )


class NotificationService:

    @staticmethod
    def configurado():
        return all(os.getenv(key, "").strip() for key in ("MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_FROM"))

    @staticmethod
    async def send_email(email_to: str, subject: str, body_html: str, *, pdf: tuple[str, bytes] | None = None):
        """Envía un correo electrónico en formato HTML en segundo plano."""
        try:
            attachments = []
            if pdf:
                nombre, contenido = pdf
                attachments.append(UploadFile(
                    BytesIO(contenido), filename=nombre, headers=Headers({"content-type": "application/pdf"}),
                ))
            message = MessageSchema(
                subject=subject, recipients=[email_to], body=body_html, subtype=MessageType.html,
                attachments=attachments,
            )
            await FastMail(mail_config()).send_message(message)
            return True
        except Exception as error:
            cause = error.__cause__ or error.__context__ or error
            logger.warning("Correo SMTP no entregado (%s, código %s)",
                           type(cause).__name__, getattr(cause, "code", None) or "-")
            return False

    

    @staticmethod
    async def enviar_reset_password(
        email_destino: str,
        nombre_usuario: str,
        token: str
    ) -> bool:
        """Envía el correo con el enlace para restablecer la contraseña."""

        reset_link = escape(f"{FRONTEND_URL}/reset-password.html#token={token}", quote=True)

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; background: #ffffff; margin: 0 auto; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
            .header {{ background-color: #2c7be5; color: white; text-align: center; padding: 20px; }}
            .content {{ padding: 30px; color: #333333; line-height: 1.6; }}
            .btn {{ display: inline-block; background-color: #2c7be5; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 20px 0; }}
            .footer {{ background-color: #f4f6f9; text-align: center; padding: 15px; font-size: 12px; color: #777777; }}
            .aviso {{ font-size: 13px; color: #999999; margin-top: 20px; }}
        </style>
        </head>
        <body>
        <div class="container">
            <div class="header">
                <h2>🔐 Restablecer tu contraseña</h2>
            </div>
            <div class="content">
                <p>Hola <strong>{escape(nombre_usuario)}</strong>,</p>
                <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en OdontoSoft.</p>
                <p style="text-align:center;">
                    <a class="btn" href="{reset_link}">Restablecer contraseña</a>
                </p>
                <p class="aviso">Este enlace expira en 15 minutos y solo puede usarse una vez. Si no solicitaste el cambio, puedes ignorar el correo.</p>
            </div>
            <div class="footer">
                <p>OdontoSoft - Sistema de Gestión Odontológica</p>
            </div>
        </div>
        </body>
        </html>
        """

        return await NotificationService.send_email(
            email_destino, "🔐 Restablece tu contraseña de OdontoSoft", html_content,
        )
