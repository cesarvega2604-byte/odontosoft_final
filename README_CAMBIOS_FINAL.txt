ODONTOSOFT - CAMBIOS DE ESTA VERSION

- El guardado de insumos ahora llega correctamente al backend.
- El stock se actualiza mediante movimientos ENTRADA, SALIDA y AJUSTE.
- Alertas de stock bajo y vencimiento.
- Administración/suministros modifica; odontologia consulta.

- Registro facial con consentimiento explícito.
- Detector TinyFace optimizado para mayor velocidad.
- La primera carga requiere internet para descargar la librería/modelos.

3. HISTORIA CLINICA
- Encabezado azul oscuro consistente con el odontograma.
- Guardado al avanzar de una parte a otra.
- PDF individual y PDF completo con formato de documento clínico.
- El render del PDF se realiza dentro del viewport para evitar PDFs vacíos.

4. ODONTOGRAMA
- 32 piezas organizadas en cuatro cuadrantes.
- Se conservan estados, observaciones y estadísticas.

5. SALIR
- Corregidas rutas ../login.html que provocaban ERR_FILE_NOT_FOUND.

BASE DE DATOS
- Para estos cambios de frontend/backend NO es necesario crear otra tabla.
