import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api.js";
import { Toast, useToast } from "./authUi.jsx";
import { getUser, normalizeRole, signOut } from "./session.js";
import { AgendaIcon } from "./agendaIcons.jsx";
import * as agenda from "./agenda.js";
import Reservation from "./Reservation.jsx";
import { BirthDate, DocumentType } from "./patientIdentity.jsx";

function validPhone(value) {
  return /^[0-9+\-\s]{7,15}$/.test(value);
}

function EmptyRow({ text, loading = false }) {
  return <tr><td colSpan={4} style={{ textAlign: "center", padding: loading ? 30 : 20, color: "var(--text-muted)" }}>{text}</td></tr>;
}

function ServiceRows({ values }) {
  if (!values?.length) return <EmptyRow text={values ? "No hay servicios registrados" : "Cargando..."} loading={!values} />;
  return values.map((item, index) => <tr key={item.id_servicio ?? index}>
    <td><strong>{item.tratamiento_nombre || "Tratamiento #" + item.id_tratamiento}</strong></td>
    <td>{item.odontologo_nombre || item.id_odontologo || "—"}</td><td>{item.proxima_cita || "Por definir"}</td>
    <td><span className={"badge " + (item.estado_cuenta === "Pagado" ? "green" : "yellow")}>{item.estado_cuenta || "Pendiente"}</span></td>
  </tr>);
}

function AppointmentRows({ values, error }) {
  if (error || !values?.length) return <EmptyRow text={error ? "Error al cargar citas" : values ? "No hay citas registradas" : "Cargando..."} loading={!values && !error} />;
  return values.map((item) => <tr key={item.id_cita}>
    <td>{agenda.treatment(item)}</td>
    <td>{item.odontologo ? item.odontologo.nombre + " " + item.odontologo.apellido : "Odontólogo #" + item.id_odontologo}</td>
    <td>{item.fecha || "—"} {item.hora || ""}</td>
    <td><span className={"agenda-badge " + agenda.tone(item)}>{item.estado || "Pendiente"}</span></td>
  </tr>);
}

