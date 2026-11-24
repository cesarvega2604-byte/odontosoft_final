import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

def probar_correo():
    username = os.getenv("MAIL_USERNAME")
    password = os.getenv("MAIL_PASSWORD")
    server_host = os.getenv("MAIL_SERVER")
    port = int(os.getenv("MAIL_PORT", 587))
    mail_from = os.getenv("MAIL_FROM")

    print(f"Probando conexion con: {username} via {server_host}:{port}")

    msg = EmailMessage()
    msg['Subject'] = "Prueba OdontoSoft"
    msg['From'] = mail_from
    msg['To'] = username  # Te lo envías a ti mismo para probar
    msg.set_content("Prueba de envío directa desde Python.")

    try:
        server = smtplib.SMTP(server_host, port)
        server.starttls()
        server.login(username, password)
        server.send_message(msg)
        server.quit()
        print("✅ CORREO ENVIADO CON ÉXITO")
    except Exception as e:
        print(f"❌ ERROR AL ENVIAR CORREO: {e}")

if __name__ == "__main__":
    probar_correo()