# Poner OdontoSoft en el escritorio de Windows

Después de preparar el acceso directo, deja PostgreSQL encendido y abre **OdontoSoft** con doble clic. El lanzador prepara la interfaz React si detecta cambios, inicia o actualiza el servidor de OdontoSoft y abre la pantalla de inicio de sesión.

## 1. Ubica la carpeta principal

1. Abre el **Explorador de archivos** con **Windows + E**.
2. Entra a **Documentos → final_odonto**. En este equipo, la carpeta es `C:\Users\MAURICIO\Documents\final_odonto`.
3. Ubica [Iniciar OdontoSoft.cmd](Iniciar%20OdontoSoft.cmd) y [OdontoSoft.ico](OdontoSoft.ico). El primero abre la aplicación. El segundo es la imagen para el acceso directo. Windows puede ocultar las extensiones y mostrar los nombres como **Iniciar OdontoSoft** y **OdontoSoft**.

Si estás preparando otro equipo, instala Python, Node.js y PostgreSQL. Luego sigue la preparación inicial y la configuración de la base en las guías del proyecto. [Preparación de escritorio](docs/odonto-escritorio.md#preparar-una-vez) · [Configuración de PostgreSQL](database/README.md)

## 2. Crea el acceso directo

1. Haz clic derecho sobre **Iniciar OdontoSoft.cmd** dentro de `final_odonto`.
2. Elige **Mostrar más opciones** si aparece.
3. Selecciona **Enviar a → Escritorio (crear acceso directo)**.
4. Ve al Escritorio. Selecciona el acceso nuevo, pulsa **F2** y escribe **OdontoSoft**.

Si el menú es diferente, también puedes hacer clic derecho en un espacio vacío del Escritorio y elegir **Nuevo → Acceso directo**. Pulsa **Examinar**, selecciona **Iniciar OdontoSoft.cmd** en `final_odonto`, pulsa **Siguiente** y ponle el nombre **OdontoSoft**. [Ayuda de Microsoft sobre accesos directos](https://support.microsoft.com/es-es/windows/experience/personalization/customize-the-desktop-icons-in-windows#agregar-accesos-directos-al-escritorio)

## 3. Ponle el icono de OdontoSoft

1. En el **Escritorio**, haz clic derecho sobre el acceso directo **OdontoSoft** y elige **Propiedades**.
2. Abre la pestaña **Acceso directo** y pulsa **Cambiar icono…**. Si Windows muestra un aviso sobre los iconos disponibles, pulsa **Aceptar**.
3. Pulsa **Examinar…** y selecciona **OdontoSoft.ico** dentro de `final_odonto`. Puedes pegar la ruta de este equipo directamente en el cuadro del archivo.

   ```text
   C:\Users\MAURICIO\Documents\final_odonto\OdontoSoft.ico
   ```

4. Pulsa **Abrir**, selecciona el icono, pulsa **Aceptar** y luego **Aplicar → Aceptar**. El acceso directo del Escritorio mostrará la imagen de OdontoSoft.

## 4. Abre OdontoSoft en el uso diario

1. Abre **Inicio**, busca **Servicios** y ubica el servicio de PostgreSQL. En este equipo se llama `postgresql-x64-18`. Si está detenido, haz clic derecho y elige **Iniciar**. Con el tipo de inicio **Automático**, Windows lo arranca al encender el equipo.
2. Haz doble clic en el icono **OdontoSoft** del Escritorio. Tras unos segundos debe abrirse la pantalla de inicio de sesión.

Para el uso diario, puedes cerrar pgAdmin y PowerShell. PostgreSQL sigue funcionando como servicio de Windows.

## Si la ventana no abre

- Si aparece un aviso de conexión, revisa primero el servicio de PostgreSQL. La configuración actual del proyecto usa la base `odontosoft_demo`.
- Si moviste `final_odonto` de lugar, crea el acceso directo de nuevo desde la nueva ubicación y vuelve a elegir `OdontoSoft.ico`.
- Si quieres ver el diagnóstico desde PowerShell, abre la consola en `final_odonto` y ejecuta `.\.venv\Scripts\python.exe backend/escritorio.py --comprobar`. Si todo está listo, verás el mensaje **OdontoSoft listo**.
