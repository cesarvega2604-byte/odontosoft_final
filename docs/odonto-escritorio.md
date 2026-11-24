# OdontoSoft en el escritorio de Windows

El lanzador inicia FastAPI en segundo plano, comprueba PostgreSQL y abre OdontoSoft en una ventana de Microsoft Edge. Al abrir la aplicación, el lanzador compila React si cambió la interfaz o faltan los archivos compilados. Si hay un servidor activo con una versión anterior del código Python, lo reinicia antes de abrir la ventana.

## Preparar una vez

1. Instala Python, Node.js y PostgreSQL. El lanzador usa Edge si está instalado. En una instalación nueva crea **`odontosoft_ultimate`** y carga su script integral. Si ya usas **`odontosoft_demo`**, guarda una copia y ejecuta el script de actualización de tratamiento y facturación sobre esa base. [Guía de PostgreSQL](../database/README.md)
2. Conserva en `backend/.env` la configuración privada de PostgreSQL. Usa el nombre de la base que cargaste, el usuario, la contraseña, el host y el puerto de tu instalación. Puedes cerrar pgAdmin cuando termines.
3. Abre PowerShell en la carpeta principal de OdontoSoft, donde está `Iniciar OdontoSoft.cmd`. Ejecuta estos comandos para preparar el entorno. Si ya tienes la carpeta `.venv` con las dependencias del backend, puedes empezar por el comando `npm.cmd --prefix frontend ci`.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm.cmd --prefix frontend ci
```

4. En el Explorador de archivos, haz clic derecho en [Iniciar OdontoSoft.cmd](../Iniciar%20OdontoSoft.cmd). Elige **Mostrar más opciones → Enviar a → Escritorio (crear acceso directo)**. Puedes renombrar el acceso directo como **OdontoSoft**. [Guía de Microsoft para crear accesos directos](https://support.microsoft.com/es-es/windows/experience/personalization/customize-the-desktop-icons-in-windows)
5. Haz clic derecho en el nuevo acceso directo del escritorio y abre **Propiedades → Acceso directo → Cambiar icono → Examinar**. Selecciona [OdontoSoft.ico](../OdontoSoft.ico) en la carpeta principal del proyecto. Pulsa **Aceptar → Aplicar → Aceptar**.

## Abrir cada día

1. Comprueba que el servicio de PostgreSQL esté iniciado en Windows. Puedes buscarlo como **Servicios** en el menú Inicio. Si configuraste el servicio como automático, Windows lo inicia al encender el equipo.
2. Haz doble clic en el icono **OdontoSoft**. Espera a que se abra la ventana de inicio de sesión.

La ventana se abre en `http://127.0.0.1:8765/login` en este equipo. Si Edge no está instalado, el lanzador usa el navegador predeterminado. El servidor local queda disponible para reabrir la aplicación después de cerrar la ventana y se detiene al cerrar la sesión de Windows o apagar el equipo.

Desde PowerShell, ejecuta `& ".\Iniciar OdontoSoft.cmd"` en la carpeta principal para abrir la misma aplicación. Para preparar y comprobar el arranque desde la consola sin abrir otra ventana, ejecuta `.\.venv\Scripts\python.exe backend/escritorio.py --comprobar`.

Si aparece un aviso de conexión, comprueba el servicio de PostgreSQL y la configuración de la base. Si vienes de una versión del lanzador anterior a la actualización automática, cierra la sesión de Windows una vez para que el servidor anterior se detenga.

## Habilitar la entrega de correos

Configura SMTP en el archivo privado del backend. En escritorio, las invitaciones y recuperaciones enlazan a la instancia local. Para pacientes con acceso desde otro equipo, configura un despliegue y un origen web autorizado y accesible. El servidor procesa los avisos mientras está en ejecución. [Correo y despliegue](puesta-en-produccion-y-respaldos.md#configurar-los-correos-automáticos)

## Usar el dictado y los adjuntos clínicos

Pulsa el micrófono de un campo, concede el permiso del navegador y vuelve a pulsarlo para transcribir. Cada grabación dura hasta un minuto. El servidor de OdontoSoft transcribe en español y añade el resultado al campo. Para acceder desde otro equipo, abre el sitio por HTTPS para que el navegador pueda usar el micrófono.

En una instalación nueva, instala las dependencias del backend y descarga `vosk-model-small-es-0.42`. Descomprime la carpeta del modelo dentro de `backend/modelos`, o define su ruta mediante `ODONTO_DICTADO_MODELO`. El audio se procesa en memoria dentro de OdontoSoft. [Modelos oficiales de Vosk](https://alphacephei.com/vosk/models)

En **Historia clínica → Examen odontológico → Radiografías, fotos y documentos**, el odontólogo asignado puede adjuntar archivos JPG, PNG, WebP, TIFF, PDF y DICOM de hasta 15 MB por archivo. Aplica [la migración de adjuntos clínicos](../database/migracion_adjuntos_clinicos.sql) en bases existentes.
