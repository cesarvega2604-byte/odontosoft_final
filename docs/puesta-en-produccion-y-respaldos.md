# HTTPS, auditoría clínica y copias de PostgreSQL

## Activar en un entorno desplegado

1. Crea un respaldo y comprueba su restauración antes de actualizar una base existente. Aplica las migraciones de agenda, sesiones, contraseñas, [auditoría clínica](../database/migracion_auditoria_clinica.sql) y [bloqueos de agenda](../database/migracion_bloqueos_agenda.sql) según las versiones que falten. Usa el propietario del esquema para las migraciones y un usuario de PostgreSQL de servicio para FastAPI. El proyecto incluye [una base de demostración](../database/README.md) con registros ficticios.
2. Configura la API con `ODONTO_ENV=production`, los orígenes web reales en `ODONTO_WEB_ORIGINS` y los cinco valores `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` y `DB_NAME`. Usa URLs de origen como `https://app.ejemplo.com` sin rutas ni comodines. Si hay varios, sepáralos con comas. Configura `FRONTEND_URL` con el origen web que corresponda a los correos de restablecimiento. Registra las credenciales en la configuración privada del servicio.
3. Apunta los nombres DNS de la web y de la API al proxy. Usa subdominios del mismo sitio HTTPS para que funcione la cookie `SameSite=Strict`. Abre los puertos públicos 80 y 443 para el proxy y mantén el puerto 8000 en la interfaz local. Caddy gestiona el certificado público HTTPS y su renovación. [Documentación de HTTPS automático](https://caddyserver.com/docs/automatic-https)

Ejemplo en PowerShell desde la raíz, con los dominios de ejemplo reemplazados por los propios.

```powershell
$env:ODONTO_WEB_HOST = 'app.ejemplo.com'
$env:ODONTO_API_HOST = 'api.ejemplo.com'
$env:ODONTO_ENV = 'production'
$env:ODONTO_WEB_ORIGINS = "https://$($env:ODONTO_WEB_HOST)"
$env:FRONTEND_URL = $env:ODONTO_WEB_ORIGINS
$env:ODONTO_API_ORIGIN = "https://$($env:ODONTO_API_HOST)"
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run build
$env:ODONTO_WEB_ROOT = (Resolve-Path frontend/dist).Path.Replace('\','/')
```

Ejecuta FastAPI y Caddy como servicios independientes con sus variables de entorno. La configuración de ejemplo confía en las cabeceras del proxy que llega desde `127.0.0.1`. Usa una instancia de FastAPI para ejecutar una sola vez el programador de recordatorios. [Configuración de Uvicorn](https://uvicorn.dev/settings/#http) · [Cabeceras de Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#headers)

```powershell
python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips 127.0.0.1 --no-access-log
caddy validate --config Caddyfile.odonto --adapter caddyfile
caddy run --config Caddyfile.odonto --adapter caddyfile
```

Comprueba desde el navegador que HTTP redirige a HTTPS en ambos dominios, que la web puede iniciar sesión, que `/health` responde correctamente en la API y que el navegador recibe una cookie `Secure`, `HttpOnly` y `SameSite=Strict`. La API permite CORS únicamente para los orígenes configurados, desactiva la documentación interactiva en producción y usa `Cache-Control: no-store` en sus respuestas.

## Configurar los correos automáticos

En una base existente, ejecuta la [migración de catálogo y correos](../database/migracion_catalogo_y_correos.sql) antes de iniciar esta versión. Se reutiliza la configuración SMTP del backend con `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` y `MAIL_FROM`. Guarda los valores en la configuración privada del servidor.

La cola programa la bienvenida al crear una cuenta, una confirmación al agendar y recordatorios 24 horas y una hora antes, siempre que quede ese tiempo al reservar. Los cambios de horario reemplazan los avisos pendientes. Las cancelaciones y las citas vencidas dejan de generar avisos. La API comprueba los envíos pendientes cada 30 segundos y guarda el resultado en PostgreSQL. Si usas el lanzador de escritorio, el equipo y el servidor local deben estar activos al momento del envío.

Aplica también la [migración de encuestas](../database/migracion_encuestas.sql). Cuando el odontólogo finaliza una cita, la misma cola envía una invitación personal de un solo uso que vence en 14 días. Para que los pacientes puedan abrirla desde su propio teléfono o PC, despliega la web en una dirección HTTPS pública y usa ese origen como `FRONTEND_URL` del servidor. En escritorio, los enlaces de ensayo se abren en el equipo que ejecuta OdontoSoft.

Aplica la [migración de identificación y cumpleaños](../database/migracion_identificacion_cumpleanos.sql). Los saludos se envían al correo de la cuenta desde las 9:00 a. m. de Colombia hasta la medianoche del cumpleaños, mientras el backend y el SMTP estén disponibles. Para fechas del 29 de febrero se usa el 28 en años no bisiestos.

## Consultar la auditoría clínica

La tabla `auditoria_clinica` registra el momento, el usuario autenticado, el paciente, el recurso, el registro y el resultado. Abarca las consultas de historias y odontogramas existentes, las altas, las modificaciones, los borrados y las denegaciones autenticadas en las rutas que identifican al paciente. El PDF se genera en el navegador con la historia disponible en la sesión. Los eventos contienen identificadores internos y deben quedar bajo acceso restringido.

Con el rol de auditoría autorizado, puedes revisar los eventos de un paciente por su identificador interno. Usa `SET TIME ZONE 'UTC'` si necesitas exportar horas en UTC.

```sql
SELECT fecha, id_usuario, id_paciente, recurso, id_registro, operacion, resultado
FROM auditoria_clinica
WHERE id_paciente = 123
ORDER BY fecha DESC, id_evento DESC
LIMIT 100;
```

El disparador de PostgreSQL bloquea `UPDATE`, `DELETE` y `TRUNCATE`. Separa al propietario de la tabla, al usuario de la aplicación y al rol que consulta auditoría. Para esta tabla, el usuario de aplicación necesita `INSERT`, permiso para los campos devueltos por la inserción (`SELECT (id_evento, fecha)`) y acceso a la secuencia si corresponde. Evita concederle permisos mediante un rol que sea dueño del esquema. Mantén las alertas técnicas y el monitoreo del proxy sin URLs completas, cabeceras de sesión ni fragmentos de expedientes.

En el servidor PostgreSQL, restringe el acceso a los logs y suprime el registro de sentencias y parámetros clínicos. Revisa `log_statement`, `log_min_error_statement`, `log_min_duration_statement`, `log_parameter_max_length`, `log_parameter_max_length_on_error` y `log_error_verbosity` en la configuración de la instancia. [Configuración de logs de PostgreSQL](https://www.postgresql.org/docs/current/runtime-config-logging.html)

## Crear y ensayar una copia

Usa, en una carpeta cifrada y con permisos restringidos fuera del sitio web, el formato de archivo de PostgreSQL. Puedes autenticarte con `PGPASSFILE` o el archivo de contraseñas de PostgreSQL protegido por el sistema operativo. Guarda el valor SHA-256 que muestra el comando en el registro protegido de respaldos, separado de la copia. [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)

```powershell
$tools = 'C:\Program Files\PostgreSQL\18\bin'
.\database\respaldo.ps1 -BinPostgreSQL $tools -Servidor 127.0.0.1 -Usuario respaldos -BaseOrigen odontosoft -Archivo 'D:\RespaldoSeguro\odontosoft.dump'
```

Desde una instancia PostgreSQL aislada, con permiso para crear una base de ensayo, verifica la huella y restaura en una base nueva. El nombre de destino empieza por `odontosoft_restore_`. La restauración transaccional verifica las claves foráneas principales, comprueba el disparador cuando la copia incluye auditoría y devuelve los conteos de cada tabla. Para promover una restauración, vuelve a aplicar los permisos de la instalación y verifica el acceso desde la aplicación. [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)

```powershell
.\database\respaldo.ps1 -BinPostgreSQL $tools -Servidor 127.0.0.1 -Usuario restauracion -BaseOrigen odontosoft -Archivo 'D:\RespaldoSeguro\odontosoft.dump' -BaseDestino odontosoft_restore_ensayo -Sha256 '<huella guardada>'
```

Revisa una muestra de expedientes, odontogramas y citas asociadas al mismo paciente en la base restaurada. Programa las copias y los ensayos de restauración en el servidor con una frecuencia que refleje cuánto trabajo se puede perder. Documenta cuándo se hizo cada prueba, qué tablas y vínculos se comprobaron y cuánto tardó la recuperación.

## Repetir la prueba con datos ficticios

Para la prueba web se necesita Edge o Chromium, Node con `fetch` y `WebSocket`, el entorno Python del proyecto con `cryptography`, y una base vacía `odontosoft_access_test_*` en una instancia PostgreSQL de prueba local. La API de ensayo crea el esquema y genera un certificado temporal de uso local. Usa una base y una carpeta nuevas en cada ejecución.

```powershell
$env:ODONTO_TEST_DB_URL = 'postgresql+psycopg2://postgres@127.0.0.1:56483/odontosoft_access_test_clinica'
$qa = New-Item -ItemType Directory -Path (Join-Path ([IO.Path]::GetTempPath()) ('odontosoft-clinica-' + [guid]::NewGuid()))
Write-Host $qa.FullName
python backend/tests/serve_browser.py $qa.FullName
```

En otra terminal, indica la ruta que creó la primera terminal y la ruta local del navegador. La prueba activa dos sesiones para competir por el mismo horario y opera el flujo clínico desde la interfaz. Guarda `historia-ficticia.pdf` en la carpeta de prueba para abrirlo después.

```powershell
$env:ODONTO_TEST_TLS_DIR = 'C:\ruta\a\odontosoft-clinica-...'
$env:NODE_EXTRA_CA_CERTS = Join-Path $env:ODONTO_TEST_TLS_DIR 'cert.pem'
$env:ODONTO_API_ORIGIN = 'https://127.0.0.1:56484'
npm.cmd --prefix frontend run build
node frontend/verify-parity.mjs 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' --live-clinic
```
