# OdontoSoft · Manual de usuario

Versión web y de escritorio del 24 de noviembre de 2026. Usa datos ficticios en capacitaciones y demostraciones.

## Entrar y registrarse

1. Abre OdontoSoft, escribe el correo y la contraseña y pulsa **Ingresar**. El sistema abrirá el panel de tu rol.
2. Para registrarte como paciente, selecciona **Regístrate aquí**. Completa nombre, apellido, tipo y número de documento, fecha de nacimiento, correo, teléfono y contraseña. Usa al menos 8 caracteres. OdontoSoft recomienda 15 o más.
3. Si olvidaste la contraseña, solicita la recuperación y usa el enlace del correo dentro de los 15 minutos de vigencia. Para terminar, pulsa **Cerrar sesión** o **Salir**. [Acceso](../frontend/src/app/Login.jsx)

## Paciente

1. Abre **Mi Perfil** para revisar o editar tu identificación y los campos habilitados.
2. Pulsa **Agendar cita**. Elige tratamiento, odontólogo, fecha y hora. Puedes añadir el motivo o pulsar **Buscar otro odontólogo**. Comprueba la reserva **En Espera** en **Mis Citas**.
3. La jornada de reserva va de **08:00 a 18:00, hora de Colombia**. La duración completa debe caber en un intervalo libre. Si el horario se ocupa, elige otra opción.
4. En **Mi tratamiento**, revisa el avance y toca una pieza para ver las fases que compartió el odontólogo.
5. En **Facturación**, elige un servicio y pulsa **Solicitar servicio**. Coordina el pago con el consultorio. Tras la confirmación, descarga tu PDF desde **Historial de facturación**. [Panel del paciente](../frontend/src/app/PatientDashboard.jsx) · [Mi tratamiento](../frontend/src/app/TreatmentPlan.jsx) · [Facturación](../frontend/src/app/Billing.jsx)

## Odontólogo

1. En tu panel, revisa los pacientes asignados. Abre **Ficha rápida**, **Historia clínica**, **Odontograma** o **Plan del paciente**.
2. En el calendario, abre **Descansos y vacaciones**. Puedes registrar un descanso diario, uno puntual o un período de vacaciones. El descanso puntual sustituye al diario en esa fecha.
3. Diligencia la historia clínica en una sola página. En **Examen odontológico**, pulsa **Adjuntar archivos** para agregar radiografías, fotos o documentos. Pulsa el micrófono del campo para grabar y vuelve a pulsarlo para transcribir. Revisa el texto y usa **Guardar historia** o **Descargar PDF**. La identificación se muestra en modo lectura.
4. En el odontograma, selecciona pieza o superficie, aplica el estado y la observación y pulsa **Guardar odontograma**.
5. En **Plan del paciente**, agrega una fase y marca **Mostrar al paciente** para publicarla. Al terminar la atención, busca la tarjeta de la cita en **Mis citas de hoy**, pulsa **Finalizar cita** y confirma. OdontoSoft programa el correo con la encuesta. [Panel odontológico](../frontend/src/app/DentistDashboard.jsx) · [Historia clínica](../frontend/src/app/ClinicalRecord.jsx) · [Odontograma](../frontend/src/app/DentalChart.jsx)

## Administrador

1. En **Usuarios**, administra las cuentas y usa los filtros por rol. En **Citas**, consulta el calendario y gestiona las reservas.
2. En **Productos**, administra nombre, descripción, precio e imagen del catálogo público. Usa también los accesos a roles, tratamientos y proveedores.
3. En **Facturación**, abre la compra pendiente y pulsa **Registrar pago**. Elige el medio recibido por el consultorio y confirma. Puedes filtrar el historial por paciente y revisar el estado del correo. El PDF es un comprobante interno. [Panel administrativo](../frontend/src/app/UserDashboard.jsx) · [Agenda](../frontend/src/app/Appointments.jsx)

## Correos y encuestas

- La aplicación prepara correos de recuperación, bienvenida, cita, recordatorios a 24 horas y 1 hora, encuesta, cumpleaños y comprobante PDF.
- Los recordatorios requieren suficiente tiempo antes de la cita. Reprogramar o cancelar ajusta la cola.
- La encuesta admite una respuesta por enlace con valoración de 1 a 5. La opinión aparece anónima en Inicio cuando el paciente lo autoriza.
- El mensaje de cumpleaños se intenta enviar a partir de las 09:00, hora de Colombia. En años no bisiestos, el sistema usa el 28 de febrero para quienes nacieron el 29.
- Para la entrega, el servidor y SMTP deben estar activos. Si encuentras un error, registra la hora, la pantalla y el mensaje. Usa datos ficticios en las capturas que compartas. [Correo programado](../backend/correos_programados.py)
