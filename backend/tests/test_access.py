"""Run against disposable demo data only. Never imports the project's DB settings."""
import os
import asyncio
from base64 import b64encode
from io import BytesIO
import logging
import hashlib
import sys
import types
import unittest
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from urllib.parse import quote
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from PIL import Image

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
logging.disable(logging.WARNING)
URL = make_url(os.environ.get("ODONTO_TEST_DB_URL", "sqlite://"))
if URL.get_backend_name() != "sqlite" and (
    URL.host != "127.0.0.1" or not (
        URL.database == "odontosoft_access_test" or (URL.database or "").startswith("odontosoft_access_test_")
    )
):
    raise RuntimeError("Usa una base aislada odontosoft_access_test en 127.0.0.1")
if URL.get_backend_name() == "sqlite" and URL.database not in {None, ":memory:"}:
    raise RuntimeError("Las pruebas SQLite necesitan una base en memoria")

config = types.ModuleType("database")
config.Base = declarative_base()
if URL.get_backend_name() == "sqlite":
    config.engine = create_engine(URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(config.engine, "connect")
    def enforce_sqlite_links(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
else:
    config.engine = create_engine(URL, hide_parameters=True)
    if inspect(config.engine).get_table_names():
        raise RuntimeError("El esquema de prueba PostgreSQL debe estar vacío")
config.SessionLocal = sessionmaker(bind=config.engine)


def get_db():
    with config.SessionLocal() as db:
        yield db


config.get_db = get_db
sys.modules["database"] = config
notifications = types.ModuleType("notifications")
notifications.NotificationService = types.SimpleNamespace(
    send_email=lambda *args, **kwargs: None, enviar_reset_password=lambda *args, **kwargs: None,
    configurado=lambda: False,
)
sys.modules["notifications"] = notifications
telegram = types.ModuleType("telegram_service")
telegram.notificar_confirmacion_cita_telegram = lambda **kwargs: None
sys.modules["telegram_service"] = telegram

from access import COOKIE_NAME, digest  # noqa: E402
import models  # noqa: E402
from passwords import hash_password, verificar_password  # noqa: E402

if URL.get_backend_name() == "postgresql":
    models.Base.metadata.create_all(config.engine)
    migration = Path(__file__).resolve().parents[2] / "database" / "migracion_auditoria_clinica.sql"
    with config.engine.begin() as connection:
        connection.exec_driver_sql(migration.read_text(encoding="utf-8"))

from main import app  # noqa: E402

WEB = "http://127.0.0.1:5173"
PASSWORD = "ClavePruebaAcceso123!"


class AccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ids = {}
        with config.SessionLocal.begin() as db:
            office = models.Consultorio(nombre="Consultorio ficticio")
            db.add(office)
            db.flush()
            cls.office = office.id_consultorio
            for name, role in (
                ("admin", "Administrador"), ("doctor1", "Odontologo"),
                ("doctor2", "Odontologo"), ("patient1", "Paciente"),
                ("patient2", "Paciente"), ("revocable", "Paciente"),
                ("racer", "Paciente"),
                ("legacy", "Paciente"), ("forced", "Paciente"),
            ):
                email = name + "@clinic.example"
                user = models.Usuario(correo=email, contrasena=hash_password(PASSWORD), rol=role, estado="Activo")
                db.add(user)
                db.flush()
                cls.ids[name] = user.id_usuario
                if role == "Odontologo":
                    doctor = models.Odontologo(nombre=name, apellido="Prueba", documento=name, correo=email, id_consultorio=cls.office)
                    db.add(doctor)
                    db.flush()
                    cls.ids["perfil_" + name] = doctor.id_odontologo
                elif role == "Paciente":
                    patient = models.Paciente(nombre=name, apellido="Prueba", documento=name, correo=email)
                    db.add(patient)
                    db.flush()
                    db.execute(models.usuario_paciente.insert().values(id_usuario=user.id_usuario, id_paciente=patient.id_paciente))
                    cls.ids["perfil_" + name] = patient.id_paciente
            for hour, (patient, doctor, status) in enumerate((
                ("patient1", "doctor1", "En Consulta"),
                ("patient1", "doctor2", "Cancelado"),
                ("patient2", "doctor2", "Finalizado"),
            ), start=9):
                appointment = models.Cita(
                    id_paciente=cls.ids["perfil_" + patient], id_odontologo=cls.ids["perfil_" + doctor],
                    id_consultorio=cls.office, fecha=date.today(), hora=time(hour), estado=status,
                )
                db.add(appointment)
                db.flush()
                cls.ids[patient + "_" + doctor] = appointment.id_cita
            db.add(models.Tratamiento(nombre="Valoración de prueba", duracion_estimada="30 min"))

    def client(self, name=None, origin=WEB):
        client = TestClient(app, base_url="http://127.0.0.1:8000", headers={"Origin": origin})
        self.addCleanup(client.close)
        if name:
            result = client.post("/auth/login", json={"correo": name + "@clinic.example", "contrasena": PASSWORD})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertNotIn("access_token", result.json())
            self.assertIn("HttpOnly", result.headers["set-cookie"])
            self.assertIn("SameSite=strict", result.headers["set-cookie"])
        return client

    def test_private_routes_require_verified_sessions(self):
        client = self.client()
        patient = self.ids["perfil_patient1"]
        for url in (
            f"/historias-clinicas-detalladas/paciente/{patient}", f"/odontogramas/paciente/{patient}",
            "/historias-clinicas/", "/pacientes/", "/citas/", "/usuarios/", "/servicios/",
            "/consultorios/", "/pagos/", "/recordatorios/", "/facturas/",
        ):
            with self.subTest(url=url):
                response = client.get(url, headers={"X-User-Role": "Administrador", "X-User-Id": str(self.ids["admin"])})
                self.assertEqual(response.status_code, 401)
        self.assertEqual(client.post("/usuarios/registro", json={
            "correo": "staff@clinic.example", "contrasena": PASSWORD, "rol": "Administrador",
        }).status_code, 401)
        self.assertEqual(client.post("/auth/registro", json={
            "correo": "staff@clinic.example", "contrasena": PASSWORD, "rol": "Administrador",
            "nombre": "Prueba", "apellido": "Personal", "tipo_documento": "CC",
            "documento": "DOC-ROL-PRUEBA", "fecha_nacimiento": "1990-01-15",
        }).status_code, 403)
        self.assertEqual(client.post(f"/usuarios/{self.ids['admin']}/cambiar-contrasena", json={
            "contrasena": PASSWORD,
        }).status_code, 401)

    def test_only_assigned_dentists_read_and_write_clinical_records(self):
        patient = self.ids["perfil_patient1"]
        allowed = self.client("doctor1")
        denied = [self.client("doctor2"), self.client("admin"), self.client("patient1")]
        for slug, field in (("historias-clinicas-detalladas", "datos_clinicos"), ("odontogramas", "dientes")):
            url = f"/{slug}/paciente/{patient}"
            payload = {"id_paciente": patient, field: {"test": "ficticio"}}
            for client in denied:
                self.assertEqual(client.get(url).status_code, 403)
                self.assertEqual(client.put(url, json=payload).status_code, 403)
            self.assertEqual(allowed.get(url).json()[field], {})
            bad = allowed.put(url, json={**payload, "id_paciente": self.ids["perfil_patient2"]})
            self.assertEqual(bad.status_code, 400)
            self.assertEqual(allowed.put(url, json=payload).status_code, 200)
            self.assertEqual(allowed.get(url).json()[field], payload[field])

        legacy = allowed.post("/historias-clinicas/", json={"fecha_apertura": date.today().isoformat(), "id_paciente": patient})
        self.assertEqual(legacy.status_code, 201, legacy.text)
        legacy_path = "/historias-clinicas/" + str(legacy.json()["id_historia"])
        self.assertEqual(denied[0].get(legacy_path).status_code, 403)
        self.assertEqual(denied[0].delete(legacy_path).status_code, 403)
        self.assertEqual(denied[0].get("/historias-clinicas/").json(), [])
        self.assertEqual(len(allowed.get("/historias-clinicas/").json()), 1)
        self.assertEqual(allowed.get(legacy_path).status_code, 200)
        # Una cita finalizada conserva el vínculo asistencial.
        other_patient = self.ids["perfil_patient2"]
        self.assertEqual(denied[0].get(f"/odontogramas/paciente/{other_patient}").status_code, 200)
        with config.SessionLocal() as db:
            events = db.query(models.AuditoriaClinica).filter_by(id_paciente=patient).all()
            recorded = {(event.id_usuario, event.recurso, event.operacion, event.resultado) for event in events}
            for resource in ("historia_clinica_detallada", "odontograma", "historia_clinica"):
                self.assertIn((self.ids["doctor1"], resource, "creacion", "permitido"), recorded)
                self.assertIn((self.ids["doctor1"], resource, "consulta", "permitido"), recorded)
                self.assertIn((self.ids["doctor2"], resource, "consulta", "denegado"), recorded)
            self.assertIn((self.ids["admin"], "odontograma", "consulta", "denegado"), recorded)
            self.assertTrue(all(event.id_registro for event in events if event.resultado == "permitido"))

    def test_adjuntos_clinicos_guardan_los_bytes_y_exigen_cita_asignada(self):
        patient = self.ids["perfil_patient1"]
        path = f"/historias-clinicas-detalladas/paciente/{patient}/adjuntos"
        doctor = self.client("doctor1")
        buffer = BytesIO()
        Image.new("RGB", (12, 12), "white").save(buffer, "PNG")
        picture = buffer.getvalue()
        headers = {"Content-Type": "image/png", "X-Nombre-Archivo": quote("Radiografía de prueba.png")}

        self.assertEqual(self.client().get(path).status_code, 401)
        self.assertEqual(doctor.post(path, content=b"Falso", headers=headers).status_code, 415)
        self.assertEqual(doctor.post(path, content=b"", headers=headers).status_code, 422)
        uploaded = doctor.post(path, content=picture, headers=headers)
        self.assertEqual(uploaded.status_code, 201, uploaded.text)
        item = uploaded.json()
        self.assertEqual(item["nombre"], "Radiografía de prueba.png")
        self.assertEqual(item["tamano"], len(picture))
        self.assertNotIn("contenido", item)
        self.assertEqual(doctor.get(path).json(), [item])
        file = f"{path}/{item['id']}"
        downloaded = doctor.get(file)
        self.assertEqual(downloaded.content, picture)
        self.assertTrue(downloaded.headers["content-disposition"].startswith("attachment;"))
        self.assertTrue(doctor.get(file + "?vista=true").headers["content-disposition"].startswith("inline;"))
        for name in ("doctor2", "admin", "patient1"):
            client = self.client(name)
            self.assertEqual(client.get(path).status_code, 403)
            self.assertEqual(client.post(path, content=picture, headers=headers).status_code, 403)
            self.assertEqual(client.get(file).status_code, 403)
        other_patient = self.ids["perfil_patient2"]
        self.assertEqual(self.client("doctor2").get(
            f"/historias-clinicas-detalladas/paciente/{other_patient}/adjuntos/{item['id']}",
        ).status_code, 404)
        with config.SessionLocal() as db:
            stored = db.get(models.AdjuntoClinico, item["id"])
            self.assertEqual(stored.contenido, picture)
            self.assertEqual(stored.id_usuario, self.ids["doctor1"])

    def test_mi_tratamiento_publica_solo_las_fases_elegidas_por_el_odontologo(self):
        patient_id = self.ids["perfil_patient1"]
        endpoint = f"/planes-tratamiento/paciente/{patient_id}"
        dentist = self.client("doctor1")
        patient = self.client("patient1")
        other = self.client("racer")
        data = {"titulo": "Restauración de prueba", "descripcion": "Explicación ficticia", "pieza": 16}

        self.assertEqual(self.client("doctor2").get(endpoint).status_code, 403)
        self.assertEqual(self.client("admin").get(endpoint).status_code, 403)
        self.assertEqual(patient.post(endpoint, json=data).status_code, 403)
        self.assertEqual(dentist.post(endpoint, json={**data, "pieza": 19}).status_code, 422)
        created = dentist.post(endpoint, json=data)
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(patient.get("/planes-tratamiento/").json(), [])
        update_url = endpoint + "/" + str(created.json()["id"])
        self.assertEqual(dentist.put(update_url, json={**data, "compartida": True}).status_code, 200)
        shared = patient.get("/planes-tratamiento/").json()
        self.assertEqual([row["titulo"] for row in shared], [data["titulo"]])
        self.assertFalse(shared[0]["editable"])
        self.assertEqual(other.get("/planes-tratamiento/").json(), [])
        self.assertEqual(dentist.put(update_url, json={
            **data, "compartida": True, "estado": "completada",
        }).status_code, 200)
        self.assertEqual(patient.get("/planes-tratamiento/").json()[0]["estado"], "completada")

    def test_compra_emite_un_comprobante_y_envia_el_pdf_al_confirmar_pago(self):
        from correos_programados import procesar_correos

        with config.SessionLocal.begin() as db:
            item = models.Tratamiento(nombre="Servicio ficticio para facturar", costo=60000)
            db.add(item)
            db.flush()
            treatment_id = item.id_tratamiento
        profile = self.ids["perfil_patient1"]
        patient, other, admin, dentist = (self.client(name) for name in ("patient1", "racer", "admin", "doctor1"))
        create = f"/compras-servicio/paciente/{profile}"
        data = {"id_tratamiento": treatment_id, "precio": "60000.00", "clave": str(uuid4())}
        self.assertEqual(other.post(create, json=data).status_code, 403)
        self.assertEqual(patient.post(create, json={**data, "precio": "1.00"}).status_code, 409)
        purchase = patient.post(create, json=data)
        self.assertEqual(purchase.status_code, 201, purchase.text)
        purchase_id = purchase.json()["id"]
        self.assertEqual(patient.post(create, json=data).json()["id"], purchase_id)
        confirm = f"/compras-servicio/{purchase_id}/confirmar-pago"
        self.assertEqual(patient.get("/facturas/").json(), [])
        self.assertEqual(patient.post(confirm, json={"metodo": "Efectivo"}).status_code, 403)
        result = admin.post(confirm, json={"metodo": "Transferencia"})
        self.assertEqual(result.status_code, 200, result.text)
        invoice = result.json()
        self.assertEqual(invoice["total"], "60000.00")
        self.assertTrue(invoice["emitida_en"] and invoice["solicitada_en"])
        self.assertEqual(admin.post(confirm, json={"metodo": "Transferencia"}).json()["id_factura"], invoice["id_factura"])
        self.assertEqual(
            [row["id_factura"] for row in admin.get(f"/facturas/?paciente_id={profile}").json()],
            [invoice["id_factura"]],
        )
        self.assertEqual(patient.get("/facturas/").json()[0]["concepto"], "Servicio ficticio para facturar")
        self.assertEqual(other.get("/facturas/").json(), [])
        self.assertEqual(dentist.get("/facturas/").status_code, 403)
        file_url = f"/facturas/{invoice['id_factura']}/pdf"
        self.assertEqual(other.get(file_url).status_code, 404)
        self.assertEqual(dentist.get(file_url).status_code, 403)
        pdf = patient.get(file_url)
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        self.assertIn(invoice["numero"], pdf.headers["content-disposition"])

        with patch.object(notifications.NotificationService, "configurado", return_value=True), \
                patch.object(notifications.NotificationService, "send_email", new_callable=AsyncMock, return_value=True) as sender:
            asyncio.run(procesar_correos())
            asyncio.run(procesar_correos())
        deliveries = [(args, opts) for args, opts in sender.call_args_list if invoice["numero"] in args[1]]
        self.assertEqual(len(deliveries), 1)
        args, opts = deliveries[0]
        self.assertEqual(args[0], "patient1@clinic.example")
        self.assertTrue(opts["pdf"][1].startswith(b"%PDF"))
        self.assertEqual(opts["pdf"][0], invoice["numero"] + ".pdf")

    def test_factura_de_pago_por_cita_persiste_cuando_la_cita_se_elimina(self):
        patient_id = self.ids["perfil_racer"]
        with config.SessionLocal.begin() as db:
            appointment = models.Cita(
                id_paciente=patient_id, id_odontologo=self.ids["perfil_doctor2"], id_consultorio=self.office,
                fecha=date.today() - timedelta(days=40), hora=time(16), estado="Finalizado",
            )
            db.add(appointment)
            db.flush()
            appointment_id = appointment.id_cita
        admin = self.client("admin")
        payment = {
            "id_cita": appointment_id, "fecha_pago": (date.today() - timedelta(days=40)).isoformat(),
            "monto": "30000.00", "metodo_pago": "Efectivo", "estado_pago": "Pendiente",
        }
        created = admin.post("/pagos/", json=payment)
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(admin.get(f"/facturas/?paciente_id={patient_id}").json(), [])
        updated = admin.put(f"/pagos/{created.json()['id_pago']}", json={**payment, "estado_pago": "Pagado"})
        self.assertEqual(updated.status_code, 200, updated.text)
        invoice = admin.get(f"/facturas/?paciente_id={patient_id}").json()[0]
        with config.SessionLocal.begin() as db:
            db.delete(db.get(models.Cita, appointment_id))
        restored = self.client("racer").get(f"/facturas/{invoice['id_factura']}")
        self.assertEqual(restored.status_code, 200)
        self.assertIsNone(restored.json()["id_pago"])
        self.assertEqual(restored.json()["total"], "30000.00")

    def test_invalid_data_is_not_reflected_in_the_response_or_log(self):
        sentinel = "MARCADOR_SENSIBLE_FICTICIO"
        with patch("main.logger.info") as info:
            response = self.client("doctor1").get("/odontogramas/paciente/" + sentinel + "?dato=" + sentinel)
        self.assertEqual(response.status_code, 422)
        self.assertNotIn(sentinel, response.text)
        self.assertNotIn(sentinel, repr(info.call_args_list))

    def test_encuesta_se_envia_al_finalizar_y_se_publica_sin_identidad(self):
        from urllib.parse import urlsplit
        import re
        from access import digest
        from correos_programados import procesar_correos

        dentist, other, public = self.client("doctor1"), self.client("doctor2"), self.client()
        day = date.today() + timedelta(days=47)
        with config.SessionLocal.begin() as db:
            patient = db.get(models.Paciente, self.ids["perfil_racer"])
            previous_contact = patient.correo
            patient.correo = "contacto-clinico@clinic.example"
            cita = models.Cita(
                id_paciente=self.ids["perfil_racer"], id_odontologo=self.ids["perfil_doctor1"],
                id_consultorio=self.office, fecha=day, hora=time(10), estado="En Consulta",
            )
            db.add(cita)
            db.flush()
            id_cita = cita.id_cita

        def restore_contact():
            with config.SessionLocal.begin() as db:
                db.get(models.Paciente, self.ids["perfil_racer"]).correo = previous_contact

        self.addCleanup(restore_contact)
        route = f"/citas/{id_cita}"
        self.addCleanup(dentist.delete, route)
        finish = route + "/finalizar"
        with config.SessionLocal() as db:
            self.assertEqual(db.query(models.CorreoProgramado).filter_by(id_cita=id_cita, tipo="encuesta").count(), 0)
        self.assertEqual(public.post(finish).status_code, 401)
        self.assertEqual(other.post(finish).status_code, 403)
        self.assertEqual(self.client("admin").post(finish).status_code, 403)
        self.assertEqual(other.post(f"/citas/{self.ids['patient1_doctor2']}/finalizar").status_code, 409)
        response = dentist.post(finish)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["estado"], "Finalizado")
        self.assertEqual(dentist.post(finish).status_code, 200)
        self.assertEqual(dentist.put(route, json={"estado": "Finalizado"}).status_code, 200)
        self.assertEqual(public.get("/opiniones").json()["opiniones"], [])

        with patch.object(notifications.NotificationService, "configurado", return_value=True), \
                patch.object(notifications.NotificationService, "send_email", new_callable=AsyncMock, return_value=True) as mail:
            asyncio.run(procesar_correos())
            asyncio.run(procesar_correos())
        enviados = [call.args for call in mail.call_args_list if "cómo fue tu cita" in call.args[1]]
        self.assertEqual(len(enviados), 1)
        self.assertEqual(enviados[0][0], "racer@clinic.example")
        self.assertIn("1 a 5 estrellas", enviados[0][2])
        enlace = re.search(r'href="([^"]+)"', enviados[0][2]).group(1)
        self.assertEqual(urlsplit(enlace).path, "/encuesta")
        token = urlsplit(enlace).fragment.removeprefix("token=")
        with config.SessionLocal() as db:
            encuesta = db.query(models.EncuestaCita).filter_by(id_cita=id_cita).one()
            self.assertEqual(encuesta.token_hash, digest(token))
            self.assertNotEqual(encuesta.token_hash, token)
            envio = db.query(models.CorreoProgramado).filter_by(id_cita=id_cita, tipo="encuesta").one()
            self.assertEqual(envio.estado, "enviado")
            self.assertIsNotNone(envio.ultimo_envio)

        body = {"token": token, "estrellas": 5, "comentario": "Excelente atención ficticia.", "publicar": True}
        self.assertEqual(public.post("/encuestas/responder", json={**body, "publicar": False}).status_code, 422)
        self.assertEqual(public.post("/encuestas/responder", json={**body, "estrellas": 6}).status_code, 422)
        response = public.post("/encuestas/responder", json=body)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(public.post("/encuestas/responder", json=body).status_code, 409)
        self.assertEqual(public.get("/opiniones").json(), {
            "opiniones": [{"estrellas": 5, "comentario": body["comentario"]}], "siguiente": None,
        })

    def test_catalogo_publico_y_cambios_solo_para_administracion(self):
        public, patient, admin = self.client(), self.client("patient1"), self.client("admin")
        image = BytesIO()
        Image.new("RGB", (18, 12), "blue").save(image, "PNG")
        payload = {"nombre": "Cepillo ficticio", "descripcion": "Prueba del catálogo", "precio": "14500.50",
                   "imagen": b64encode(image.getvalue()).decode("ascii")}
        self.assertEqual(patient.post("/productos", json=payload).status_code, 403)
        result = admin.post("/productos", json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        path = f"/productos/{result.json()['id_producto']}"
        self.assertEqual(public.get("/productos").json(), [result.json()])
        picture = public.get(path + "/imagen")
        self.assertEqual(picture.headers["content-type"], "image/jpeg")
        self.assertEqual(Image.open(BytesIO(picture.content)).size, (18, 12))
        self.assertEqual(admin.put(path, json={**payload, "imagen": "aaaa"}).status_code, 422)
        self.assertEqual(patient.delete(path).status_code, 403)
        result = admin.put(path, json={**payload, "precio": "20000", "imagen": None})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertTrue(result.json()["tiene_imagen"])
        self.assertEqual(result.json()["precio"], "20000.00")
        self.assertEqual(admin.delete(path).status_code, 204)
        self.assertEqual(public.get(path + "/imagen").status_code, 404)

    def test_correos_unificados_sin_duplicados_y_reprogramacion(self):
        from correos_programados import procesar_correos

        email = "correo-cola@example.net"
        client = self.client()
        result = client.post("/auth/registro", json={
            "correo": email, "contrasena": PASSWORD,
            "nombre": "Paciente", "apellido": "Ficticio", "telefono": "3000000000",
            "tipo_documento": "CC", "documento": "DOC-CORREO-PRUEBA",
            "fecha_nacimiento": (date.today() - timedelta(days=3657)).isoformat(),
        })
        self.assertEqual(result.status_code, 201, result.text)
        patient = result.json()
        self.assertEqual(client.post("/auth/login", json={"correo": email, "contrasena": PASSWORD}).status_code, 200)
        day = date.today() + timedelta(days=40)
        result = client.post("/citas/reservar/paciente", json={
            "id_usuario": patient["id_usuario"], "id_odontologo": self.ids["perfil_doctor1"],
            "id_tratamiento": 1, "fecha": day.isoformat(), "hora": "11:00",
        })
        self.assertEqual(result.status_code, 201, result.text)
        id_cita = result.json()["id_cita"]
        dentist = self.client("doctor1")
        self.addCleanup(dentist.delete, f"/citas/{id_cita}")
        self.assertEqual(dentist.put(f"/citas/{id_cita}", json={"hora": "11:30"}).status_code, 200)
        self.assertEqual(dentist.put(f"/citas/{id_cita}", json={"observaciones": "Cambio interno"}).status_code, 200)

        with config.SessionLocal() as db:
            trabajos = db.query(models.CorreoProgramado).filter_by(id_cita=id_cita).all()
            self.assertEqual(len(trabajos), 3)
            horarios = {
                item.tipo: item.programado_para if item.programado_para.tzinfo else
                item.programado_para.replace(tzinfo=timezone.utc)
                for item in trabajos
            }
        self.assertEqual(horarios["recordatorio_1h"] - horarios["recordatorio_24h"], timedelta(hours=23))

        enviados = []
        async def guardar_correo(destino, asunto, cuerpo):
            await asyncio.sleep(0.01)
            if destino == email:
                enviados.append((asunto, cuerpo))
            return True

        async def ejecutar():
            if URL.get_backend_name() == "postgresql":
                await asyncio.gather(procesar_correos(), procesar_correos())
            else:
                await procesar_correos()
                await procesar_correos()

        with patch.object(notifications.NotificationService, "configurado", return_value=True), \
                patch.object(notifications.NotificationService, "send_email", side_effect=guardar_correo, new_callable=AsyncMock):
            for tipo, cantidad in (("cita", 2), ("recordatorio_24h", 3), ("recordatorio_1h", 4)):
                with patch("correos_programados.datetime") as reloj:
                    reloj.now.return_value = horarios[tipo] + timedelta(seconds=1)
                    asyncio.run(ejecutar())
                self.assertEqual(len(enviados), cantidad, [item[0] for item in enviados])
        self.assertEqual(len({item[0] for item in enviados}), 4)
        self.assertTrue(all("11:30" in cuerpo for asunto, cuerpo in enviados if "bienvenida" not in asunto))

    def test_registro_edicion_y_cumpleanos(self):
        from correos_programados import procesar_correos

        email = "identidad-prueba@clinic.example"
        client = self.client()
        minimum_password = "A1b cdef"
        basic = {"correo": email, "contrasena": minimum_password, "nombre": "Registro", "apellido": "Ficticio"}
        identity = {"tipo_documento": "TI", "documento": "DOC-ID-PRUEBA", "fecha_nacimiento": "2000-02-29"}
        self.assertEqual(client.post("/auth/registro", json=basic).status_code, 422)
        self.assertEqual(client.post("/auth/registro", json={
            **basic, **identity, "fecha_nacimiento": "2999-01-01",
        }).status_code, 422)
        self.assertEqual(client.post("/auth/registro", json={
            **basic, **identity, "contrasena": minimum_password[:-1],
        }).status_code, 422)

        birthday = datetime(2027, 2, 28, 14, 5, tzinfo=timezone.utc)
        with patch("correos_programados.datetime", wraps=datetime) as clock:
            clock.now.return_value = birthday
            result = client.post("/auth/registro", json={**basic, **identity})
            self.assertEqual(result.status_code, 201, result.text)
            self.assertEqual(client.post("/auth/login", json={"correo": email, "contrasena": minimum_password}).status_code, 200)
            patient_id = result.json()["id_paciente"]
            path = f"/pacientes/{patient_id}"
            clinical_path = f"/historias-clinicas-detalladas/paciente/{patient_id}"
            with config.SessionLocal.begin() as db:
                db.add(models.Cita(
                    id_paciente=patient_id, id_odontologo=self.ids["perfil_doctor1"],
                    id_consultorio=self.office, fecha=date.today(), hora=time(17), estado="Finalizado",
                ))

            dentist = self.client("doctor1")
            self.assertEqual(self.client("doctor2").get(clinical_path).status_code, 403)
            for key, value in identity.items():
                self.assertEqual(client.get(path).json()[key], value)
                self.assertIsNone(dentist.get(path).json()[key])
                self.assertEqual(dentist.get(clinical_path).json()["paciente"][key], value)
            self.assertEqual(dentist.get("/pacientes/documento/DOC-ID-PRUEBA").status_code, 403)
            self.assertEqual(self.client("admin").put(path, json={"documento": "DOC-FALSO"}).status_code, 403)
            self.assertEqual(client.put(path, json={"eps": "Falsa"}).status_code, 403)
            self.assertEqual(dentist.put(path, json={"tipo_documento": "CC"}).status_code, 403)
            self.assertEqual(dentist.put(clinical_path, json={
                "id_paciente": patient_id, "datos_clinicos": {"consentimiento_cedula_paciente": "DOC-FALSO"},
            }).status_code, 403)
            result = dentist.put(clinical_path, json={
                "id_paciente": patient_id, "datos_clinicos": {"eps": "EPS Ficticia", "direccion": "Calle de prueba"},
            })
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()["paciente"]["eps"], "EPS Ficticia")
            self.assertEqual(client.put(path, json={"tipo_documento": "CC", "documento": "DOC-ID-NUEVO"}).status_code, 200)
            self.assertEqual(dentist.get(clinical_path).json()["paciente"]["documento"], "DOC-ID-NUEVO")

            with patch.object(notifications.NotificationService, "configurado", return_value=True), \
                    patch.object(notifications.NotificationService, "send_email", new_callable=AsyncMock, return_value=True) as sender:
                clock.now.return_value = birthday - timedelta(minutes=6)
                asyncio.run(procesar_correos())
                self.assertFalse(any("cumpleaños" in args[1] for args, _ in sender.call_args_list if args[0] == email))
                clock.now.return_value = birthday
                asyncio.run(procesar_correos())
                self.assertEqual(client.put(path, json={"fecha_nacimiento": "2000-02-28"}).status_code, 200)
                asyncio.run(procesar_correos())
                clock.now.return_value = datetime(2028, 2, 28, 14, 5, tzinfo=timezone.utc)
                asyncio.run(procesar_correos())
                greetings = [args for args, _ in sender.call_args_list if args[0] == email and "cumpleaños" in args[1]]
                self.assertEqual(len(greetings), 2)
                self.assertTrue(all("OdontoSoft" in args[1] and "DOC-ID" not in args[2] for args in greetings))

    def test_booking_alternative_uses_free_slots_without_exposing_other_agendas(self):
        future = date.today() + timedelta(days=14)
        doctor1, doctor2 = self.ids["perfil_doctor1"], self.ids["perfil_doctor2"]
        racer = self.ids["perfil_racer"]
        with config.SessionLocal.begin() as db:
            db.get(models.Odontologo, doctor1).especialidad = "Odontología general"
            db.get(models.Odontologo, doctor2).especialidad = "Odontologia general"
            office = models.Consultorio(nombre="Consultorio alternativo ficticio")
            db.add(office)
            db.add(models.Usuario(
                correo="alternativo@clinic.example", contrasena=hash_password(PASSWORD),
                rol="Odontologo", estado="Activo",
            ))
            db.flush()
            other = models.Odontologo(
                nombre="Alternativo", apellido="Prueba", documento="alternativo",
                correo="alternativo@clinic.example", especialidad="Ortodoncia",
                id_consultorio=office.id_consultorio,
            )
            db.add(other)
            db.flush()
            doctor3 = other.id_odontologo
            db.add_all([
                models.Cita(
                    id_paciente=self.ids["perfil_patient1"], id_odontologo=doctor1,
                    id_consultorio=self.office, fecha=future, hora=time(8), estado="Confirmada", duracion_minutos=60,
                ),
                models.Cita(
                    id_paciente=racer, id_odontologo=doctor3, id_consultorio=office.id_consultorio,
                    fecha=future, hora=time(9), estado="Confirmada", duracion_minutos=30,
                ),
            ])

        patient = self.client("racer")
        url = "/citas/disponibilidad/alternativa"
        requested = {"odontologo_id": doctor1, "fecha": future.isoformat(), "hora": "08:00"}
        self.assertEqual(self.client().get(url, params=requested).status_code, 401)
        self.assertEqual(self.client("doctor1").get(url, params=requested).status_code, 403)
        info = patient.get(f"/citas/disponibilidad/odontologo/{doctor2}", params={
            "fecha": future.isoformat(), "hora": "08:30", "id_tratamiento": 1,
        })
        self.assertEqual(info.status_code, 200)
        self.assertEqual(set(info.json()), {"horarios", "hora_disponible", "duracion_minutos"})
        self.assertFalse(info.json()["hora_disponible"])
        self.assertNotIn("09:00", info.json()["horarios"])
        self.assertIn("09:30", info.json()["horarios"])

        first = patient.get(url, params=requested)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual((first.json()["id_odontologo"], first.json()["hora"]), (doctor3, "08:00"))
        response = patient.get(url, params={**requested, "id_tratamiento": 1})
        self.assertEqual(response.status_code, 200, response.text)
        alternative = response.json()
        self.assertEqual(set(alternative), {"id_odontologo", "odontologo", "consultorio", "fecha", "hora"})
        self.assertEqual((alternative["id_odontologo"], alternative["fecha"], alternative["hora"]),
                         (doctor2, requested["fecha"], "09:30"))
        quarter_hour = patient.get(url, params={**requested, "hora": "09:45", "id_tratamiento": 1}).json()
        self.assertEqual(quarter_hour["hora"], "09:45")
        self.assertIsNone(patient.get(url, params={
            **requested, "odontologo_id": doctor3, "id_tratamiento": 1,
        }).json())

        doctor = self.client("doctor2")
        self.assertEqual(doctor.get(f"/citas/odontologo/{doctor1}").status_code, 403)
        shared_office = doctor.get(f"/citas/consultorio/{self.office}")
        self.assertEqual(shared_office.status_code, 200)
        self.assertTrue(all(item["id_odontologo"] == doctor2 for item in shared_office.json()))
        self.assertEqual(patient.get(f"/citas/odontologo/{doctor2}").status_code, 403)
        booking = patient.post("/citas/reservar/paciente", json={
            "id_usuario": self.ids["racer"], "id_odontologo": alternative["id_odontologo"],
            "fecha": alternative["fecha"], "hora": alternative["hora"], "id_tratamiento": 1,
        })
        self.assertEqual(booking.status_code, 201, booking.text)
        self.assertEqual(booking.json()["id_odontologo"], doctor2)
        self.assertEqual(booking.json()["id_paciente"], racer)

    def test_breaks_vacations_and_closing_hours_apply_to_private_agenda(self):
        first = date.today() + timedelta(days=25)
        second, third, fourth = (first + timedelta(days=offset) for offset in (1, 2, 3))
        doctor_id = self.ids["perfil_doctor1"]
        with config.SessionLocal.begin() as db:
            for key in ("perfil_doctor1", "perfil_doctor2"):
                db.get(models.Odontologo, self.ids[key]).especialidad = "Odontología general"
        dentist = self.client("doctor1")
        other = self.client("doctor2")
        patient = self.client("racer")
        rules = "/bloqueos-agenda"
        days = f"/citas/disponibilidad/odontologo/{doctor_id}"
        daily = {"tipo": "descanso_diario", "hora_desde": "14:00", "hora_hasta": "15:00"}
        saved = dentist.post(rules, json=daily)
        self.assertEqual(saved.status_code, 201, saved.text)
        saved_path = f"{rules}/{saved.json()['id_bloqueo']}"
        self.assertEqual(dentist.post(rules, json=daily).status_code, 409)
        self.assertEqual(other.get(rules).json(), [])
        self.assertEqual(other.put(saved_path, json=daily).status_code, 404)
        self.assertEqual(other.delete(saved_path).status_code, 404)
        self.assertEqual(patient.get(rules).status_code, 403)
        self.assertEqual(patient.post(rules, json=daily).status_code, 403)

        def available(day, hour):
            result = patient.get(days, params={"fecha": day.isoformat(), "hora": hour, "id_tratamiento": 1})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(set(result.json()), {"horarios", "hora_disponible", "duracion_minutos"})
            return result.json()

        def book(day, hour):
            return patient.post("/citas/reservar/paciente", json={
                "id_usuario": self.ids["racer"], "id_odontologo": doctor_id,
                "id_tratamiento": 1, "fecha": day.isoformat(), "hora": hour,
            })

        self.assertFalse(available(first, "13:45")["hora_disponible"])
        self.assertFalse(available(first, "14:00")["hora_disponible"])
        self.assertTrue(available(first, "15:00")["hora_disponible"])
        self.assertEqual(book(first, "14:00").status_code, 409)

        override = {
            "tipo": "descanso_puntual", "fecha_desde": second.isoformat(),
            "hora_desde": "15:00", "hora_hasta": "16:00",
        }
        result = dentist.post(rules, json=override)
        self.assertEqual(result.status_code, 201, result.text)
        override_path = f"{rules}/{result.json()['id_bloqueo']}"
        self.assertTrue(available(second, "14:00")["hora_disponible"])
        self.assertFalse(available(second, "15:00")["hora_disponible"])
        self.assertEqual(dentist.put(override_path, json={**override, "hora_hasta": "16:15"}).status_code, 200)
        self.assertFalse(available(second, "16:00")["hora_disponible"])
        booked = book(second, "14:00")
        self.assertEqual(booked.status_code, 201, booked.text)
        removal = dentist.delete(override_path)
        self.assertEqual(removal.status_code, 409, removal.text)
        self.assertIn("Reprograma", removal.json()["detail"])
        appointment = booked.json()["id_cita"]
        self.addCleanup(dentist.delete, f"/citas/{appointment}")
        self.assertEqual(dentist.put(f"/citas/{appointment}", json={"hora": "15:00"}).status_code, 409)
        self.assertEqual(dentist.get(f"/citas/{appointment}").json()["hora"][:5], "14:00")

        vacations = {"tipo": "vacaciones", "fecha_desde": third.isoformat(), "fecha_hasta": fourth.isoformat()}
        result = dentist.post(rules, json=vacations)
        self.assertEqual(result.status_code, 201, result.text)
        vacation_path = f"{rules}/{result.json()['id_bloqueo']}"
        for day in (third, fourth):
            self.assertEqual(available(day, "09:00")["horarios"], [])
            self.assertEqual(book(day, "09:00").status_code, 409)
        suggestion = patient.get("/citas/disponibilidad/alternativa", params={
            "odontologo_id": self.ids["perfil_doctor2"], "fecha": third.isoformat(), "hora": "17:45", "id_tratamiento": 1,
        })
        self.assertEqual(suggestion.status_code, 200)
        self.assertEqual(suggestion.json()["fecha"], (fourth + timedelta(days=1)).isoformat())
        self.assertEqual(suggestion.json()["hora"], "08:00")

        for hour in ("07:45", "17:45", "18:00"):
            self.assertFalse(available(first, hour)["hora_disponible"])
            self.assertEqual(book(first, hour).status_code, 422)
        closing = book(first, "17:30")
        self.assertEqual(closing.status_code, 201, closing.text)
        self.addCleanup(dentist.delete, f"/citas/{closing.json()['id_cita']}")
        self.assertEqual(dentist.delete(vacation_path).status_code, 204)
        self.assertTrue(available(third, "09:00")["hora_disponible"])
        self.assertEqual(dentist.delete(saved_path).status_code, 204)
        self.assertEqual(dentist.delete(override_path).status_code, 204)

    def test_lists_and_writes_are_scoped_to_owners_and_agenda(self):
        patient = self.client("patient1")
        dentist = self.client("doctor1")
        first = self.ids["perfil_patient1"]
        second = self.ids["perfil_patient2"]
        appointment = self.ids["patient1_doctor1"]
        self.assertEqual([item["id_paciente"] for item in patient.get("/pacientes/").json()], [first])
        self.assertEqual([item["id_paciente"] for item in dentist.get("/pacientes/").json()], [first])
        self.assertNotIn("contrasena_plano", patient.get(f"/pacientes/{first}").json())
        self.assertEqual(patient.get(f"/pacientes/{second}").status_code, 403)
        self.assertEqual(patient.get(f"/servicios/paciente/{second}").status_code, 403)
        self.assertEqual(patient.put(f"/pacientes/{first}", json={"alergias": "Cambio de prueba"}).status_code, 403)
        self.assertEqual(patient.put(f"/pacientes/{first}", json={"telefono": "3000000000"}).status_code, 200)
        self.assertEqual(dentist.get(f"/citas/odontologo/{self.ids['perfil_doctor2']}").status_code, 403)
        self.assertEqual(dentist.get(f"/citas/{self.ids['patient2_doctor2']}").status_code, 403)
        self.assertEqual(dentist.put(f"/citas/{appointment}", json={"id_paciente": second}).status_code, 403)
        self.assertEqual(dentist.put(f"/citas/{appointment}", json={"id_odontologo": self.ids["perfil_doctor2"]}).status_code, 403)
        self.assertEqual(dentist.put(f"/citas/{appointment}", json={"estado": "En Consulta"}).status_code, 200)
        future = (date.today() + timedelta(days=4)).isoformat()
        raw_appointment = {
            "id_paciente": second, "id_odontologo": self.ids["perfil_doctor1"],
            "id_consultorio": self.office, "fecha": future, "hora": "10:00",
        }
        self.assertEqual(dentist.post("/citas/", json=raw_appointment).status_code, 403)
        options = {"id_odontologo": self.ids["perfil_doctor1"], "fecha": future, "hora": "11:00"}
        self.assertEqual(patient.post("/citas/reservar/paciente", json={
            **options, "id_usuario": self.ids["patient2"],
        }).status_code, 403)
        success = patient.post("/citas/reservar/paciente", json={**options, "id_usuario": self.ids["patient1"]})
        self.assertEqual(success.status_code, 201, success.text)
        self.assertEqual(success.json()["id_paciente"], first)
        self.assertEqual(patient.delete(f"/citas/{success.json()['id_cita']}").status_code, 403)
        self.assertEqual(dentist.delete(f"/citas/{success.json()['id_cita']}").status_code, 200)

    def test_session_origin_revocation_and_expiration(self):
        client = self.client("revocable")
        token = client.cookies.get(COOKIE_NAME)
        self.assertEqual(client.get("/auth/me").status_code, 200)
        self.assertEqual(client.post("/auth/logout", headers={"Origin": "https://other.example"}).status_code, 403)
        self.assertEqual(client.get("/auth/me").status_code, 200)
        self.assertEqual(client.post("/auth/logout").status_code, 204)
        self.assertEqual(client.get("/auth/me", headers={"Cookie": f"{COOKIE_NAME}={token}"}).status_code, 401)
        client = self.client("revocable")
        with config.SessionLocal.begin() as db:
            session = db.query(models.SesionAcceso).filter_by(id_usuario=self.ids["revocable"]).one()
            self.assertNotEqual(session.token_hash, client.cookies.get(COOKIE_NAME))
            session.expira = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.assertEqual(client.get("/auth/me").status_code, 401)
        client = self.client("revocable")
        admin = self.client("admin")
        profile_only = admin.put(f"/usuarios/{self.ids['revocable']}", json={
            "nombre": "Perfil editado", "estado": "Activo", "rol": "Paciente", "correo": "revocable@clinic.example",
        })
        self.assertEqual(profile_only.status_code, 200, profile_only.text)
        self.assertEqual(client.get("/auth/me").status_code, 200)
        change = admin.put(f"/usuarios/{self.ids['revocable']}", json={"estado": "Inactivo"})
        self.assertEqual(change.status_code, 200, change.text)
        self.assertEqual(admin.put(f"/usuarios/{self.ids['revocable']}", json={"estado": "Activo"}).status_code, 200)
        self.assertEqual(client.get("/auth/me").status_code, 401)

    def test_mobile_session_only_accesses_consultorios(self):
        mobile = self.client()
        response = mobile.post("/auth/login/consultorios", json={"correo": "admin@clinic.example", "contrasena": PASSWORD})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(mobile.cookies.get(COOKIE_NAME))
        headers = {"Authorization": "Bearer " + response.json()["access_token"]}
        self.assertEqual(mobile.get("/consultorios/", headers=headers).status_code, 200)
        self.assertEqual(mobile.get("/pacientes/", headers=headers).status_code, 401)
        self.assertEqual(mobile.get("/usuarios/", headers=headers).status_code, 401)
        self.assertEqual(mobile.post("/auth/logout", headers=headers).status_code, 204)
        self.assertEqual(mobile.get("/consultorios/", headers=headers).status_code, 401)

    def test_removing_assignment_revokes_clinical_access(self):
        admin = self.client("admin")
        doctor = self.client("doctor2")
        second = self.ids["perfil_patient2"]
        endpoint = f"/odontogramas/paciente/{second}"
        self.assertEqual(doctor.get(endpoint).status_code, 200)
        appointment = self.ids["patient2_doctor2"]
        result = admin.put(f"/citas/{appointment}", json={"estado": "Cancelado"})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(doctor.get(endpoint).status_code, 403)
        self.assertEqual(doctor.put(f"/citas/{appointment}", json={"estado": "En Consulta"}).status_code, 403)
        self.assertEqual(admin.put(f"/citas/{appointment}", json={"estado": "Finalizado"}).status_code, 200)
        replacement = self.client("doctor1")
        self.assertEqual(replacement.get(endpoint).status_code, 403)
        handoff = admin.put(f"/citas/{appointment}", json={"id_odontologo": self.ids["perfil_doctor1"]})
        self.assertEqual(handoff.status_code, 200, handoff.text)
        self.assertEqual(doctor.get(endpoint).status_code, 403)
        self.assertEqual(replacement.get(endpoint).status_code, 200)

    def test_legacy_password_upgrades_only_after_successful_login(self):
        legacy = "ClaveAntigua"
        weak_hash = hashlib.sha256(legacy.encode()).hexdigest()
        with config.SessionLocal.begin() as db:
            db.get(models.Usuario, self.ids["legacy"]).contrasena = weak_hash

        client = self.client()
        failure = client.post("/auth/login", json={"correo": "legacy@clinic.example", "contrasena": "otra-clave"})
        unknown = client.post("/auth/login", json={"correo": "desconocido@clinic.example", "contrasena": "otra-clave"})
        self.assertEqual(failure.status_code, 401)
        self.assertEqual(failure.json(), unknown.json())
        with config.SessionLocal() as db:
            self.assertEqual(db.get(models.Usuario, self.ids["legacy"]).contrasena, weak_hash)
        login = client.post("/auth/login", json={"correo": "legacy@clinic.example", "contrasena": legacy})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(client.get("/auth/me").status_code, 200)
        with config.SessionLocal() as db:
            encoded = db.get(models.Usuario, self.ids["legacy"]).contrasena
            self.assertTrue(encoded.startswith("$argon2id$"))
            self.assertTrue(verificar_password(legacy, encoded))

    def test_recovery_uses_hashed_single_use_tokens_and_unlocks_affected_accounts(self):
        with config.SessionLocal.begin() as db:
            db.get(models.Usuario, self.ids["forced"]).requiere_restablecer_contrasena = True
        client = self.client()
        blocked = client.post("/auth/login", json={"correo": "forced@clinic.example", "contrasena": PASSWORD})
        self.assertEqual(blocked.status_code, 403)
        self.assertIsNone(client.cookies.get(COOKIE_NAME))
        with patch.object(notifications.NotificationService, "enviar_reset_password") as mail:
            request = {"correo": "forced@clinic.example"}
            first = client.post("/auth/solicitar-reset", json=request)
            repeated = client.post("/auth/solicitar-reset", json=request)
            unknown = client.post("/auth/solicitar-reset", json={"correo": "desconocido@clinic.example"})
            self.assertEqual(first.status_code, 200)
            self.assertEqual(first.json(), repeated.json())
            self.assertEqual(first.json(), unknown.json())
            self.assertEqual(mail.call_count, 1)
            raw_token = mail.call_args.args[2]
        with config.SessionLocal() as db:
            record = db.query(models.PasswordResetToken).filter_by(id_usuario=self.ids["forced"]).one()
            self.assertEqual(record.token, digest(raw_token))
            self.assertNotEqual(record.token, raw_token)
            expiry = record.fecha_expiracion

        new_password = "  Una clave extensa y única 🙂  "
        self.assertEqual(client.post("/auth/reset-password", json={"token": raw_token, "nueva_contrasena": "corta"}).status_code, 422)
        same = client.post("/auth/reset-password", json={"token": raw_token, "nueva_contrasena": PASSWORD})
        self.assertEqual(same.status_code, 400)
        self.assertIn("distinta", same.json()["detail"])
        payload = {"token": raw_token, "nueva_contrasena": new_password}
        with patch("routers.password_reset.utc_now", return_value=expiry):
            self.assertEqual(client.post("/auth/reset-password", json=payload).status_code, 400)
        result = client.post("/auth/reset-password", json=payload)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(client.post("/auth/reset-password", json=payload).status_code, 400)
        with config.SessionLocal() as db:
            user = db.get(models.Usuario, self.ids["forced"])
            self.assertFalse(user.requiere_restablecer_contrasena)
            self.assertTrue(verificar_password(new_password, user.contrasena))
            self.assertFalse(verificar_password(new_password.strip(), user.contrasena))
            self.assertNotEqual(hash_password(new_password), user.contrasena)
        self.assertEqual(client.post("/auth/login", json={"correo": "forced@clinic.example", "contrasena": PASSWORD}).status_code, 401)
        self.assertEqual(client.post("/auth/login", json={"correo": "forced@clinic.example", "contrasena": new_password}).status_code, 200)

    def test_admin_password_change_revokes_sessions_and_pending_links(self):
        target = self.client("patient2")
        admin = self.client("admin")
        with patch.object(notifications.NotificationService, "enviar_reset_password") as mail:
            self.assertEqual(target.post("/auth/solicitar-reset", json={"correo": "patient2@clinic.example"}).status_code, 200)
            token = mail.call_args.args[2]
        user_url = f"/usuarios/{self.ids['patient2']}"
        self.assertEqual(admin.put(user_url, json={"contrasena": "               "}).status_code, 422)
        patient = self.ids["perfil_patient2"]
        self.assertEqual(admin.put(f"/pacientes/{patient}", json={"contrasena_plano": PASSWORD}).status_code, 422)
        new_password = "Nueva clave de prueba única"
        self.assertEqual(admin.put(user_url, json={"contrasena": new_password}).status_code, 200)
        self.assertEqual(target.get("/auth/me").status_code, 401)
        self.assertEqual(target.post("/auth/reset-password", json={"token": token, "nueva_contrasena": PASSWORD}).status_code, 400)
        self.assertEqual(target.post("/auth/login", json={"correo": "patient2@clinic.example", "contrasena": new_password}).status_code, 200)


if __name__ == "__main__":
    try:
        unittest.main()
    finally:
        config.engine.dispose()