export default function PatientDashboard({ navigate }) {
  const user = getUser();
  const role = normalizeRole(user?.rol);
  const email = user?.correo;
  const [patient, setPatient] = useState(null);
  const [services, setServices] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [listError, setListError] = useState(false);
  const [tab, setTab] = useState("servicios");
  const [changedTab, setChangedTab] = useState(false);
  const [editing, setEditing] = useState(null);
  const [validatingPhone, setValidatingPhone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reservation, setReservation] = useState(false);
  const [message, showToast] = useToast(3500);
  const trigger = useRef(null);
  const patientKey = patient?.id_paciente;
  const listRequest = useRef(null);

  const loadAppointments = useCallback(async (id) => {
    listRequest.current?.abort();
    const abort = new AbortController();
    listRequest.current = abort;
    try {
      const values = await request("/citas/paciente/" + id, { signal: abort.signal });
      setAppointments(values.sort(agenda.order));
      setListError(false);
    } catch {
      if (!abort.signal.aborted) setListError(true);
    }
  }, []);

  useEffect(() => {
    if (role !== "paciente") {
      navigate(!user ? "/login" : role === "odontologo" ? "/panel_odontologo" : "/panel", { replace: true });
      return;
    }
    const abort = new AbortController();
    const options = { signal: abort.signal };
    async function load() {
      try {
        const people = await request("/pacientes", options);
        const profile = people.find((entry) => entry.correo === email) ?? (people.length === 1 ? people[0] : null);
        if (!profile) {
          showToast("❌ No se encontró el perfil del paciente", "error");
          return;
        }
        setPatient(profile);
        const rows = await request("/servicios/paciente/" + profile.id_paciente, options).catch(() => []);
        if (!abort.signal.aborted) setServices(rows);
      } catch {
        if (!abort.signal.aborted) showToast("❌ Error al cargar el perfil", "error");
      }
    }
    load();
    return () => abort.abort();
  }, [role, Boolean(user), email, navigate, showToast]);

  useEffect(() => {
    if (!patientKey) return;
    loadAppointments(patientKey);
    return () => listRequest.current?.abort();
  }, [patientKey, loadAppointments]);

  useEffect(() => {
    if (!patientKey || reservation) return;
    const timer = setInterval(() => {
      if (!document.hidden) loadAppointments(patientKey);
    }, 15000);
    return () => clearInterval(timer);
  }, [patientKey, reservation, loadAppointments]);

  function switchTab(value, event) {
    event?.preventDefault();
    setChangedTab(true);
    setTab(value);
  }
  function edit() {
    if (!patient) {
      showToast("❌ No hay perfil para editar", "error");
      return;
    }
    setValidatingPhone(false);
    setEditing({
      nombre: patient.nombre || "", apellido: patient.apellido || "", telefono: patient.telefono || "",
      tipo_documento: patient.tipo_documento || "", documento: patient.documento || "",
      fecha_nacimiento: patient.fecha_nacimiento || "",
    });
  }
  function bind(field) {
    return {
      value: editing?.[field] ?? "",
      onChange: (event) => {
        const value = event.target.value;
        if (field === "telefono") setValidatingPhone(true);
        setEditing((form) => form ? { ...form, [field]: value } : form);
      },
    };
  }
  async function save(event) {
    if (!editing || saving) return;
    const nombre = editing.nombre.trim();
    const apellido = editing.apellido.trim();
    const telefono = editing.telefono.trim();
    const documento = editing.documento.trim();
    const { tipo_documento, fecha_nacimiento } = editing;
    const issue = !nombre ? ["👤 Por favor, ingresa tu nombre", "#inNombre", "warning"]
      : !apellido ? ["👤 Por favor, ingresa tu apellido", "#inApellido", "warning"]
      : !telefono ? ["📱 Por favor, ingresa tu teléfono", "#inTelefono", "warning"]
      : !validPhone(telefono) ? ["📱 Ingresa un número de teléfono válido", "#inTelefono", "error"]
      : !documento ? ["Ingresa el número de documento", "#inDocumento", "warning"]
      : patient.tipo_documento && !tipo_documento ? ["Selecciona el tipo de documento", "#inTipoDocumento", "warning"]
      : (patient.fecha_nacimiento && !fecha_nacimiento) || fecha_nacimiento > agenda.today()
        ? ["Ingresa una fecha de nacimiento válida", "#inFechaNacimiento", "warning"] : null;
    if (issue) {
      showToast(issue[0], issue[2]);
      event.currentTarget.closest(".modal").querySelector(issue[1]).focus();
      return;
    }
    setSaving(true);
    try {
      const profile = await request("/pacientes/" + patientKey, { method: "PUT",
        body: {
          nombre, apellido, telefono, documento,
          ...(tipo_documento ? { tipo_documento } : {}),
          ...(fecha_nacimiento ? { fecha_nacimiento } : {}),
        },
      });
      setPatient(profile);
      showToast("✅ Perfil actualizado correctamente");
      setEditing(null);
    } catch (error) {
      showToast("❌ " + (error.message || "Error al guardar"), "error");
    } finally {
      setSaving(false);
    }
  }

  function openReservation(event) {
    if (!patient) {
      showToast("Espera a que cargue tu perfil", "warning");
      return;
    }
    trigger.current = event.currentTarget;
    setReservation(true);
  }
  const closeReservation = useCallback(() => {
    setReservation(false);
    trigger.current?.focus();
  }, []);

  async function booked() {
    closeReservation();
    switchTab("citas");
    await loadAppointments(patientKey);
    showToast("Tu cita fue agendada correctamente.");
  }

  if (role !== "paciente") return null;
  const invalidPhone = Boolean(validatingPhone && editing?.telefono.trim() && !validPhone(editing.telefono.trim()));
  return (
    <>
      {"\n\n"}
      <Toast message={message} />
      {"\n\n"}
      {"\n"}
      <div id="modalEditarPerfil" className={"modal-overlay" + (editing ? " open" : "")}>
        {"\n    "}
        <div className={"modal"}>
          {"\n        "}
          <h3>
            {"\n            "}
            <AgendaIcon name="edit" />
            {"\n            Editar Perfil\n        "}
          </h3>
          {"\n        "}
          <input type={"hidden"} id="editPacienteId" value={editing ? patientKey : ""} />
          {"\n\n        "}
          <div className="form-group">
            <label htmlFor="inTipoDocumento">Tipo de documento</label>
            <DocumentType id="inTipoDocumento" {...bind("tipo_documento")} />
          </div>
          <div className="form-group">
            <label htmlFor="inDocumento">Número de documento <span className="required">*</span></label>
            <input id="inDocumento" type="text" maxLength={20} required {...bind("documento")} />
          </div>
          <div className="form-group">
            <label htmlFor="inFechaNacimiento">Fecha de nacimiento</label>
            <BirthDate id="inFechaNacimiento" {...bind("fecha_nacimiento")} />
          </div>
          <div className={"form-group"}>
            {"\n            "}
            <label>
              {"Nombre "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n            "}
            <input type={"text"} id="inNombre" {...bind("nombre")} placeholder={"Nombre"} />
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>
              {"Apellido "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n            "}
            <input type={"text"} id="inApellido" {...bind("apellido")} placeholder={"Apellido"} />
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>
              {"Teléfono "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n            "}
            <input type={"tel"} id="inTelefono" {...bind("telefono")} className={invalidPhone ? "input-error" : ""} placeholder={"3001234567"} />
            {"\n            "}
            <small id="telefonoError" className={"error-message" + (invalidPhone ? " show" : "")}>{"Ingresa un número de teléfono válido"}</small>
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>{"Correo Electrónico"}</label>
            {"\n            "}
            <input type={"email"} id="inCorreo" value={editing ? patient?.correo || "" : ""} placeholder={"correo@ejemplo.com"} disabled />
            {"\n            "}
            <small style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>{"El correo no se puede modificar"}</small>
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"modal-footer"}>
            {"\n            "}
            <button className={"btn-cancelar"} onClick={() => setEditing(null)}>{"Cancelar"}</button>
            {"\n            "}
            <button className="btn-guardar" id="btnGuardarPerfil" onClick={save} disabled={saving}>
              <AgendaIcon name={saving ? "progress_activity" : "save"} /> {saving ? "Guardando..." : "Guardar"}
            </button>
            {"\n        "}
          </div>
          {"\n    "}
        </div>
        {"\n"}
      </div>
      {"\n\n"}
      {"\n"}
      <div className={"dashboard-container"}>
        {"\n    "}
        <aside className={"sidebar"} style={{ backgroundColor: "#1e293b" }}>
          {"\n        "}
          <div className={"sidebar-brand"}>
            {"\n            "}
            <AgendaIcon name="account_circle" />
            {"\n            "}
            <span>{"Paciente"}</span>
            {"\n        "}
          </div>
          {"\n        "}
          <nav className={"sidebar-menu"}>
            {"\n            "}
            <a href={"#"} id="menuServicios" className={tab === "servicios" ? "active" : ""} onClick={(event) => switchTab("servicios", event)}>
              {"\n                "}
              <AgendaIcon name="medical_information" />
              {" Mis Servicios\n            "}
            </a>
            {"\n            "}
            <a href={"#"} id="menuCitas" className={tab === "citas" ? "active" : ""} onClick={(event) => switchTab("citas", event)}>
              {"\n                "}
              <AgendaIcon name="calendar_month" />
              {" Mis Citas\n            "}
            </a>
            {"\n            "}
            <a href="/mi-tratamiento"><AgendaIcon name="dentistry" /> Mi tratamiento</a>
            <a href="/facturacion"><AgendaIcon name="receipt_long" /> Facturación</a>
            <a href="/contacto">
              {"\n                "}
              <AgendaIcon name="support_agent" />
              {" Soporte\n            "}
            </a>
            {"\n            "}
            <a href="/login" onClick={signOut}>
              {"\n                "}
              <AgendaIcon name="logout" />
              {" Cerrar Sesión\n            "}
            </a>
            {"\n        "}
          </nav>
          {"\n    "}
        </aside>
        {"\n\n    "}
        <main className={"main-content"}>
          {"\n        "}
          <header className={"content-header"}>
            {"\n            "}
            <div>
              {"\n                "}
              <h2 id="tituloSeccion">{tab === "servicios" ? "Mis Servicios" : "Mis Citas"}</h2>
              {"\n                "}
              <p id={"subtituloSeccion"} style={{ color: "var(--text-muted)" }}>{!changedTab ? "Consulta tus servicios y citas" : tab === "servicios" ? "Consulta tus servicios adquiridos" : "Consulta tus citas programadas"}</p>
              {"\n            "}
            </div>
            {"\n            "}
            {"\n            "}
            {"\n            "}
            {"\n            "}
            <button className={"agenda-btn primary"} id="btnAbrirReserva" disabled={!patient} onClick={openReservation}>
              <AgendaIcon name="add" />
              {" Agendar cita"}
            </button>
            {"\n            "}
            <button className={"btn-perfil-header"} onClick={edit}>
              {"\n                "}
              <AgendaIcon name="person" />
              {" Mi Perfil\n            "}
            </button>
            {"\n        "}
          </header>
          {"\n\n        "}
          {"\n        "}
          <div className={"tabs"}>
            {"\n            "}
            <button className={"tab-btn" + (tab === "servicios" ? " active" : "")} data-tab="servicios" onClick={() => switchTab("servicios")}>
              {"\n                "}
              <AgendaIcon name="medical_information" />
              {" Mis Servicios\n            "}
            </button>
            {"\n            "}
            <button className={"tab-btn" + (tab === "citas" ? " active" : "")} data-tab="citas" onClick={() => switchTab("citas")}>
              {"\n                "}
              <AgendaIcon name="calendar_month" />
              {" Mis Citas\n            "}
            </button>
            {"\n        "}
          </div>
          {"\n\n        "}
          {"\n        "}
          <div id="tabServicios" className={"tab-content" + (tab === "servicios" ? " active" : "")}>
            {"\n            "}
            <h3 style={{ marginBottom: "16px", fontSize: "1rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{"\n                📋 Servicios Adquiridos\n            "}</h3>
            {"\n            "}
            <section className={"table-container"}>
              {"\n                "}
              <table>
                {"\n                    "}
                <thead>
                  {"\n                        "}
                  <tr>
                    {"\n                            "}
                    <th>{"Servicio"}</th>
                    {"\n                            "}
                    <th>{"Odontólogo"}</th>
                    {"\n                            "}
                    <th>{"Próxima Cita"}</th>
                    {"\n                            "}
                    <th>{"Estado de Cuenta"}</th>
                    {"\n                        "}
                  </tr>
                  {"\n                    "}
                </thead>
                {"\n                    "}
                <tbody id={"tablaServicios"}><ServiceRows values={services} /></tbody>
                {"\n                "}
              </table>
              {"\n            "}
            </section>
            {"\n        "}
          </div>
          {"\n\n        "}
          {"\n        "}
          <div id="tabCitas" className={"tab-content" + (tab === "citas" ? " active" : "")}>
            <section className={"reserva-banner"}>
              <div>
                <div className={"agenda-eyebrow"}>{"CUIDA TU SONRISA"}</div>
                <h3>{"Tu próxima cita empieza aquí"}</h3>
                <p>{"Reserva una valoración inicial o el tratamiento que necesitas."}</p>
              </div>
              <button className={"agenda-btn primary"} onClick={openReservation}>{"Agendar una cita"}</button>
            </section>
            {"\n            "}
            <h3 style={{ marginBottom: "16px", fontSize: "1rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{"\n                📅 Mis Citas\n            "}</h3>
            {"\n            "}
            <section className={"table-container"}>
              {"\n                "}
              <table>
                {"\n                    "}
                <thead>
                  {"\n                        "}
                  <tr>
                    {"\n                            "}
                    <th>{"Tratamiento"}</th>
                    {"\n                            "}
                    <th>{"Odontólogo"}</th>
                    {"\n                            "}
                    <th>{"Fecha y Hora"}</th>
                    {"\n                            "}
                    <th>{"Estado"}</th>
                    {"\n                        "}
                  </tr>
                  {"\n                    "}
                </thead>
                {"\n                    "}
                <tbody id={"tablaCitas"}><AppointmentRows values={appointments} error={listError} /></tbody>
                {"\n                "}
              </table>
              {"\n            "}
            </section>
            {"\n        "}
          </div>
          {"\n    "}
        </main>
        {"\n"}
      </div>
      {"\n\n"}
      {reservation && <Reservation user={user} close={closeReservation} booked={booked} />}
    </>
  );
}
