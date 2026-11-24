# Sesiones y acceso a expedientes

FastAPI crea la sesión al iniciar sesión y verifica en cada solicitud que siga vigente y que la cuenta esté activa. La web recibe una cookie HttpOnly que dura hasta ocho horas. El token de consultorios dura hasta una hora. El navegador guarda el perfil en memoria después de consultarlo en `/auth/me`. Cerrar sesión elimina la sesión en PostgreSQL. Un cambio de contraseña, rol, correo o estado revoca las sesiones de la cuenta.

## Quién puede abrir un expediente

- Un **odontólogo** puede consultar y guardar historia clínica y odontograma cuando tiene al menos una cita asignada a ese paciente en estado pendiente, en espera, confirmada, en consulta o finalizada. Una cita cancelada o de inasistencia por sí sola no concede acceso. El acceso termina si deja de existir una cita que lo autorice.
- **Administración** puede crear y reasignar citas. Para cubrir a otro profesional, asigna la cita al odontólogo que atenderá al paciente. El rol de administrador puede gestionar cuentas y agenda.
- El **paciente** puede ver sus citas, sus servicios y su perfil. Puede reservar con su propia cuenta y actualizar su nombre, apellido y teléfono.

El correo de la cuenta y el de la ficha profesional deben coincidir exactamente. Si dos fichas profesionales comparten ese correo, resuelve el duplicado antes de usar esa cuenta. La relación paciente-cuenta se obtiene de `usuario_paciente`.

## Preparar la instalación

1. En una base existente, ejecuta [la migración de sesiones](../database/migracion_sesiones_acceso.sql) en pgAdmin. Agrega la tabla y un índice. En una base de demostración nueva, el [script completo](../database/odontosoft_demo.sql) incluye esa tabla.
2. Reinicia el backend y recompila o reinicia el frontend. Los usuarios deben volver a iniciar sesión.
3. En el entorno local, usa el mismo nombre de host para la web y la API. Por ejemplo, abre `http://127.0.0.1:5173` para utilizar la API de `http://127.0.0.1:8000`.

Para publicar, sirve la web y la API mediante HTTPS. Mantén ambos en el mismo sitio para que el navegador envíe la cookie y configura `ODONTO_WEB_ORIGINS` en FastAPI con los orígenes web exactos, separados por comas. Si la API tiene un origen distinto del frontend, establece `ODONTO_API_ORIGIN` al compilar React y conserva la API dentro del mismo sitio. El módulo Expo de consultorios pide credenciales administrativas y su token se limita a ese módulo. Para probarlo en un dispositivo, configura `EXPO_PUBLIC_ODONTO_API_URL` con la URL de la API accesible desde ese dispositivo. En una compilación de producción, Expo requiere una URL HTTPS.

El registro público de pacientes usa `POST /auth/registro`. `POST /usuarios/registro` queda reservado a administración. Una ficha clínica sin contenido devuelve datos vacíos hasta el primer guardado.

## Comprobar los permisos

Desde la raíz del proyecto, ejecuta `python -X utf8 backend/tests/test_access.py`. La prueba predeterminada usa SQLite en memoria, carga sus propios datos ficticios y sustituye el envío de avisos. Para repetirla en PostgreSQL, crea una base descartable y vacía `odontosoft_access_test` en una instancia de pruebas local y configura `ODONTO_TEST_DB_URL` con su URL SQLAlchemy.

El [respaldo del código](../outputs/odontosoft-antes-de-sesiones.zip) contiene los archivos fuente anteriores. No contiene una copia de PostgreSQL ni archivos de configuración con secretos.
