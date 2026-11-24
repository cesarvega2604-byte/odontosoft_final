import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api.js";
import { Toast, useToast } from "./authUi.jsx";
import { getUser, normalizeRole, signOut } from "./session.js";
import { AgendaIcon } from "./agendaIcons.jsx";
import * as agenda from "./agenda.js";

function AppointmentBadge({ appointment }) {
  return <span className={"agenda-badge " + agenda.tone(appointment)}>{appointment.estado || "Pendiente"}</span>;
}

function PatientCard({ patient, open, clinical, dental }) {
  const { id_paciente: id, nombre, apellido } = patient;
  const details = [
    ["mail", patient.correo || "Sin correo"],
    ["call", patient.telefono || "Sin teléfono"],
    ["health_and_safety", patient.eps || "EPS no registrada"],
  ];
  return (
    <article className="paciente-card">
      <div className="paciente-card-header">
        <div className="paciente-avatar">{((nombre?.[0] || "") + (apellido?.[0] || "")).toUpperCase()}</div>
        <div><h3>{nombre} {apellido}</h3><small>Paciente #{id}</small></div>
      </div>
      <div className="paciente-datos">
        {details.map(([icon, value]) => <div key={icon} className="paciente-dato"><AgendaIcon name={icon} /><span>{value}</span></div>)}
      </div>
      <div className="paciente-acciones">
        <button className="btn-clinico" onClick={(event) => open(id, event.currentTarget)}><AgendaIcon name="person_search" /> Ficha rápida</button>
        <button className="btn-clinico" onClick={() => clinical(id)}><AgendaIcon name="clinical_notes" /> Historia clínica</button>
        <button className="btn-odonto" onClick={() => dental(id)}><AgendaIcon name="dentistry" /> Odontograma</button>
        <a className="btn-clinico" href={"/mi-tratamiento?paciente=" + id}><AgendaIcon name="checklist" /> Plan del paciente</a>
      </div>
    </article>
  );
}

function QuickDetails({ patient, next, clinical, dental }) {
  const { id_paciente: id } = patient;
  return <>
    <dl>
      <dt>Correo</dt><dd>{patient.correo || "Sin registrar"}</dd>
      <dt>Teléfono</dt><dd>{patient.telefono || "Sin registrar"}</dd>
      <dt>EPS</dt><dd>{patient.eps || "Sin registrar"}</dd>
      <dt>Alergias</dt><dd>{patient.alergias || "Sin información registrada"}</dd>
      <dt>Próxima cita</dt><dd>{next ? <>{agenda.formatDate(next.fecha)} · {agenda.time(next)}<br />{agenda.treatment(next)}</> : "Sin cita futura registrada"}</dd>
    </dl>
    <div className="agenda-dialog-actions">
      <button className="agenda-btn primary" onClick={() => clinical(id)}>Historia clínica</button>
      <button className="agenda-btn" onClick={() => dental(id)}>Odontograma</button>
      <a className="agenda-btn" href={"/mi-tratamiento?paciente=" + id}>Plan del paciente</a>
      <a className="agenda-btn" href="/citas">Ver agenda</a>
    </div>
  </>;
}

