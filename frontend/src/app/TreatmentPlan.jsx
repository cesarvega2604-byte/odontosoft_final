import { useEffect, useState } from "react";
import { request } from "./api.js";
import { AgendaIcon } from "./agendaIcons.jsx";
import { toothGroups } from "./dentalPieces.js";
import { getUser, normalizeRole } from "./session.js";

const states = { pendiente: "Pendiente", en_curso: "En curso", completada: "Completada" };
const arches = [
  ["Superior", [...toothGroups.q1, ...toothGroups.q2]],
  ["Inferior", [...toothGroups.q4, ...toothGroups.q3]],
];
const initial = { titulo: "", descripcion: "", pieza: "", estado: "pendiente", compartida: false };

function ToothMap({ phases, selected, select }) {
  const statesByTooth = new Map();
  for (const phase of phases) {
    const previous = statesByTooth.get(phase.pieza);
    if (phase.pieza && (!previous || phase.estado === "en_curso" ||
        (phase.estado === "pendiente" && previous === "completada"))) {
      statesByTooth.set(phase.pieza, phase.estado);
    }
  }
  return <section className="odonto-card" aria-labelledby="map-title">
    <div className="odonto-section-heading">
      <h2 id="map-title">Mapa dental</h2>
      <button className="odonto-link" type="button" onClick={() => select(null)} aria-pressed={selected === null}>Ver todas las fases</button>
    </div>
    <div className="odonto-map-scroll">
      {arches.map(([label, teeth]) => <div key={label} className="odonto-arch">
        <h3>{label}</h3>
        <div className="odonto-tooth-row">{teeth.map((tooth) => {
          const state = statesByTooth.get(tooth);
          return <button type="button" key={tooth} data-tone={state} aria-pressed={selected === tooth}
            aria-label={`Pieza ${tooth}${state ? " · " + states[state] : ""}`} onClick={() => select(tooth)}>
            {tooth}
          </button>;
        })}</div>
      </div>)}
    </div>
    <div className="odonto-legend">{Object.entries(states).map(([state, label]) =>
      <span key={state} className="odonto-status" data-tone={state}>{label}</span>)}</div>
  </section>;
}

function PhaseEditor({ draft, setDraft, save, close, busy }) {
  const bind = (key) => ({
    value: draft[key],
    onChange: (event) => setDraft((value) => ({ ...value, [key]: event.target.value })),
  });
  return <form className="odonto-card odonto-editor" onSubmit={save}>
    <h2>{draft.id ? "Editar fase" : "Nueva fase"}</h2>
    <label>Nombre de la fase<input {...bind("titulo")} required maxLength={100} /></label>
    <label>Explicación para el paciente<textarea {...bind("descripcion")} required maxLength={1500} rows={3} /></label>
    <div className="odonto-columns">
      <label><span id="phase-tooth-label">Pieza dental</span><select aria-labelledby="phase-tooth-label" {...bind("pieza")}>
        <option value="">Tratamiento general</option>
        {arches.map(([label, teeth]) => <optgroup key={label} label={label}>{teeth.map((tooth) =>
          <option key={tooth} value={tooth}>Pieza {tooth}</option>)}</optgroup>)}
      </select></label>
      <label><span id="phase-state-label">Estado</span><select aria-labelledby="phase-state-label" {...bind("estado")}>
        {Object.entries(states).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    <label className="odonto-checkbox"><input type="checkbox" checked={draft.compartida}
      onChange={(event) => setDraft({ ...draft, compartida: event.target.checked })} /> Mostrar al paciente</label>
    <div className="odonto-actions">
      <button className="odonto-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar fase"}</button>
      <button className="odonto-secondary" type="button" onClick={close} disabled={busy}>Cancelar</button>
    </div>
  </form>;
}

