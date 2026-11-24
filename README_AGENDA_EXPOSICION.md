# OdontoSoft — panel y calendario de citas

Esta guía documenta la entrega anterior a la migración a React. La configuración de la aplicación actual está en [README.md](README.md).

## Qué incorpora

- Inicio del odontólogo con sus citas de hoy, próximas citas, finalizadas y distribución de estados.
- Lista de atenciones de hoy con paciente, hora, duración y tratamiento.
- Ficha rápida con datos del paciente, próxima cita y accesos a historia clínica y odontograma.
- Calendario interno mensual y semanal en Citas, con colores corporativos, búsqueda, selección de odontólogo para el administrador, detalles y creación desde el día seleccionado.
- El odontólogo ve las citas vinculadas a su registro profesional mediante el mismo correo del usuario.
- Reserva desde el panel del paciente para valoración inicial o tratamientos del catálogo.
- La valoración inicial se crea en el catálogo al realizar la primera reserva si todavía no existe.
- Duración real por cita, guardada junto con ella. Las citas nuevas y su tratamiento se crean en una sola transacción.
- Comprobación de cruces al crear, reprogramar o cambiar un tratamiento: odontólogo, paciente y consultorio. Las citas canceladas o de inasistencia no ocupan el horario.
- Las pantallas abiertas consultan cambios cada 15 segundos; también se actualizan al guardar. No se recarga un formulario abierto durante la actualización automática.
- Iconos locales para que estos paneles no dependan de descargar una fuente durante la exposición.

Este es un calendario interno de OdontoSoft. No requiere conectar una cuenta de Google ni configura Google Calendar.

## Instalación en tu equipo (orden importante)

1. Descarga todos los archivos modificados y los nuevos desde Drive, conservando las carpetas. Si trabajas con una copia descargada, los cambios de Drive no se aplican solos en tu computador.
2. Detén el backend con Ctrl+C antes de reemplazar sus archivos.
3. En pgAdmin abre Query Tool sobre la base configurada en backend/.env. Ejecuta completo `database/migracion_agenda_calendario.sql`. No uses los scripts iniciales de creación de base.
4. Se agrega la columna `cita.duracion_minutos`, un límite válido entre 5 y 480 minutos y un índice de fecha. El script no borra datos ni crea una nueva base. En la primera ejecución importa duraciones reconocidas del catálogo; otras citas quedan con 30 minutos. Revisa la duración de citas antiguas antes de la demostración. Si vuelves a ejecutarlo, no sobrescribe duraciones editadas.
5. En la terminal backend, con el entorno virtual activado:

```bat
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

6. Mantén el servidor del frontend en la otra terminal. Abre el sitio como antes y recarga con Ctrl+F5.

No hace falta cambiar las variables de conexión del .env. La nueva dependencia tzdata permite que la zona horaria de Colombia funcione también en Windows.

## Archivos modificados

- backend/models.py
- backend/schemas.py
- backend/routers/citas.py
- backend/requirements.txt
- frontend/html/panel_odontologo.html
- frontend/html/citas.html
- frontend/html/panel_cliente.html
- frontend/css/panel_odontologo.css
- frontend/css/citas.css
- frontend/css/panel_cliente.css
- frontend/js/panel_odontologo.js
- frontend/js/citas.js
- frontend/js/panel_cliente.js

## Archivos nuevos

- frontend/css/agenda_ui.css
- frontend/js/agenda_ui.js
- database/migracion_agenda_calendario.sql
- README_AGENDA_EXPOSICION.md

Los archivos del odontograma no cambian en esta entrega.

## Demostración sugerida

1. Entra como administrador, ve a Citas y agenda para el día de la exposición a un odontólogo cuyo registro tenga el mismo correo que su usuario.
2. Entra como ese odontólogo y muestra el resumen de hoy y la ficha rápida del paciente.
3. Abre el calendario y pulsa sobre una cita para ver paciente, tratamiento, horario y duración.
4. En otra ventana o navegador entra como paciente. Pulsa Agendar cita, elige valoración inicial o un tratamiento, odontólogo, fecha y hora futura.
5. Si el horario elegido no está disponible, pulsa **Buscar otro odontólogo**. La búsqueda muestra una alternativa desde la fecha y hora indicadas y revisa hasta 30 días. Para tratamientos específicos, busca profesionales activos con la misma especialidad registrada que el odontólogo elegido. Para una valoración inicial, busca entre los odontólogos activos. **Usar este horario** rellena el formulario. **Confirmar cita** guarda la reserva y comprueba los cruces de nuevo.
6. Reserva una hora libre. La cita aparece en Mis Citas y, en unos 15 segundos, en la agenda abierta del odontólogo o al pulsar Actualizar agenda.

Cada odontólogo consulta las citas de su propia agenda. El paciente ve sus citas y los horarios disponibles para reservar.

Las reservas de pacientes deben empezar a partir de las 08:00 y terminar como máximo a las 18:00, hora de Colombia. La búsqueda de otro odontólogo también comprueba las vacaciones y los descansos.

## Descansos y vacaciones del odontólogo

En **Citas → Mi agenda → Descansos y vacaciones**, pulsa **Agregar bloqueo**. Elige **Descanso de un día**, **Descanso diario** o **Vacaciones** y pulsa **Guardar bloqueo**. En un descanso de un día, elige la fecha y las horas de inicio y fin. En el descanso diario solo indicas las horas. Las vacaciones bloquean días completos, del primero al último inclusive.

El descanso de un día sustituye al diario en esa fecha. Puedes editar o quitar cada bloqueo desde la misma sección. Si el cambio dejaría una cita activa en un horario bloqueado, OdontoSoft te pide reprogramar primero la cita.

## Verificación realizada

- Nueve pruebas de API con FastAPI y SQLite temporal: reserva inicial, tratamiento, cruces de duración, horas consecutivas, cancelación, reactivación, edición fallida sin pérdida de datos y compatibilidad con peticiones anteriores.
- Pruebas en Chromium con respuestas simuladas de la API: panel por odontólogo, ficha rápida, calendario mensual y semanal, creación desde el calendario, aviso de ocupado, reserva y actualización en la agenda; vista móvil sin desbordar la página.
- Migración ejecutada en PostgreSQL embebido (PGlite), incluyendo una segunda ejecución y comprobación de que se conservan las citas y las duraciones editadas.
- El bloqueo de reservas simultáneas usa un bloqueo transaccional de PostgreSQL en las operaciones de agenda de esta API. Falta comprobar el conjunto completo contra tu servidor PostgreSQL y tus datos locales.

La conexión y los permisos de sesión conservan el mecanismo existente del proyecto. Esta entrega no sustituye el trabajo de autenticación y autorización del backend recomendado para una puesta en producción.
