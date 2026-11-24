@echo off
setlocal
if not exist "%~dp0.venv\Scripts\pythonw.exe" (
    echo Primero prepara el entorno de Python en la carpeta .venv.
    echo Consulta docs\odonto-escritorio.md.
    pause
    exit /b 1
)
start "" /b "%~dp0.venv\Scripts\pythonw.exe" "%~dp0backend\escritorio.py"
