# Instalar la base de demostración de OdontoSoft

En una base existente, ejecuta [migracion_adjuntos_clinicos.sql](migracion_adjuntos_clinicos.sql) desde **Query Tool** sobre la base que usa OdontoSoft. La tabla nueva almacena el contenido de las fotos, radiografías y documentos en PostgreSQL.

## Actualizar `odontosoft_demo` con Mi tratamiento y Facturación

1. Haz una copia de seguridad de la base y abre **Query Tool** sobre `odontosoft_demo`.
2. Abre [actualizar_odontosoft_demo_tratamiento_facturacion.sql](actualizar_odontosoft_demo_tratamiento_facturacion.sql) y ejecuta el archivo completo con **F5**. Si falta la actualización de identificación y cumpleaños, aplícala primero.
3. Conserva `DB_NAME=odontosoft_demo` en la configuración privada del backend y sigue los pasos de activación que aparecen abajo.

La migración agrega las fases y las compras de servicios. Conserva las facturas existentes y mantiene sus fechas originales. Si una factura anterior solo tenía la fecha, la interfaz indica que la hora está sin registrar. La migración no genera envíos retroactivos.

## Instalar una base nueva llamada `odontosoft_ultimate`

1. En pgAdmin, usa **Databases → Create → Database**. Escribe `odontosoft_ultimate` y guarda.
2. Abre **Query Tool** sobre esa base vacía y ejecuta [odontosoft_ultimate.sql](odontosoft_ultimate.sql) con **F5**.
3. Comprueba que aparecen 28 tablas y seis cuentas ficticias para exposición. Si quieres usar esa base en el sistema, configura `DB_NAME=odontosoft_ultimate` en el backend.

### Activar el código actualizado

Desde la carpeta principal del proyecto, actualiza las dependencias del backend después de aplicar el SQL elegido.

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Abre OdontoSoft desde el icono. El lanzador prepara React y reinicia el servidor de escritorio si detecta cambios en el código. Si ejecutas FastAPI desde una terminal, reinícialo en esa terminal. [Guía de escritorio](../docs/odonto-escritorio.md)

## Instalar la versión base de `odontosoft_demo`

El nombre exacto de la base en PostgreSQL es **`odontosoft_demo`**, en minúsculas y con guion bajo.

Para actualizar una base ya creada, consulta la [guía de migración de contraseñas](../docs/migracion-de-contrasenas.md) y la [guía de HTTPS, auditoría y respaldos](../docs/puesta-en-produccion-y-respaldos.md). Aplica también [migracion_bloqueos_agenda.sql](migracion_bloqueos_agenda.sql) en la base que usa el backend para habilitar descansos y vacaciones.

## Crear y cargar la base en pgAdmin

1. Abre pgAdmin y conéctate a tu servidor PostgreSQL.
2. En el árbol de la izquierda, haz clic derecho en **Databases** y elige **Create → Database**. Escribe `odontosoft_demo` en **Database** y pulsa **Save**.
3. Haz clic derecho sobre **odontosoft_demo** y elige **Query Tool**. Comprueba que la conexión de la pestaña corresponde a esa base.
4. En Query Tool, usa **Open File** para abrir [odontosoft_demo.sql](odontosoft_demo.sql) y pulsa **Execute** (F5) para ejecutar el archivo completo.
5. Comprueba que el resultado final muestra seis cuentas con estado **Activo**. En el árbol de pgAdmin, actualiza **Schemas → public → Tables** para ver las 25 tablas.

Para incorporar el catálogo y los correos en una base creada con una versión anterior, ejecuta [migracion_catalogo_y_correos.sql](migracion_catalogo_y_correos.sql). La migración programa los recordatorios futuros de citas existentes y conserva el indicador de los avisos de un día ya enviados.

Para habilitar las encuestas en una base existente, aplica [migracion_encuestas.sql](migracion_encuestas.sql) después de la migración de correos.

Para habilitar el tipo de documento y los correos de cumpleaños en una base existente, aplica [migracion_identificacion_cumpleanos.sql](migracion_identificacion_cumpleanos.sql) después de la migración de encuestas. Los pacientes existentes pueden completar la identificación que falte desde **Editar perfil**.

El script clásico requiere que el esquema `public` esté vacío. Si usas la versión actual de la aplicación con este nombre de base, aplica también la actualización de **Mi tratamiento y Facturación** antes de iniciar FastAPI.

## Iniciar OdontoSoft

Si el backend ya está corriendo en el puerto 8000, detén ese proceso con **Ctrl+C** en su terminal. Desde la carpeta raíz del proyecto, abre PowerShell y ejecuta:

```powershell
$env:DB_NAME = "odontosoft_demo"
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
```

`DB_NAME` apunta a la base de demostración para el backend iniciado en esa terminal. Usa la configuración de conexión de PostgreSQL que ya tienes en el proyecto.

Si el frontend está apagado, abre otra terminal en la raíz del proyecto y ejecuta:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run dev
```

Abre [el inicio de sesión de OdontoSoft](http://127.0.0.1:5173/login).

## Cuentas para la exposición

Las seis cuentas ficticias usan la contraseña `ExpoOdonto2026!`.

| Perfil | Cuenta principal | Segunda cuenta |
| --- | --- | --- |
| Administrador | `admin@odontosoft.example` | `admin2@odontosoft.example` |
| Odontólogo | `odontologo@odontosoft.example` | `odontologo2@odontosoft.example` |
| Paciente | `paciente@odontosoft.example` | `paciente2@odontosoft.example` |

El script agenda tres citas ficticias para el próximo martes en hora de Colombia. Si lo cargas un martes, usa ese mismo día. Para mostrar la historia clínica, entra con la cuenta principal del odontólogo y abre la cita de las **9:00 a. m.** en estado **En Consulta**.
