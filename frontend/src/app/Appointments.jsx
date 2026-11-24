import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api.js";
import { Toast, useToast } from "./authUi.jsx";
import { AgendaIcon } from "./agendaIcons.jsx";
import { Calendar } from "./Calendar.jsx";
import { AgendaBlocks } from "./AgendaBlocks.jsx";
import { VoiceField } from "./VoiceField.jsx";
import { getUser, normalizeRole, signOut } from "./session.js";
import * as agenda from "./agenda.js";

const emptyData = { treatments: [], appointments: [], patients: [], doctors: [], offices: [] };
const filtersDefault = { year: "", month: "", date: "" };
const stateColors = { "En Espera": "yellow", "En Consulta": "blue", Finalizado: "green", Cancelado: "red" };

function person(list, key, id) {
  return list.find((entry) => Number(entry[key]) === Number(id));
}

function nameOf(entry) {
  return entry ? entry.nombre + " " + entry.apellido : "—";
}

function treatmentsOf(item) {
  return item?.tratamientos?.map(({ nombre }) => nombre).join(" · ") || "—";
}

function Options({ values, id, label, empty, emptyValue = "" }) {
  return values.length ? values.map((item) => <option key={item[id]} value={item[id]}>{label(item)}</option>)
    : <option value={emptyValue}>{empty}</option>;
}

function AppointmentRows({ entries, data, dentist, edit, remove, attend }) {
  if (!entries?.length) return (
    <tr><td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
      {entries ? "No hay citas para los filtros seleccionados" : "Cargando..."}
    </td></tr>
  );
  return entries.map((item) => {
    const patient = person(data.patients, "id_paciente", item.id_paciente);
    const doctor = person(data.doctors, "id_odontologo", item.id_odontologo);
    const state = item.estado || "Pendiente";
    return <tr key={item.id_cita}>
      <td><strong>{nameOf(patient)}</strong><span className="subtext">{patient?.correo || "—"}</span></td>
      <td><strong>{nameOf(doctor)}</strong><span className="subtext">{doctor?.correo || "—"}</span></td>
      <td>{treatmentsOf(item)}</td><td>{item.fecha} {item.hora}</td>
      <td><span className={"badge " + (stateColors[state] || "blue")}>{state}</span></td>
      <td className="acciones-cita">
        <div className="acciones-secundarias">
          <button className="btn-icon" title="Editar" onClick={() => edit(item.id_cita)}><AgendaIcon name="edit" /></button>
          <button className="btn-danger" title="Eliminar" onClick={() => remove(item)}><AgendaIcon name="delete" /></button>
        </div>
        {dentist && state === "En Consulta" && <button className="btn-atender-cita" title="Atender esta cita" onClick={() => attend(item)}><AgendaIcon name="stethoscope" /> Atender</button>}
      </td>
    </tr>;
  });
}