export default function TreatmentPlan({ search, navigate }) {
  const user = getUser();
  const role = normalizeRole(user?.rol);
  const dentist = role === "odontologo";
  const params = new URLSearchParams(search);
  const patientId = params.get("paciente");
  const tooth = Number(params.get("pieza"));
  const preselected = dentist && arches.some(([, teeth]) => teeth.includes(tooth)) ? tooth : null;
  const endpoint = dentist ? "/planes-tratamiento/paciente/" + patientId : "/planes-tratamiento/";
  const [phases, setPhases] = useState(null);
  const [patient, setPatient] = useState(null);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const back = dentist ? "/panel_odontologo" : "/panel_cliente";

  useEffect(() => {
    if (!user || (dentist && !patientId) || !["paciente", "odontologo"].includes(role)) {
      navigate(!user ? "/login" : dentist ? back : "/panel", { replace: true });
      return;
    }
    const abort = new AbortController();
    const options = { signal: abort.signal };
    setPhases(null);
    setPatient(null);
    setSelected(preselected);
    setDraft(null);
    setFeedback(null);
    Promise.all([request(endpoint, options), dentist ? request("/pacientes/" + patientId, options) : null])
      .then(([rows, person]) => {
        setPhases(rows);
        setPatient(person);
      })
      .catch((error) => { if (!abort.signal.aborted) setFeedback({ error: error.message }); });
    return () => abort.abort();
  }, [user, role, dentist, patientId, endpoint, navigate, back, preselected]);

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    const { id, titulo, descripcion, pieza, estado, compartida } = draft;
    try {
      const fase = await request(id ? endpoint + "/" + id : endpoint, {
        method: id ? "PUT" : "POST",
        body: { titulo: titulo.trim(), descripcion: descripcion.trim(), pieza: pieza ? Number(pieza) : null, estado, compartida },
      });
      setPhases((current) => id ? current.map((item) => item.id === id ? fase : item) : [...current, fase]);
      setSelected(fase.pieza);
      setDraft(null);
      setFeedback({ text: fase.compartida ? "Fase guardada y visible para el paciente." : "Fase guardada como borrador." });
    } catch (error) {
      setFeedback({ error: error.message });
    } finally {
      setBusy(false);
    }
  }

  if (!user || !["paciente", "odontologo"].includes(role) || (dentist && !patientId)) return null;
  const completed = phases?.filter((phase) => phase.estado === "completada").length ?? 0;
  const next = phases?.find((phase) => phase.estado === "en_curso") ?? phases?.find((phase) => phase.estado === "pendiente");
  const shown = phases?.filter((phase) => selected === null || phase.pieza === selected);
  return <main className="odonto-workspace">
    <a className="odonto-back" href={back}><AgendaIcon name="arrow_back" /> Volver al panel</a>
    <header className="odonto-feature-header">
      <div>
        <h1>{dentist ? "Plan del paciente" : "Mi tratamiento"}</h1>
        <p>{dentist ? (patient ? `${patient.nombre} ${patient.apellido}` : "Plan odontológico por fases") : "Consulta tu avance y el siguiente paso de tu tratamiento."}</p>
      </div>
      {dentist && phases && <button className="odonto-primary" type="button" onClick={() => setDraft({ ...initial, pieza: selected ?? "" })}>Agregar fase</button>}
    </header>
    {feedback && <p className={feedback.error ? "odonto-feedback error" : "odonto-feedback"} role={feedback.error ? "alert" : "status"}>{feedback.error ?? feedback.text}</p>}
    {phases === null && !feedback && <p role="status">Cargando el plan…</p>}
    {phases && <>
      {phases.length > 0 && <section className="odonto-summary" aria-label="Avance del tratamiento">
        <div>
          <strong>{completed} de {phases.length} fases completadas</strong>
          <progress aria-label="Fases completadas" value={completed} max={phases.length} />
        </div>
        <div><small>Siguiente paso</small><strong>{next?.titulo ?? "Plan completado"}</strong></div>
      </section>}
      {draft && <PhaseEditor draft={draft} setDraft={setDraft} save={save} close={() => setDraft(null)} busy={busy} />}
      <ToothMap phases={phases} selected={selected} select={setSelected} />
      <section className="odonto-card" aria-labelledby="phase-title">
        <h2 id="phase-title">{selected ? `Fases de la pieza ${selected}` : "Fases del tratamiento"}</h2>
        {!shown?.length ? <p className="odonto-muted">{selected ? "Esta pieza no tiene fases en el plan." :
          dentist ? "Agrega la primera fase del tratamiento." : "Tu odontólogo aún no ha compartido fases contigo."}</p> :
          <ol className="odonto-phase-list">{shown.map((phase) => <li key={phase.id}>
            <div className="odonto-phase-main">
              <h3>{phase.titulo}</h3>
              <small>{phase.pieza ? "Pieza " + phase.pieza : "Tratamiento general"}{dentist && !phase.compartida ? " · Borrador" : ""}</small>
              <p>{phase.descripcion}</p>
            </div>
            <span className="odonto-status" data-tone={phase.estado}>{states[phase.estado]}</span>
            {phase.editable && <button type="button" className="odonto-secondary" onClick={() => setDraft({ ...phase, pieza: phase.pieza ?? "" })}>Editar</button>}
          </li>)}</ol>}
      </section>
    </>}
  </main>;
}