export default function DentistDashboard({ navigate }) {
  const user = getUser();
  const email = user?.correo;
  const role = normalizeRole(user?.rol);
  const [people, setPeople] = useState(null);
  const [doctor, setDoctor] = useState(undefined);
  const [appointments, setAppointments] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [finishTarget, setFinishTarget] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState(false);
  const [message, showToast] = useToast();
  const liveRequest = useRef(null);
  const quickClose = useRef(null);
  const opener = useRef(null);
  const finishDialog = useRef(null);
  const day = agenda.today();
  const today = appointments?.filter((item) => item.fecha === day).sort(agenda.order) ?? [];
  const active = today.filter((item) => !agenda.cancelled(item));
  const future = appointments?.filter(agenda.upcoming).sort(agenda.order) ?? [];
  const done = today.filter(agenda.complete);
  const next = future[0];
  const counts = [
    ["Por atender", active.filter((item) => !agenda.complete(item) && normalizeRole(item.estado) !== "en consulta").length, "espera"],
    ["En consulta", today.filter((item) => normalizeRole(item.estado) === "en consulta").length, "consulta"],
    ["Finalizadas", done.length, "finalizada"],
    ["Canceladas", today.filter(agenda.cancelled).length, "cancelada"],
  ];
  const peopleFiltered = people?.filter((person) =>
    (person.nombre + " " + person.apellido + " " + (person.correo || "")).toLowerCase().includes(query.trim().toLowerCase())
  ) ?? [];

  const load = useCallback(async () => {
    liveRequest.current?.abort();
    const abort = new AbortController();
    liveRequest.current = abort;
    const options = { signal: abort.signal };
    try {
      const [patients, dentists] = await Promise.all([request("/pacientes", options), request("/odontologos", options)]);
      const matching = dentists.filter((person) => person.correo === email);
      const professional = matching.length === 1 ? matching[0] : null;
      setPeople(Array.isArray(patients) ? patients : []);
      setDoctor(professional || null);
      const nextAppointments = professional ? await request("/citas/odontologo/" + professional.id_odontologo, options) : [];
      if (!abort.signal.aborted) {
        setAppointments(nextAppointments);
        setError(false);
      }
    } catch (failure) {
      if (!abort.signal.aborted) {
        setError(true);
        showToast(failure.message, "error");
      }
    }
  }, [email, showToast]);

  useEffect(() => {
    if (role !== "odontologo") {
      navigate(!user ? "/login" : role === "paciente" ? "/panel_cliente" : "/panel", { replace: true });
      return;
    }
    load();
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("focus", load);
      liveRequest.current?.abort();
    };
  }, [role, Boolean(user), load, navigate]);

  useEffect(() => {
    if (role !== "odontologo") return;
    const interval = setInterval(() => {
      if (!document.hidden && !selected && !finishTarget) load();
    }, 15000);
    return () => clearInterval(interval);
  }, [role, selected, finishTarget, load]);

  useEffect(() => {
    if (finishTarget) finishDialog.current?.showModal();
    else finishDialog.current?.close();
  }, [finishTarget]);

  const close = useCallback(() => {
    setSelected(null);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    if (!selected) return;
    quickClose.current?.focus();
    function escape(event) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [selected, close]);

  function patientFor(item) {
    return people?.find((person) => Number(person.id_paciente) === Number(item.id_paciente))
      || { nombre: "Paciente", apellido: "#" + item.id_paciente };
  }
  async function finishAppointment() {
    if (!finishTarget || finishing) return;
    setFinishing(true);
    try {
      const updated = await request("/citas/" + finishTarget.id_cita + "/finalizar", { method: "POST" });
      liveRequest.current?.abort();
      setAppointments((current) => current.map((item) => item.id_cita === updated.id_cita ? updated : item));
      setFinishTarget(null);
      showToast("Cita finalizada. Encuesta programada.");
    } catch (failure) {
      showToast(failure.message, "error");
      setFinishTarget(null);
      load();
    } finally {
      setFinishing(false);
    }
  }
  function open(patientId, element) {
    const patient = people?.find((person) => Number(person.id_paciente) === Number(patientId));
    if (!patient) return;
    opener.current = element;
    setSelected(patient);
  }
  function clinical(patientId) {
    localStorage.setItem("paciente_clinico_id", String(patientId));
    navigate("/historia_clinica?paciente=" + patientId);
  }
  function dental(patientId) {
    localStorage.setItem("paciente_odontograma_id", String(patientId));
    navigate("/odontograma?paciente=" + patientId);
  }
  if (role !== "odontologo") return null;
  const title = error ? "No se pudo actualizar la agenda" : !appointments ? "Preparando tu agenda…" :
    active.length ? "Tienes " + active.length + " " + (active.length === 1 ? "cita" : "citas") + " hoy" : "Hoy tienes la agenda libre";
  const subtitle = error ? "Comprueba la conexión con el backend y pulsa Actualizar." : doctor === null ?
    "Tu usuario no está vinculado a un odontólogo. Revisa que ambos tengan el mismo correo." : !appointments ? "Consultando tus citas de hoy" :
    active.length ? "Consulta los horarios y accede a la ficha de cada paciente." : "Puedes revisar tus próximas citas y preparar la atención de tus pacientes.";
  return (
    <>
      {"\n"}
      <Toast message={message} />
      {"\n"}
      <div className={"dashboard-container"}>
        {"\n    "}
        <aside className={"sidebar"}>
          {"\n        "}
          <div className={"sidebar-brand"}>
            <AgendaIcon name="dentistry" />
            <span>{"OdontoSoft"}</span>
          </div>
          {"\n        "}
          <nav className={"sidebar-menu"}>
            {"\n            "}
            <a className={"active"} href="/panel_odontologo">
              <AgendaIcon name="space_dashboard" />
              {" Inicio"}
            </a>
            {"\n            "}
            <a href="/tratamientos">
              <AgendaIcon name="medical_services" />
              {" Tratamientos"}
            </a>
            {"\n            "}
            <a href="/citas">
              <AgendaIcon name="calendar_month" />
              {" Citas"}
            </a>
            {"\n            "}
            <a href={"#"} onClick={signOut}>
              <AgendaIcon name="logout" />
              {" Salir"}
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
              <h2>{"Panel del Odontólogo"}</h2>
              {"\n                "}
              <p style={{ color: "var(--text-muted)" }}>{"Tu jornada, tus pacientes y tu próxima atención, en un solo lugar"}</p>
              {"\n            "}
            </div>
            {"\n            "}
            <div className={"odontologo-saludo"} id="odontologoSaludo">{doctor ? "Dr(a). " + doctor.nombre + " " + doctor.apellido : doctor === null ? email : "Sesión: " + email}</div>
            {"\n        "}
          </header>
          {"\n\n        "}
          <section className={"jornada-hero"}>
            <div>
              <div className={"agenda-eyebrow"}>{"TU JORNADA CLÍNICA"}</div>
              <h1 id="jornadaTitulo">{title}</h1>
              <p id="jornadaSubtitulo">{subtitle}</p>
              <p id="jornadaFecha">{appointments && agenda.formatDate(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " · Hora de Colombia"}</p>
            </div>
            <a className={"agenda-btn"} href="/citas">
              <AgendaIcon name="calendar_month" />
              {" Abrir calendario"}
            </a>
          </section>
          {"\n        "}
          <section className={"metrics-grid"}>
            {"\n            "}
            <div className={"metric-card"}>
              <div className={"metric-icon"}>
                <AgendaIcon name="groups" />
              </div>
              <div className={"metric-data"}>
                <h3 id="cntPacientes">{people?.length ?? "—"}</h3>
                <p>{"Pacientes registrados"}</p>
              </div>
            </div>
            {"\n            "}
            <div className={"metric-card"}>
              <div className={"metric-icon"}>
                <AgendaIcon name="event_available" />
              </div>
              <div className={"metric-data"}>
                <h3 id="cntCitas">{appointments ? active.length : "—"}</h3>
                <p>{"Citas de hoy"}</p>
              </div>
            </div>
            {"\n            "}
            <div className={"metric-card"}>
              <div className={"metric-icon"}>
                <AgendaIcon name="pending_actions" />
              </div>
              <div className={"metric-data"}>
                <h3 id="cntPendientes">{appointments ? future.length : "—"}</h3>
                <p>{"Próximas citas"}</p>
              </div>
            </div>
            {"\n            "}
            <div className={"metric-card"}>
              <div className={"metric-icon"}>
                <AgendaIcon name="task_alt" />
              </div>
              <div className={"metric-data"}>
                <h3 id="cntAtendidos">{appointments ? done.length : "—"}</h3>
                <p>{"Finalizadas hoy"}</p>
              </div>
            </div>
            {"\n        "}
          </section>
          {"\n        "}
          <section className={"jornada-layout"}>
            {"\n          "}
            <div className={"agenda-card"}>
              <div className={"jornada-section-head"}>
                <div>
                  <div className={"agenda-eyebrow"}>{"AGENDA PERSONAL"}</div>
                  <h3>{"Mis citas de hoy"}</h3>
                </div>
                <span id="hoyTotal" className="agenda-muted">{appointments && today.length + " registradas"}</span>
              </div>
              <div id={"citasHoyLista"} aria-live={"polite"}>
                {!appointments ? <p className="agenda-muted">Cargando…</p> : today.length === 0
                  ? <div className="agenda-empty"><strong>Sin citas para hoy</strong>Las nuevas citas aparecerán aquí automáticamente.</div>
                  : today.map((item) => {
                    const patient = patientFor(item);
                    return <article key={item.id_cita} className={"jornada-cita " + agenda.tone(item)}>
                      <div className="jornada-hora">{agenda.time(item)}<small>{item.duracion_minutos || 30} min</small></div>
                      <div className="jornada-persona"><strong>{patient.nombre} {patient.apellido}</strong><p>{agenda.treatment(item)}</p><AppointmentBadge appointment={item} /></div>
                      <div className="jornada-cita-acciones">
                        <button className="agenda-btn" onClick={(event) => open(item.id_paciente, event.currentTarget)}>Ver paciente</button>
                        {!agenda.complete(item) && !agenda.cancelled(item) && (
                          <button type="button" className="agenda-btn jornada-finalizar" onClick={() => setFinishTarget(item)}>
                            Finalizar cita
                          </button>
                        )}
                      </div>
                    </article>;
                  })}
              </div>
            </div>
            {"\n          "}
            <div className={"jornada-side"}>
              <div className={"agenda-card proxima-card"}>
                <div className={"agenda-eyebrow"}>{"SIGUIENTE EN AGENDA"}</div>
                <div id="proximaCita">{appointments && (next ? <>
                  <h3>{patientFor(next).nombre} {patientFor(next).apellido}</h3>
                  <p>{agenda.formatDate(next.fecha)} · <strong>{agenda.time(next)}</strong></p>
                  <p className="agenda-muted">{agenda.treatment(next)}</p>
                  <button className="agenda-btn primary" onClick={(event) => open(next.id_paciente, event.currentTarget)}>Preparar atención</button>
                </> : <><h3>Sin citas pendientes</h3><p className="agenda-muted">Tu próxima reserva aparecerá en este espacio.</p></>)}</div>
              </div>
              <div className={"agenda-card"}>
                <h3>{"Estado de la jornada"}</h3>
                <div id="jornadaDistribucion">{appointments && counts.map(([label, total, tone]) =>
                  <div key={tone} className="jornada-bar-row">
                    <span>{label}</span><strong>{total}</strong><div className={"jornada-bar " + tone}><i style={{ width: (today.length ? total / today.length * 100 : 0) + "%" }} /></div>
                  </div>
                )}</div>
              </div>
            </div>
            {"\n        "}
          </section>
          {"\n        "}
          <div className={"jornada-section-head"}>
            <div>
              <div className={"agenda-eyebrow"}>{"ATENCIÓN CLÍNICA"}</div>
              <h3>{"Directorio de pacientes"}</h3>
            </div>
          </div>
          {"\n        "}
          <section className={"odontologo-toolbar"}>
            {"\n            "}
            <div className={"busqueda-paciente"}>
              <AgendaIcon name="search" />
              <input id="buscarPaciente" value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por nombre o correo..." />
            </div>
            {"\n            "}
            <button className={"btn-primary"} onClick={load}>
              <AgendaIcon name="refresh" />
              {" Actualizar"}
            </button>
            {"\n        "}
          </section>
          {"\n\n        "}
          <section className={"pacientes-grid"} id={"pacientesGrid"}>
            {"\n            "}
            {!people ? <div className="pacientes-loading">Cargando pacientes...</div> : peopleFiltered.length
              ? peopleFiltered.map((patient) => <PatientCard key={patient.id_paciente} patient={patient} open={open} clinical={clinical} dental={dental} />)
              : <div className="pacientes-vacio"><AgendaIcon name="person_search" style={{ fontSize: 42 }} /><p>No hay pacientes que coincidan con la búsqueda.</p></div>}
            {"\n        "}
          </section>
          {"\n    "}
        </main>
        {"\n"}
      </div>
      <dialog ref={finishDialog} className="jornada-finish-dialog" aria-labelledby="finalizarTitulo"
        onCancel={(event) => { event.preventDefault(); if (!finishing) setFinishTarget(null); }}>
        {finishTarget && <>
          <div className="jornada-finish-icon"><AgendaIcon name="task_alt" /></div>
          <h3 id="finalizarTitulo">Finalizar cita</h3>
          <p><strong>{patientFor(finishTarget).nombre} {patientFor(finishTarget).apellido}</strong>
            {" · " + agenda.formatDate(finishTarget.fecha) + " · " + agenda.time(finishTarget)}</p>
          <p>Se programará el correo con la encuesta de satisfacción del paciente.</p>
          <div className="agenda-dialog-actions">
            <button type="button" className="agenda-btn" autoFocus disabled={finishing} onClick={() => setFinishTarget(null)}>Volver</button>
            <button type="button" className="agenda-btn jornada-finalizar" disabled={finishing} onClick={finishAppointment}>
              {finishing ? "Finalizando…" : "Confirmar finalización"}
            </button>
          </div>
        </>}
      </dialog>
      {"\n"}
      <div className={"agenda-overlay" + (selected ? " open" : "")} id="fichaPaciente" onClick={(event) => { if (event.target === event.currentTarget) close(); }} role={"dialog"} aria-modal={"true"} aria-labelledby={"fichaTitulo"}>
        <div className={"agenda-dialog"}>
          <div className={"agenda-dialog-head"}>
            <div>
              <div className={"agenda-eyebrow"}>{"FICHA RÁPIDA"}</div>
              <h3 id="fichaTitulo">{selected ? selected.nombre + " " + selected.apellido : "Paciente"}</h3>
            </div>
            <button className={"agenda-close"} aria-label={"Cerrar ficha"} onClick={close} ref={quickClose}>{"×"}</button>
          </div>
          <div id="fichaContenido">{selected && <QuickDetails patient={selected}
            next={future.find((item) => Number(item.id_paciente) === Number(selected.id_paciente))} clinical={clinical} dental={dental} />}</div>
        </div>
      </div>
      {"\n"}
    </>
  );
}

