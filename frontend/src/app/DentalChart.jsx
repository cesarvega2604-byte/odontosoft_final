import { useEffect, useState } from "react";
import { request } from "./api.js";
import { Toast, useToast } from "./authUi.jsx";
import { getUser, normalizeRole } from "./session.js";
import { toothGroups as GRUPOS } from "./dentalPieces.js";

const ESTADOS = ["sano", "caries", "restaurado", "ausente", "realizado", "indicado"];
const ETIQUETAS = {sano:"Sano", caries:"Caries", restaurado:"Restaurado", ausente:"Ausente", realizado:"Tratamiento realizado", indicado:"Tratamiento indicado"};
const SUPERFICIES = {central:"Central", superior:"Superior", derecha:"Derecha", inferior:"Inferior", izquierda:"Izquierda"};

const zones = {superior:"M10 10 A20 20 0 0 1 38 10 L32 16 L16 16 Z", derecha:"M38 10 A20 20 0 0 1 38 38 L32 32 L32 16 Z", inferior:"M38 38 A20 20 0 0 1 10 38 L16 32 L32 32 Z", izquierda:"M10 38 A20 20 0 0 1 10 10 L16 16 L16 32 Z", central:"M16 16 H32 V32 H16 Z"};
const statusOrder = ["ausente", "caries", "indicado", "restaurado", "realizado", "sano"];
const toothNumbers = Object.values(GRUPOS).flat();

function safeStatus(status) {
  return ESTADOS.includes(status) ? status : "sano";
}

function detail(chart, number, surface) {
  const entry = chart[number] || {};
  const estado = safeStatus(entry.estado);
  return surface === "toda"
    ? { estado, observacion: entry.observacion || "" }
    : entry.superficies?.[surface] || { estado, observacion: "" };
}

function commit(chart, selection, draft) {
  if (!selection) return chart;
  const { number, surface } = selection;
  const before = detail(chart, number, surface);
  const next = { estado: draft.estado, observacion: draft.observacion.trim() };
  if (before.estado === next.estado && (before.observacion || "") === next.observacion
    && !(surface === "toda" && draft.explicit)) return chart;
  const existing = chart[number] || {};
  let record;
  if (surface === "toda") {
    record = { ...existing, ...next };
    if (before.estado !== next.estado || draft.explicit) {
      record.superficies = Object.fromEntries(Object.keys(SUPERFICIES).map((face) => [
        face, { ...existing.superficies?.[face], estado: next.estado, observacion: existing.superficies?.[face]?.observacion || "" },
      ]));
    }
  } else {
    const faces = Object.fromEntries(Object.keys(SUPERFICIES).map((face) => [face, detail(chart, number, face)]));
    const superficies = { ...existing.superficies, ...faces, [surface]: next };
    const states = Object.values(superficies).map((face) => face.estado);
    record = { ...existing, superficies, estado: statusOrder.find((status) => states.includes(status)) || existing.estado || "sano" };
  }
  return { ...chart, [number]: record };
}

function tipoDiente(n) { const u=n%10; return u<=2?"incisivo":u===3?"canino":u<=5?"premolar":"molar"; }
function ToothShape({ number: n }) {
  const tipo=tipoDiente(n), inferior=n>30;
  const raices={
    incisivo:"M17 62 C17 43 20 17 24 6 C28 17 31 43 31 62 Z",
    canino:"M15 62 C16 42 19 13 24 3 C30 13 33 42 33 62 Z",
    premolar:"M12 62 C14 42 13 19 16 9 C23 18 23 38 24 48 C27 29 29 16 33 10 C36 23 34 45 36 62 Z",
    molar:inferior?"M8 62 C8 42 6 18 11 7 C19 17 17 42 23 49 C29 40 30 19 36 7 C42 20 39 45 40 62 Z":"M8 62 C7 43 7 18 11 8 C17 13 16 36 20 43 C20 26 21 14 24 7 C28 16 28 32 28 43 C33 33 31 16 37 8 C42 20 40 46 40 62 Z"
  };
  const corona={incisivo:"M15 60 Q24 55 33 60 L35 79 Q24 85 13 79 Z",canino:"M14 63 L24 55 L34 63 L36 78 Q24 86 12 78 Z",premolar:"M11 62 Q17 56 24 61 Q32 55 37 63 L39 77 Q32 85 24 80 Q15 85 9 77 Z",molar:"M7 63 Q12 56 19 61 Q24 55 29 61 Q36 56 41 63 L42 77 Q36 86 29 81 Q24 86 18 81 Q10 86 6 77 Z"};
  return (
    <svg className="tooth-svg" viewBox="0 0 48 88" aria-hidden="true">
      <path className="tooth-root" d={raices[tipo]} />
      <path className="tooth-crown" d={corona[tipo]} />
      <path className="tooth-detail" d="M17 67 Q24 73 31 67 M24 70 L24 78" />
      <g className="absent-mark"><path d="M8 58 L40 84 M40 58 L8 84" /></g>
    </svg>
  );
}

