# 🦷 OdontoSoft — Sistema de Gestión Odontológica

Sistema de gestión para clínicas odontológicas con FastAPI, PostgreSQL y una interfaz web en React.

En Windows puedes abrirlo desde un icono con [Iniciar OdontoSoft.cmd](Iniciar%20OdontoSoft.cmd). Sigue la [guía de escritorio](docs/odonto-escritorio.md) para preparar el acceso directo y la base.

## Web en React

La aplicación web usa React y sus pantallas están en `frontend/src/app`. El archivo `frontend/index.html` carga la aplicación y su enrutador. Las direcciones anteriores, como `/html/login.html`, siguen llegando a la pantalla correspondiente.

El catálogo público aparece en la página de inicio. El administrador lo gestiona desde **Panel → Productos**. Puede publicar nombre, descripción, precio en pesos colombianos e imágenes JPG, PNG o WebP de hasta 4 MB.

Cuando el odontólogo finaliza una cita, la cola de correo programa una encuesta personal. El paciente puede calificar de 1 a 5, escribir un comentario y autorizar su publicación anónima en **Inicio → Opiniones**.

En **Mi tratamiento**, el paciente consulta el mapa dental y las fases que su odontólogo decidió compartir. En **Facturación**, el paciente solicita servicios y descarga su historial de comprobantes. El administrador registra pagos recibidos y filtra el historial por paciente. Cuando confirma un pago, la cola de correo programa el envío del PDF.

Los PDF son comprobantes internos. La expedición de factura electrónica colombiana requiere la validación de la DIAN. [Referencia de la DIAN](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_5716_2026.htm)

La [guía de PostgreSQL](database/README.md) incluye el script para actualizar `odontosoft_demo` y el instalador para una base nueva `odontosoft_ultimate`.

Para iniciar el servidor de desarrollo desde la raíz del proyecto:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run dev
```

Abre `http://127.0.0.1:5173/`. Para iniciar sesión y consultar o guardar datos, ejecuta también el backend FastAPI con su configuración PostgreSQL habitual.

El comando `npm.cmd --prefix frontend run build` genera `frontend/dist`. Si lo sirves desde otro servidor web, configura las rutas de la aplicación para responder con `index.html` cuando la URL no corresponda a un archivo estático. Para los enlaces de recuperación de contraseña, configura `FRONTEND_URL` en FastAPI con el origen de la web que corresponda. El valor local predeterminado es `http://127.0.0.1:5173`.

El archivo `odontosoft-react y html.zip` guarda la versión híbrida anterior del frontend, incluyendo su código fuente y el instructivo que tenía al momento de la copia.

La [guía de sesiones y acceso clínico](docs/sesiones-y-acceso-clinico.md) explica cómo actualizar una instalación y cómo se autorizan los expedientes.

La [guía de migración de contraseñas](docs/migracion-de-contrasenas.md) explica cómo activar Argon2id en una base existente y restablecer las cuentas afectadas.

La [guía de HTTPS, auditoría clínica y copias de PostgreSQL](docs/puesta-en-produccion-y-respaldos.md) incluye la configuración del despliegue y el ensayo de restauración.

---

## 📁 Estructura del Proyecto

```
odontosoft/
│
├── backend/                    # API REST con FastAPI
│   ├── main.py                 # Punto de entrada, registro de routers y CORS
│   ├── database.py             # Conexión PostgreSQL con SQLAlchemy
│   ├── models.py               # Modelos ORM (tablas de la BD)
│   ├── schemas.py              # Esquemas Pydantic (validación)
│   ├── requirements.txt        # Dependencias Python
│   └── routers/
│       ├── __init__.py
│       ├── roles.py            # CRUD /roles
│       ├── usuarios.py         # CRUD /usuarios
│       ├── tratamientos.py     # CRUD /tratamientos
│       ├── citas.py            # CRUD /citas
│       ├── servicios.py        # CRUD /servicios
│       └── proveedores.py      # CRUD /proveedores
│
└── frontend/                   # Interfaz web en React
    ├── index.html              # Entrada de la aplicación web
    ├── src/app/                # Enrutador, componentes y cliente API
    ├── css/                    # Hojas de estilo
    └── assets/                 # Imágenes y recursos locales
```

---

## 🗄️ Tablas de la Base de Datos

| Tabla          | Descripción                              |
|----------------|------------------------------------------|
| `roles`        | Roles del sistema (Admin, Odontólogo, Paciente) |
| `usuarios`     | Personal y pacientes registrados         |
| `tratamientos` | Catálogo de procedimientos dentales      |
| `citas`        | Agenda de citas médicas                  |
| `servicios`    | Historial de servicios por paciente      |
| `proveedores`  | Proveedores de suministros médicos       |

---

## 🚀 Inicio del backend

### 1. Instalar dependencias del backend

```bash
cd backend
pip install -r requirements.txt
```

### 2. Iniciar el servidor FastAPI

```bash
uvicorn main:app --reload
```

El servidor queda disponible en: **http://127.0.0.1:8000**

---

## 📡 Endpoints de la API

| Método | Ruta                          | Descripción                     |
|--------|-------------------------------|---------------------------------|
| GET    | `/roles`                      | Listar todos los roles          |
| POST   | `/roles`                      | Crear nuevo rol                 |
| PUT    | `/roles/{id}`                 | Actualizar rol                  |
| DELETE | `/roles/{id}`                 | Eliminar rol                    |
| GET    | `/usuarios`                   | Listar todos los usuarios       |
| POST   | `/usuarios`                   | Crear usuario                   |
| PUT    | `/usuarios/{id}`              | Actualizar usuario              |
| DELETE | `/usuarios/{id}`              | Eliminar usuario                |
| GET    | `/tratamientos`               | Listar tratamientos             |
| POST   | `/tratamientos`               | Crear tratamiento               |
| GET    | `/citas`                      | Listar todas las citas          |
| GET    | `/citas/paciente/{id}`        | Citas de un paciente            |
| GET    | `/citas/odontologo/{id}`      | Citas de un odontólogo          |
| POST   | `/citas`                      | Crear cita                      |
| PATCH  | `/citas/{id}/estado`          | Cambiar estado de cita          |
| DELETE | `/citas/{id}`                 | Eliminar cita                   |
| GET    | `/servicios/paciente/{id}`    | Servicios de un paciente        |
| POST   | `/servicios`                  | Registrar servicio              |
| GET    | `/proveedores`                | Listar proveedores              |
| POST   | `/proveedores`                | Registrar proveedor             |
| PUT    | `/proveedores/{id}`           | Actualizar proveedor            |
| DELETE | `/proveedores/{id}`           | Eliminar proveedor              |

📄 Documentación interactiva automática: **http://127.0.0.1:8000/docs**

---

## 🔧 Orden recomendado para poblar la BD

1. Crear **Roles** (Administrador, Odontólogo, Paciente)
2. Crear **Usuarios** (asignarles rol)
3. Crear **Tratamientos**
4. Registrar **Citas** (vinculando paciente + odontólogo + tratamiento)
5. Registrar **Proveedores**


## Migración adicional