export default function Appointments({ navigate }) {
  const user = getUser();
  const role = normalizeRole(user?.rol);
  const authorized = Boolean(user) && role !== "paciente";
  const dentist = role === "odontologo";
  const email = user?.correo;
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deletion, setDeletion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");
  const [filters, setFilters] = useState(filtersDefault);
  const [message, showToast] = useToast(3500);
  const opener = useRef(null);
  const closer = useRef(null);
  const liveRequest = useRef(null);
  const catalog = data ?? emptyData;
  const years = [...new Set(catalog.appointments.map((item) => String(item.fecha || "").slice(0, 4)).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const entries = data ? catalog.appointments.filter((item) => {
    const date = String(item.fecha || "").slice(0, 10);
    return date && (!filters.date || date === filters.date)
      && (!filters.year || date.slice(0, 4) === filters.year) && (!filters.month || date.slice(5, 7) === filters.month);
  }) : null;
  const name = (id) => nameOf(person(catalog.patients, "id_paciente", id));

  const load = useCallback(async () => {
    liveRequest.current?.abort();
    const abort = new AbortController();
    liveRequest.current = abort;
    const options = { signal: abort.signal };
    try {
      const [treatments, appointments, patients, offices, doctors] = await Promise.all(
        ["/tratamientos", "/citas", "/pacientes", "/consultorios", "/odontologos"].map((path) => request(path, options)),
      );
      const matching = dentist ? doctors.filter((entry) => entry.correo === email) : [];
      const assigned = matching.length === 1 ? matching[0] : null;
      if (abort.signal.aborted) return;
      setData({ treatments, patients, offices,
        doctors: dentist ? assigned ? [assigned] : [] : doctors,
        appointments: dentist ? assigned ? appointments.filter((item) => Number(item.id_odontologo) === Number(assigned.id_odontologo)) : [] : appointments,
      });
    } catch (error) {
      if (!abort.signal.aborted) showToast(error.message, "error");
    }
  }, [dentist, email, showToast]);

  useEffect(() => {
    if (!authorized) {
      navigate(user ? "/panel_cliente" : "/login", { replace: true });
      return;
    }
    load();
    return () => liveRequest.current?.abort();
  }, [authorized, Boolean(user), navigate, load]);

  const modalOpen = Boolean(form || deletion);
  useEffect(() => {
    if (!authorized || modalOpen) return;
    const interval = setInterval(() => { if (!document.hidden) load(); }, 15000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, [authorized, modalOpen, load]);

  const closeDetail = useCallback(() => {
    setDetail(null);
    opener.current?.focus();
  }, []);
  useEffect(() => {
    if (!detail) return;
    closer.current?.focus();
    const escape = (event) => { if (event.key === "Escape") closeDetail(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [detail, closeDetail]);

  function openDetail(item, button) {
    opener.current = button;
    setDetail(item);
  }

  function openForm(date = "", dentistId = "") {
    const doctor = (dentistId ? person(catalog.doctors, "id_odontologo", dentistId) : null) || catalog.doctors[0];
    const treatment = catalog.treatments[0];
    setFormError("");
    setForm({
      id: null, patient: String(catalog.patients[0]?.id_paciente ?? ""), doctor: String(doctor?.id_odontologo ?? ""),
      treatment: String(treatment?.id_tratamiento ?? ""), office: String(doctor?.id_consultorio ?? catalog.offices[0]?.id_consultorio ?? 1),
      date, hour: "", duration: String(agenda.duration(treatment)), state: "En Espera", reason: "", notes: "",
    });
  }

  async function edit(id) {
    try {
      const item = await request("/citas/" + id);
      setFormError("");
      setForm({
        id: item.id_cita, patient: String(item.id_paciente), doctor: String(item.id_odontologo),
        treatment: String(item.tratamientos?.[0]?.id_tratamiento ?? ""), office: String(item.id_consultorio),
        date: item.fecha, hour: agenda.time(item), duration: String(item.duracion_minutos || 30),
        state: item.estado, reason: item.motivo_consulta || "", notes: item.observaciones || "",
      });
    } catch {
      showToast("❌ Error al cargar la cita", "error");
    }
  }

  function update(field, value) {
    setFormError("");
    setForm((current) => {
      if (!current) return current;
      if (field === "doctor") {
        const doctor = person(catalog.doctors, "id_odontologo", value);
        return { ...current, doctor: value, office: String(doctor?.id_consultorio ?? current.office) };
      }
      if (field === "treatment") {
        const treatment = person(catalog.treatments, "id_tratamiento", value);
        return { ...current, treatment: value, duration: String(agenda.duration(treatment)) };
      }
      return { ...current, [field]: value };
    });
  }

  function bind(field, defaultValue = "") {
    return { value: form?.[field] ?? defaultValue, onChange: (event) => update(field, event.target.value) };
  }

  async function save() {
    if (!form || saving) return;
    const { id, patient, doctor, office, treatment, date, hour, duration, state, reason, notes } = form;
    if (!Number(patient) || !Number(doctor) || !Number(office) || !Number(treatment) || !date || !hour) {
      setFormError("Completa paciente, odontólogo, tratamiento, consultorio, fecha y hora.");
      return;
    }
    const length = Number(duration);
    if (!Number.isInteger(length) || length < 5 || length > 480) {
      setFormError("La duración debe estar entre 5 y 480 minutos.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await request(id ? "/citas/" + id : "/citas", {
        method: id ? "PUT" : "POST",
        body: { id_paciente: Number(patient), id_odontologo: Number(doctor), id_consultorio: Number(office),
          id_tratamiento: Number(treatment), fecha: date, hora: hour, duracion_minutos: length,
          estado: state, motivo_consulta: reason.trim() || null, observaciones: notes.trim() || null },
      });
      showToast(id ? "Cita actualizada correctamente" : "Cita agendada correctamente");
      setForm(null);
      await load();
    } catch (error) {
      setFormError(error.message);
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deletion || deleting) return;
    setDeleting(true);
    try {
      await request("/citas/" + deletion.id_cita, { method: "DELETE" });
      showToast("✅ Cita eliminada correctamente");
      setDeletion(null);
      await load();
    } catch (error) {
      showToast("❌ " + (error.message || "Error al eliminar"), "error");
    } finally {
      setDeleting(false);
    }
  }

  async function attend(item) {
    if (!dentist || item.estado !== "En Consulta") return;
    try {
      const current = await request("/citas/" + item.id_cita);
      if (current.estado !== "En Consulta") {
        showToast("⚠️ La cita ya no está En Consulta", "warning");
        await load();
        return;
      }
      localStorage.setItem("cita_clinica_id", String(current.id_cita));
      localStorage.setItem("paciente_clinico_id", String(current.id_paciente));
      navigate("/historia_clinica?" + new URLSearchParams({ paciente: current.id_paciente, cita: current.id_cita }));
    } catch {
      showToast("❌ No se pudo abrir la cita seleccionada", "error");
    }
  }

  function filter(field) {
    return (event) => {
      const value = event.target.value;
      setFilters((current) => ({ ...current, [field]: value }));
    };
  }
  function filterToday() {
    const date = agenda.localDate(new Date());
    setFilters({ date, year: years.includes(date.slice(0, 4)) ? date.slice(0, 4) : "", month: date.slice(5, 7) });
  }

  if (!authorized) return null;
  return (
    <>
      {"\n    "}
      <Toast message={message} />
      {"\n\n    "}
      {"\n    "}
      <div className={"confirm-overlay" + (deletion ? " open" : "")} id="confirmModal">
        {"\n        "}
        <div className={"confirm-modal"}>
          {"\n            "}
          <span className={"material-symbols-outlined confirm-icon warning"} id={"confirmIcon"}>{"warning"}</span>
          {"\n            "}
          <h3 id={"confirmTitulo"}>{"¿Eliminar esta cita?"}</h3>
          {"\n            "}
          <p id={"confirmMensaje"}>{"Esta acción no se puede deshacer. La cita será eliminada permanentemente del sistema."}</p>
          {"\n            "}
          <div className={"cita-info"} id={"citaInfo"}>
            {"\n                "}
            <strong>{"Paciente:"}</strong>
            {" "}
            <span id={"confirmPaciente"} className={"paciente-nombre"}>{deletion ? name(deletion.id_paciente) : "—"}</span>
            <br />
            {"\n                "}
            <strong>{"Fecha:"}</strong>
            {" "}
            <span id={"confirmFecha"} className={"info-text"}>{deletion?.fecha || "—"}</span>
            <br />
            {"\n                "}
            <strong>{"Hora:"}</strong>
            {" "}
            <span id={"confirmHora"} className={"info-text"}>{deletion?.hora || "—"}</span>
            <br />
            {"\n                "}
            <strong>{"Tratamiento:"}</strong>
            {" "}
            <span id={"confirmTratamiento"} className={"info-text"}>{treatmentsOf(deletion)}</span>
            {"\n            "}
          </div>
          {"\n            "}
          <div className={"confirm-footer"} id={"confirmFooter"}>
            {"\n                "}
            <button className={"btn-confirm-cancelar"} onClick={() => setDeletion(null)} disabled={deleting}>
              {"\n                    "}
              <AgendaIcon name="close" />
              {" Cancelar\n                "}
            </button>
            {"\n                "}
            <button className={"btn-confirm-eliminar"} id={"btnConfirmEliminar"} onClick={remove} disabled={deleting}><AgendaIcon name={deleting ? "progress_activity" : "delete"} /> {deleting ? "Eliminando..." : "Eliminar"}</button>
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n    "}
      </div>
      {"\n\n  "}
      {"\n"}
      <div className={"modal-overlay" + (form ? " open" : "")} id="modalCita">
        {"\n    "}
        <div className={"modal"}>
          {"\n        "}
          <h3>
            {"\n            "}
            <AgendaIcon name="calendar_month" />
            {"\n            "}
            <span id="modalTitulo">{form?.id ? "Editar Cita" : "Nueva Cita"}</span>
            {"\n        "}
          </h3>
          {"\n        "}
          <input id="editId" type="hidden" value={form?.id ?? ""} />
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>
              {"Paciente "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n            "}
            <select id="inPaciente" {...bind("patient")} disabled={dentist && Boolean(form?.id)}><Options values={catalog.patients} id="id_paciente" label={(entry) => nameOf(entry) + " - " + (entry.correo || "")} empty="No hay pacientes registrados" emptyValue="" /></select>
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>
              {"Odontólogo "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n            "}
            <select id="inOdontologo" {...bind("doctor")} disabled={dentist}><Options values={catalog.doctors} id="id_odontologo" label={nameOf} empty="No hay odontólogos registrados" emptyValue="" /></select>
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>
              {"Tratamiento "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n            "}
            <select id="inTratamiento" {...bind("treatment")}>{form?.id && !form.treatment && <option value="" hidden />}<Options values={catalog.treatments} id="id_tratamiento" label={(entry) => entry.nombre} empty="No hay tratamientos registrados" emptyValue="" /></select>
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>
              {"Consultorio "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n            "}
            <select id="inConsultorio" {...bind("office")}><Options values={catalog.offices} id="id_consultorio" label={(entry) => entry.nombre} empty="Consultorio Principal" emptyValue="1" /></select>
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>
              {"Fecha "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n            "}
            <input id="inFecha" {...bind("date")} type={"date"} />
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>
              {"Hora "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n            "}
            <input id="inHora" {...bind("hour")} type={"time"} />
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            <label htmlFor={"inDuracion"}>{"Duración (minutos)"}</label>
            <input id="inDuracion" {...bind("duration", "30")} type={"number"} min={"5"} max={"480"} step={"5"} />
          </div>
          <p id="citaFormError" className="agenda-form-error" role="alert">{formError}</p>
          {"\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>{"Estado"}</label>
            {"\n            "}
            <select id="inEstado" {...bind("state", "En Espera")}>
              <option value={"Pendiente"}>{"Pendiente"}</option>
              <option value={"Confirmada"}>{"Confirmada"}</option>
              {"\n                "}
              <option value={"En Espera"}>{"En Espera"}</option>
              {"\n                "}
              <option value={"En Consulta"}>{"En Consulta"}</option>
              {"\n                "}
              <option value={"Finalizado"}>{"Finalizado"}</option>
              {"\n                "}
              <option value={"Cancelado"}>{"Cancelado"}</option>
              {"\n            "}
            </select>
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>{"Motivo de Consulta"}</label>
            {"\n            "}
            <VoiceField id="inMotivo" placeholder="Motivo de la consulta..." value={form?.reason ?? ""} onValue={(value) => update("reason", value)} />
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"form-group"}>
            {"\n            "}
            <label>{"Observaciones"}</label>
            {"\n            "}
            <VoiceField as="textarea" id="inObservaciones" placeholder="Observaciones adicionales..." rows={3} value={form?.notes ?? ""} onValue={(value) => update("notes", value)} />
            {"\n        "}
          </div>
          {"\n\n        "}
          <div className={"modal-footer"}>
            {"\n            "}
            <button className={"btn-cancelar"} onClick={() => setForm(null)} disabled={saving}>{"Cancelar"}</button>
            {"\n            "}
            <button className={"btn-guardar"} id="btnGuardarCita" onClick={save} disabled={saving}>
              {"\n                "}
              <AgendaIcon name="save" />
              {" Guardar\n            "}
            </button>
            {"\n        "}
          </div>
          {"\n    "}
        </div>
        {"\n"}
      </div>
      {"  \n    "}
      {"\n    "}
      <div className={"dashboard-container"}>
        {"\n        "}
        <aside className={"sidebar"}>
          {"\n            "}
          <div className={"sidebar-brand"}>
            {"\n                "}
            <AgendaIcon name="dentistry" />
            {"\n                "}
            <span>{"OdontoSoft"}</span>
            {"\n            "}
          </div>
          {"\n            "}
          <nav className={"sidebar-menu"}>
            {"\n                "}
            <a href={dentist ? "/panel_odontologo" : "/panel"}>
              <AgendaIcon name="group" />
              {dentist ? " Pacientes" : " Usuarios"}
            </a>
            {"\n                "}
            {!dentist && <a href="/roles">
              <AgendaIcon name="manage_accounts" />
              {" Roles"}
            </a>}
            {"\n                "}
            <a href="/tratamientos">
              <AgendaIcon name="medical_services" />
              {" Tratamientos"}
            </a>
            {"\n                "}
            <a className={"active"} href="/citas">
              <AgendaIcon name="calendar_month" />
              {" Citas"}
            </a>
            {"\n                "}
            {!dentist && <a href="/proveedores">
              <AgendaIcon name="local_shipping" />
              {" Proveedores"}
            </a>}
            {"\n                "}
            <a href="/login" onClick={signOut}>
              <AgendaIcon name="logout" />
              {" Salir"}
            </a>
            {"\n            "}
          </nav>
          {"\n        "}
        </aside>
        {"\n\n        "}
        <main className={"main-content"}>
          {"\n            "}
          <header className={"content-header"}>
            {"\n                "}
            <div>
              {"\n                    "}
              <h2>{dentist ? "Mi agenda" : "Agenda de Citas"}</h2>
              {"\n                    "}
              <p style={{ color: "var(--text-muted)" }}>{"Gestión de citas odontológicas"}</p>
              {"\n                "}
            </div>
            {"\n                "}
            <button className={"btn-primary"} onClick={() => openForm()}>
              {"\n                    "}
              <AgendaIcon name="add" />
              {" Nueva Cita\n                "}
            </button>
            {"\n            "}
          </header>
          {"\n\n            "}
          {dentist && <AgendaBlocks />}
          <Calendar appointments={catalog.appointments} doctors={catalog.doctors} dentist={dentist} patientName={name} open={openDetail} create={openForm} refresh={load} />
          {"\n            "}
          <details className={"cal-list-details"}>
            <summary>{"Ver listado y filtros detallados"}</summary>
            {"\n            "}
            {"\n            "}
            <section className={"citas-filtros"} aria-label={"Filtros de citas"}>
              {"\n                "}
              <div className={"filtro-titulo"}>
                {"\n                    "}
                <AgendaIcon name="filter_alt" />
                {"\n                    "}
                <div>
                  {"\n                        "}
                  <strong>{"Filtrar citas"}</strong>
                  {"\n                        "}
                  <small>{"Consulta por año, mes o día"}</small>
                  {"\n                    "}
                </div>
                {"\n                "}
              </div>
              {"\n\n                "}
              <div className={"filtro-campo"}>
                {"\n                    "}
                <label htmlFor={"filtroAnio"}>{"Año"}</label>
                {"\n                    "}
                <select id="filtroAnio" value={filters.year} onChange={filter("year")}>
                  {"\n                        "}
                  <option value="">Todos los años</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}
                  {"\n                    "}
                </select>
                {"\n                "}
              </div>
              {"\n\n                "}
              <div className={"filtro-campo"}>
                {"\n                    "}
                <label htmlFor={"filtroMes"}>{"Mes"}</label>
                {"\n                    "}
                <select id="filtroMes" value={filters.month} onChange={filter("month")}>
                  {"\n                        "}
                  <option value={""}>{"Todos los meses"}</option>
                  {"\n                        "}
                  <option value={"01"}>{"Enero"}</option>
                  {"\n                        "}
                  <option value={"02"}>{"Febrero"}</option>
                  {"\n                        "}
                  <option value={"03"}>{"Marzo"}</option>
                  {"\n                        "}
                  <option value={"04"}>{"Abril"}</option>
                  {"\n                        "}
                  <option value={"05"}>{"Mayo"}</option>
                  {"\n                        "}
                  <option value={"06"}>{"Junio"}</option>
                  {"\n                        "}
                  <option value={"07"}>{"Julio"}</option>
                  {"\n                        "}
                  <option value={"08"}>{"Agosto"}</option>
                  {"\n                        "}
                  <option value={"09"}>{"Septiembre"}</option>
                  {"\n                        "}
                  <option value={"10"}>{"Octubre"}</option>
                  {"\n                        "}
                  <option value={"11"}>{"Noviembre"}</option>
                  {"\n                        "}
                  <option value={"12"}>{"Diciembre"}</option>
                  {"\n                    "}
                </select>
                {"\n                "}
              </div>
              {"\n\n                "}
              <div className={"filtro-campo filtro-dia"}>
                {"\n                    "}
                <label htmlFor={"filtroDia"}>{"Día"}</label>
                {"\n                    "}
                <input id="filtroDia" value={filters.date} onChange={filter("date")} type={"date"} />
                {"\n                "}
              </div>
              {"\n\n                "}
              <button type={"button"} className={"btn-filtro-hoy"} id="btnFiltroHoy" onClick={filterToday}>
                {"\n                    "}
                <AgendaIcon name="today" />
                {" Citas de hoy\n                "}
              </button>
              {"\n                "}
              <button type={"button"} className={"btn-filtro-limpiar"} id="btnFiltroLimpiar" onClick={() => setFilters(filtersDefault)}>
                {"\n                    "}
                <AgendaIcon name="filter_alt_off" />
                {" Limpiar\n                "}
              </button>
              {"\n            "}
            </section>
            {"\n\n            "}
            <section className={"metrics-grid"}>
              {"\n                "}
              <div className={"metric-card"}>
                {"\n                    "}
                <div className={"metric-icon"} style={{ background: "#fef3c7", color: "#d97706" }}>
                  {"\n                        "}
                  <AgendaIcon name="schedule" />
                  {"\n                    "}
                </div>
                {"\n                    "}
                <div className={"metric-data"}>
                  {"\n                        "}
                  <h3 id="cntEspera">{entries ? entries.filter((item) => item.estado === "En Espera").length : "—"}</h3>
                  {"\n                        "}
                  <p>{"En Espera"}</p>
                  {"\n                    "}
                </div>
                {"\n                "}
              </div>
              {"\n                "}
              <div className={"metric-card"}>
                {"\n                    "}
                <div className={"metric-icon"} style={{ background: "#e0f2fe", color: "#0369a1" }}>
                  {"\n                        "}
                  <AgendaIcon name="medical_services" />
                  {"\n                    "}
                </div>
                {"\n                    "}
                <div className={"metric-data"}>
                  {"\n                        "}
                  <h3 id="cntConsulta">{entries ? entries.filter((item) => item.estado === "En Consulta").length : "—"}</h3>
                  {"\n                        "}
                  <p>{"En Consulta"}</p>
                  {"\n                    "}
                </div>
                {"\n                "}
              </div>
              {"\n                "}
              <div className={"metric-card"}>
                {"\n                    "}
                <div className={"metric-icon"} style={{ background: "#dcfce7", color: "#15803d" }}>
                  {"\n                        "}
                  <AgendaIcon name="check_circle" />
                  {"\n                    "}
                </div>
                {"\n                    "}
                <div className={"metric-data"}>
                  {"\n                        "}
                  <h3 id="cntFinalizado">{entries ? entries.filter((item) => item.estado === "Finalizado").length : "—"}</h3>
                  {"\n                        "}
                  <p>{"Finalizadas"}</p>
                  {"\n                    "}
                </div>
                {"\n                "}
              </div>
              {"\n            "}
            </section>
            {"\n\n            "}
            <section className={"table-container"}>
              {"\n                "}
              <table>
                {"\n                    "}
                <thead>
                  {"\n                        "}
                  <tr>
                    {"\n                            "}
                    <th>{"Paciente"}</th>
                    {"\n                            "}
                    <th>{"Odontólogo"}</th>
                    {"\n                            "}
                    <th>{"Tratamiento"}</th>
                    {"\n                            "}
                    <th>{"Fecha y Hora"}</th>
                    {"\n                            "}
                    <th>{"Estado"}</th>
                    {"\n                            "}
                    <th>{"Acciones"}</th>
                    {"\n                        "}
                  </tr>
                  {"\n                    "}
                </thead>
                {"\n                    "}
                <tbody id={"tablaCitas"}><AppointmentRows entries={entries} data={catalog} dentist={dentist} edit={edit} remove={setDeletion} attend={attend} /></tbody>
                {"\n                "}
              </table>
              {"\n            "}
            </section>
            {"\n            "}
          </details>
          {"\n        "}
        </main>
        {"\n    "}
      </div>
      {"\n\n    "}
      <div id="calDetalle" className={"agenda-overlay" + (detail ? " open" : "")} onClick={(event) => { if (event.target === event.currentTarget) closeDetail(); }} role={"dialog"} aria-modal={"true"} aria-labelledby={"calDetalleTitulo"}>
        <div className={"agenda-dialog"}>
          <div className={"agenda-dialog-head"}>
            <div>
              <div className={"agenda-eyebrow"}>{"DETALLE DE LA CITA"}</div>
              <h3 id="calDetalleTitulo">{detail ? name(detail.id_paciente) : "Cita"}</h3>
            </div>
            <button className={"agenda-close"} aria-label={"Cerrar detalle"} onClick={closeDetail} ref={closer}>{"×"}</button>
          </div>
          <div id="calDetalleContenido">{detail && <>
            <span className={"agenda-badge " + agenda.tone(detail)}>{detail.estado || "Pendiente"}</span>
            <dl>
              <dt>Fecha</dt><dd>{agenda.formatDate(detail.fecha, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</dd>
              <dt>Hora</dt><dd>{agenda.time(detail)} · {detail.duracion_minutos || 30} minutos</dd>
              <dt>Tratamiento</dt><dd>{agenda.treatment(detail)}</dd>
              <dt>Odontólogo</dt><dd>{nameOf(person(catalog.doctors, "id_odontologo", detail.id_odontologo))}</dd>
              <dt>Consultorio</dt><dd>{person(catalog.offices, "id_consultorio", detail.id_consultorio)?.nombre || "Sin información"}</dd>
              <dt>Motivo</dt><dd>{detail.motivo_consulta || "Sin registrar"}</dd>
            </dl>
            <div className="agenda-dialog-actions">
              <button className="agenda-btn primary" id="calEditar" onClick={() => { closeDetail(); edit(detail.id_cita); }}>Editar cita</button>
              {dentist && detail.estado === "En Consulta" && <button className="agenda-btn" id="calAtender" onClick={() => attend(detail)}>Atender paciente</button>}
            </div>
          </>}</div>
        </div>
      </div>
    </>
  );
}