function Tooth({ number, chart, selection, disabled, select }) {
  const selected = selection?.number === number;
  const state = safeStatus(chart[number]?.estado);
  return (
    <div className={"tooth " + state + (selected ? " selected" : "")} data-diente={number} role="group" aria-label={"Diente " + number}>
      <button type="button" className="whole-tooth" title={"Editar pieza completa " + number} aria-label={"Editar pieza completa " + number} disabled={disabled} onClick={() => select(number, "toda")}>
        <ToothShape number={number} />
      </button>
      <svg className="occlusal-svg" viewBox="0 0 48 48" role="group" aria-label={"Cinco superficies del diente " + number}>
        {Object.entries(zones).map(([face, path]) => {
          const status = safeStatus(detail(chart, number, face).estado);
          const active = selected && selection.surface === face;
          const label = SUPERFICIES[face] + ": " + ETIQUETAS[status];
          function activate() {
            if (!disabled) select(number, face);
          }
          return <path key={face} className={"surface-zone " + status + (active ? " surface-selected" : "")}
            data-superficie={face} d={path} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
            aria-label={"Diente " + number + ", " + label} aria-pressed={active}
            onClick={activate} onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
              }
            }}><title>{SUPERFICIES[face]} · {ETIQUETAS[status]}</title></path>;
        })}
      </svg>
      <span className="tooth-number">{number}</span>
    </div>
  );
}

const emptyDraft = { estado: "sano", observacion: "", explicit: false };

