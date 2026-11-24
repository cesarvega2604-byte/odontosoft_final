# Actualizar el almacenamiento de contraseñas

OdontoSoft guarda las contraseñas nuevas con Argon2id y una sal aleatoria por cuenta. El registro, la edición administrativa y la recuperación aceptan entre 8 y 128 caracteres y recomiendan usar 15 o más. Los espacios dentro de una contraseña se conservan.

## Actualizar una instalación existente

1. Comprueba que tienes una cuenta administrativa disponible y un método operativo de recuperación. Para usar recuperación por correo, configura el envío SMTP y la URL de la web en `FRONTEND_URL`.
2. Detén FastAPI. Guarda el respaldo de PostgreSQL cifrado y con acceso restringido. Los respaldos anteriores pueden incluir datos clínicos y credenciales históricas.
3. Instala las dependencias del backend. En Windows, desde la raíz del proyecto:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
   ```

4. En pgAdmin, abre **Query Tool** sobre la base de OdontoSoft que quieras actualizar. Si aún falta la [migración de sesiones](../database/migracion_sesiones_acceso.sql), ejecútala primero. Ejecuta completo el [script de migración de contraseñas](../database/migracion_contrasenas_argon2id.sql). La consulta final muestra cuántas cuentas requieren restablecimiento.
5. Reinicia FastAPI y React con el código actualizado. En **Usuarios**, busca las cuentas con la indicación **Restablecimiento pendiente** y comunica a sus titulares que usen **¿Olvidaste tu contraseña?**. Si el correo no está disponible, un administrador activo puede reemplazar la contraseña desde **Editar usuario** tras verificar la identidad del titular.

La migración conserva las cuentas y las fichas, elimina del esquema la columna que guardaba contraseñas en texto plano y cierra las sesiones de las cuentas marcadas. Esas cuentas deben elegir una contraseña distinta. Los titulares de las demás cuentas pueden seguir iniciando sesión con su contraseña actual. El hash SHA-256 se reemplaza por Argon2id después de un inicio válido. Solicita un enlace nuevo si se emitió antes de la actualización.

Para instalaciones nuevas, [odontosoft_demo.sql](../database/odontosoft_demo.sql) ya incluye el esquema actualizado y seis hashes Argon2id independientes para las cuentas ficticias.

## Verificar

Después de aplicar la migración en una copia de prueba, valida tres casos: inicio con una cuenta heredada, solicitud y uso de un enlace de recuperación, y cierre de las sesiones anteriores al cambiar una contraseña. Ejecuta también `python -X utf8 backend/tests/test_access.py` desde un entorno con las dependencias instaladas. Las pruebas automatizadas capturan el mensaje de recuperación en memoria. Para confirmar la entrega por correo en tu instalación, solicita un enlace con una cuenta de prueba y verifica que llegue a su bandeja.

[Almacenamiento de contraseñas según OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · [Recuperación de contraseñas según OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
