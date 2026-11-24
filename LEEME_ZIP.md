# Abrir OdontoSoft desde el ZIP

Extrae la carpeta **OdontoSoft** completa. En ella encontrarás la aplicación web y de escritorio, la API, el proyecto móvil de consultorios, las guías, los materiales de sustentación y el modelo de dictado en español.

1. Si ya usas OdontoSoft, copia tu archivo privado `backend/.env` a la carpeta extraída y conserva el nombre de la base que utilizas. Para una instalación nueva, crea `odontosoft_ultimate` en PostgreSQL y ejecuta `database/odontosoft_ultimate.sql`. Copia `backend/.env.example` como `backend/.env` y completa la conexión.
2. Desde PowerShell en la carpeta extraída, prepara el entorno de Python y las dependencias de React.

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
   npm.cmd --prefix frontend ci
   ```

3. Deja PostgreSQL activo y abre **Iniciar OdontoSoft.cmd**. Puedes usar **OdontoSoft.ico** para el acceso directo. Si el lanzador indica que el puerto está ocupado por otra copia de OdontoSoft, cierra la sesión de Windows y vuelve a abrir esta copia.

Consulta [la guía de escritorio](docs/odonto-escritorio.md), [el manual de usuario](docs/manual-usuario.md) y [la guía de PostgreSQL](database/README.md).