export default function DentalChart({ navigate, search }) {
  const user = getUser();
  const patientId = new URLSearchParams(search).get("paciente") || localStorage.getItem("paciente_odontograma_id");
  const validId = /^\d+$/.test(patientId || "") && Number(patientId) > 0;
  const dentist = normalizeRole(user?.rol) === "odontologo";
  const [person, setPerson] = useState(null);
  const [chart, setChart] = useState({});
  const [selection, setSelection] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Cargando odontograma…");
  const [message, showToast] = useToast(3500);
  const endpoint = "/odontogramas/paciente/" + patientId;
  const controlsDisabled = !loaded || saving;
  const editorDisabled = controlsDisabled || !selection;
  const surface = selection?.surface;
  const whole = surface === "toda";
  const counts = Object.fromEntries(ESTADOS.map((name) => [name, 0]));
  toothNumbers.forEach((number) => { counts[safeStatus(chart[number]?.estado)]++; });

  useEffect(() => {
    if (!user || !dentist || !validId) {
      navigate(!user ? "/login" : !dentist ? "/panel" : "/panel_odontologo", { replace: true });
      return;
    }
    const abort = new AbortController();
    const options = { signal: abort.signal };
    async function load() {
      try {
        const patient = await request("/pacientes/" + patientId, options);
        setPerson(patient);
        const existing = await request(endpoint, options);
        setChart(existing.dientes || {});
        setLoaded(true);
        setStatus("Odontograma cargado · Sin cambios pendientes");
      } catch (error) {
        if (abort.signal.aborted) return;
        setStatus("No se pudo cargar el odontograma. Recarga la página para reintentar.");
        showToast(error.message, "error");
      }
    }
    load();
    return () => abort.abort();
  }, [Boolean(user), dentist, validId, patientId, endpoint, navigate]);

  useEffect(() => {
    if (!dirty) return;
    function warn(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    function warnInApp(event) {
      if (!window.confirm("Hay cambios pendientes en el odontograma. ¿Salir sin guardarlos?")) event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    window.addEventListener("odontosoft:before-route", warnInApp);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("odontosoft:before-route", warnInApp);
    };
  }, [dirty]);

  function markDirty() {
    setDirty(true);
    setStatus("Cambios pendientes de guardar");
  }

  function select(number, face) {
    const next = commit(chart, selection, draft);
    if (next !== chart) {
      setChart(next);
      markDirty();
    }
    const existing = detail(next, number, face);
    setSelection({ number, surface: face });
    setDraft({ estado: safeStatus(existing.estado), observacion: existing.observacion || "", explicit: false });
  }

  async function save() {
    if (controlsDisabled) return;
    const next = commit(chart, selection, draft);
    setChart(next);
    setDraft((value) => ({ ...value, explicit: false, observacion: value.observacion.trim() }));
    setSaving(true);
    setStatus("Guardando…");
    try {
      await request(endpoint, { method: "PUT", body: { id_paciente: Number(patientId), dientes: next } });
      setDirty(false);
      setStatus("Todos los cambios están guardados");
      showToast("Odontograma guardado correctamente");
    } catch (error) {
      setStatus("No se guardó. Conserva esta página abierta y vuelve a intentarlo.");
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function apply() {
    if (!selection) return;
    select(selection.number, selection.surface);
    showToast("Pieza " + selection.number + " actualizada; guarda el odontograma para conservar los cambios");
  }

  if (!user || !dentist || !validId) return null;
  return (
    <>
      <Toast message={message} />
      <div className={"odontograma-page"}>
        <div className={"odonto-shell"}>
          {"\n"}
          <header className={"odonto-head"}>
            <div>
              <div className={"odonto-brand"}>
                <span className={"material-symbols-outlined"}>{"dentistry"}</span>
                <span>{"OdontoSoft"}</span>
              </div>
              <a href="/panel_odontologo" className={"volver"}>{"← Pacientes"}</a>
              <h1>{"Odontograma clínico"}</h1>
              <p id="pacienteNombre">{person ? person.nombre + " " + person.apellido : "Cargando paciente..."}</p>
              <a className="volver" href={"/mi-tratamiento?paciente=" + patientId + (selection ? "&pieza=" + selection.number : "")}>Ver plan del paciente</a>
            </div>
            <button className={"btn-guardar-odonto"} id="btnGuardar" onClick={save} disabled={controlsDisabled}>
              <span className={"material-symbols-outlined"}>{"save"}</span>
              {" Guardar odontograma"}
            </button>
          </header>
          {"\n"}
          <section className={"odonto-layout"}>
            <div className={"odonto-chart"}>
              <div className={"chart-title"}>
                <h2>{"Dentición permanente"}</h2>
                <span id={"piezaSeleccionada"}>{selection ? "Pieza " + selection.number + " · " + (whole ? "Pieza completa" : SUPERFICIES[surface]) : "Seleccione una pieza"}</span>
              </div>
              <div className={"leyenda"}>
                <span>
                  <i className={"sano"} />
                  {"Sano"}
                </span>
                <span>
                  <i className={"caries"} />
                  {"Caries"}
                </span>
                <span>
                  <i className={"restaurado"} />
                  {"Restaurado"}
                </span>
                <span>
                  <i className={"ausente"} />
                  {"Ausente"}
                </span>
                <span>
                  <i className={"realizado"} />
                  {"Tratamiento realizado"}
                </span>
                <span>
                  <i className={"indicado"} />
                  {"Tratamiento indicado"}
                </span>
              </div>
              <p className={"chart-help"}>{"Selecciona una de las cinco zonas del círculo para registrar su estado y observación. La vista frontal permite editar toda la pieza."}</p>
              <div className={"chart-scroll"} tabIndex={"0"} aria-label={"Odontograma completo; desplázate horizontalmente en pantallas pequeñas"}>
                <div className={"dental-chart dental-quadrants"}>
                  <section className={"quadrant q1"}>
                    <div className={"quadrant-title"}>
                      <span>{"Cuadrante I"}</span>
                      <strong>{"Superior derecho"}</strong>
                      <small aria-hidden={"true"}>{"18 · 17 · 16 · 15 · 14 · 13 · 12 · 11"}</small>
                    </div>
                    <div className="arc" id="q1">{GRUPOS.q1.map((number) => <Tooth key={number} number={number} chart={chart} selection={selection} disabled={controlsDisabled} select={select} />)}</div>
                  </section>
                  <section className={"quadrant q2"}>
                    <div className={"quadrant-title"}>
                      <span>{"Cuadrante II"}</span>
                      <strong>{"Superior izquierdo"}</strong>
                      <small aria-hidden={"true"}>{"21 · 22 · 23 · 24 · 25 · 26 · 27 · 28"}</small>
                    </div>
                    <div className="arc" id="q2">{GRUPOS.q2.map((number) => <Tooth key={number} number={number} chart={chart} selection={selection} disabled={controlsDisabled} select={select} />)}</div>
                  </section>
                  <section className={"quadrant q3"}>
                    <div className={"quadrant-title"}>
                      <span>{"Cuadrante III"}</span>
                      <strong>{"Inferior izquierdo"}</strong>
                      <small aria-hidden={"true"}>{"31 · 32 · 33 · 34 · 35 · 36 · 37 · 38"}</small>
                    </div>
                    <div className="arc" id="q3">{GRUPOS.q3.map((number) => <Tooth key={number} number={number} chart={chart} selection={selection} disabled={controlsDisabled} select={select} />)}</div>
                  </section>
                  <section className={"quadrant q4"}>
                    <div className={"quadrant-title"}>
                      <span>{"Cuadrante IV"}</span>
                      <strong>{"Inferior derecho"}</strong>
                      <small aria-hidden={"true"}>{"48 · 47 · 46 · 45 · 44 · 43 · 42 · 41"}</small>
                    </div>
                    <div className="arc" id="q4">{GRUPOS.q4.map((number) => <Tooth key={number} number={number} chart={chart} selection={selection} disabled={controlsDisabled} select={select} />)}</div>
                  </section>
                </div>
              </div>
              <p className={"chart-orientation"}>
                {"Derecha del paciente "}
                <span>{"Numeración FDI · 32 piezas permanentes"}</span>
                {" Izquierda del paciente"}
              </p>
            </div>
            {"\n"}
            <aside className={"tooth-editor"}>
              <div className={"editor-icon"}>
                <span className={"material-symbols-outlined"}>{"dentistry"}</span>
              </div>
              <h2 id={"editorTitulo"}>{selection ? "Diente " + selection.number : "Selecciona un diente"}</h2>
              <p className={"editor-sub"}>{"Cada zona circular tiene su propio estado y observación. Las posiciones superior, inferior, derecha e izquierda se refieren al dibujo; no cambian al seleccionar otra pieza."}</p>
              <label>{"Zona a editar"}</label>
              <div className={"superficies"} id={"superficies"}>
                <button type={"button"} data-cara="toda" className={surface === "toda" ? "active" : ""} aria-pressed={surface === "toda"} disabled={editorDisabled} onClick={() => select(selection.number, "toda")}>{"Pieza completa"}</button>
                <button type={"button"} data-cara="superior" className={surface === "superior" ? "active" : ""} aria-pressed={surface === "superior"} disabled={editorDisabled} onClick={() => select(selection.number, "superior")}>{"Superior"}</button>
                <button type={"button"} data-cara="izquierda" className={surface === "izquierda" ? "active" : ""} aria-pressed={surface === "izquierda"} disabled={editorDisabled} onClick={() => select(selection.number, "izquierda")}>{"Izquierda"}</button>
                <button type={"button"} data-cara="central" className={surface === "central" ? "active" : ""} aria-pressed={surface === "central"} disabled={editorDisabled} onClick={() => select(selection.number, "central")}>{"Central"}</button>
                <button type={"button"} data-cara="derecha" className={surface === "derecha" ? "active" : ""} aria-pressed={surface === "derecha"} disabled={editorDisabled} onClick={() => select(selection.number, "derecha")}>{"Derecha"}</button>
                <button type={"button"} data-cara="inferior" className={surface === "inferior" ? "active" : ""} aria-pressed={surface === "inferior"} disabled={editorDisabled} onClick={() => select(selection.number, "inferior")}>{"Inferior"}</button>
              </div>
              <p id={"superficieActual"} className={"surface-caption"}>{selection ? whole ? "Pieza completa" : "Superficie " + SUPERFICIES[surface].toLowerCase() : "Selecciona una superficie"}</p>
              <label>{"Estado de la zona seleccionada"}</label>
              <div className={"estados"} id={"estados"}>
                <button data-estado="sano" className={selection && draft.estado === "sano" ? "active" : ""} aria-pressed={Boolean(selection && draft.estado === "sano")} disabled={editorDisabled} onClick={() => { setDraft((value) => ({ ...value, estado: "sano", explicit: true })); markDirty(); }}>
                  <i className={"sano"} />
                  {"Sano"}
                </button>
                <button data-estado="caries" className={selection && draft.estado === "caries" ? "active" : ""} aria-pressed={Boolean(selection && draft.estado === "caries")} disabled={editorDisabled} onClick={() => { setDraft((value) => ({ ...value, estado: "caries", explicit: true })); markDirty(); }}>
                  <i className={"caries"} />
                  {"Caries"}
                </button>
                <button data-estado="restaurado" className={selection && draft.estado === "restaurado" ? "active" : ""} aria-pressed={Boolean(selection && draft.estado === "restaurado")} disabled={editorDisabled} onClick={() => { setDraft((value) => ({ ...value, estado: "restaurado", explicit: true })); markDirty(); }}>
                  <i className={"restaurado"} />
                  {"Restaurado"}
                </button>
                <button data-estado="ausente" className={selection && draft.estado === "ausente" ? "active" : ""} aria-pressed={Boolean(selection && draft.estado === "ausente")} disabled={editorDisabled} onClick={() => { setDraft((value) => ({ ...value, estado: "ausente", explicit: true })); markDirty(); }}>
                  <i className={"ausente"} />
                  {"Ausente"}
                </button>
                <button data-estado="realizado" className={selection && draft.estado === "realizado" ? "active" : ""} aria-pressed={Boolean(selection && draft.estado === "realizado")} disabled={editorDisabled} onClick={() => { setDraft((value) => ({ ...value, estado: "realizado", explicit: true })); markDirty(); }}>
                  <i className={"realizado"} />
                  {"Tratamiento realizado"}
                </button>
                <button data-estado="indicado" className={selection && draft.estado === "indicado" ? "active" : ""} aria-pressed={Boolean(selection && draft.estado === "indicado")} disabled={editorDisabled} onClick={() => { setDraft((value) => ({ ...value, estado: "indicado", explicit: true })); markDirty(); }}>
                  <i className={"indicado"} />
                  {"Tratamiento indicado"}
                </button>
              </div>
              <label htmlFor={"observacion"}>{"Observación"}</label>
              <textarea id="observacion" value={draft.observacion} disabled={editorDisabled} onChange={(event) => { const observacion = event.target.value; setDraft((value) => ({ ...value, observacion })); markDirty(); }} rows={"6"} placeholder={"Observación de la zona seleccionada…"} />
              <p id={"saveStatus"} className={"save-status"} role={"status"} aria-live={"polite"}>{status}</p>
              <button className={"btn-aplicar"} id="btnAplicar" disabled={editorDisabled} onClick={apply}>{!selection ? "Aplicar a la pieza" : whole ? "Aplicar a toda la pieza" : "Aplicar a esta superficie"}</button>
            </aside>
          </section>
          {"\n"}
          <section className={"stats-card"}>
            <h2>{"Estadísticas generales de la dentición"}</h2>
            <table className={"stats-table"}>
              <thead>
                <tr>
                  <th>{"Estado"}</th>
                  <th>{"Cantidad"}</th>
                  <th>{"Porcentaje"}</th>
                  <th>{"Distribución"}</th>
                </tr>
              </thead>
              <tbody id="statsBody">{ESTADOS.map((state) => {
                const pct = counts[state] / 32 * 100;
                return <tr key={state}>
                  <td><span className={"badge-dot " + state} />{ETIQUETAS[state]}</td>
                  <td><strong>{counts[state]}</strong></td>
                  <td>{pct.toFixed(1)}%</td>
                  <td><div className="stat-bar"><span className={state} style={{ width: pct + "%" }} /></div></td>
                </tr>;
              })}</tbody>
            </table>
            <p className={"stats-note"} id={"statsNote"}>{loaded ? "De 32 piezas permanentes, " + counts.sano + " están registradas como sanas y " + (32 - counts.sano) + " presentan algún hallazgo o tratamiento. En piezas con varios estados se resume: ausente, caries, indicado, restaurado, realizado y sano; consulta cada superficie para ver el detalle." : "Selecciona y actualiza las piezas para ver el estado general del paciente."}</p>
          </section>
          {"\n"}
        </div>
      </div>
    </>
  );
}

