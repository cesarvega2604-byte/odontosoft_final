import { useEffect, useState } from "react";
import { request } from "./api.js";
import { formatDate, today } from "./agenda.js";

const endpoint = "/bloqueos-agenda";
const labels = {
  descanso_puntual: "Descanso de un día",
  descanso_diario: "Descanso diario",
  vacaciones: "Vacaciones",
};

function describe(block) {
  if (block.tipo === "vacaciones") {
    return formatDate(block.fecha_desde) + " al " + formatDate(block.fecha_hasta) + " · Días completos";
  }
  const interval = block.hora_desde.slice(0, 5) + " a " + block.hora_hasta.slice(0, 5);
  return (block.fecha_desde ? formatDate(block.fecha_desde) : "Todos los días") + " · " + interval;
}

export function AgendaBlocks() {
  const [expanded, setExpanded] = useState(false);
  const [blocks, setBlocks] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const day = today();

  useEffect(() => {
    if (!expanded) return;
    const abort = new AbortController();
    setError("");
    request(endpoint, { signal: abort.signal })
      .then((items) => { if (!abort.signal.aborted) setBlocks(items); })
      .catch((failure) => { if (!abort.signal.aborted) setError(failure.message); });
    return () => abort.abort();
  }, [expanded]);

  function edit(block) {
    setError("");
    setNotice("");
    setDraft({
      id_bloqueo: block?.id_bloqueo,
      tipo: block?.tipo || "descanso_puntual",
      fecha_desde: block?.fecha_desde || day,
      fecha_hasta: block?.fecha_hasta || day,
      hora_desde: block?.hora_desde?.slice(0, 5) || "14:00",
      hora_hasta: block?.hora_hasta?.slice(0, 5) || "15:00",
    });
  }

  function bind(field) {
    return {
      value: draft[field],
      onChange: (event) => {
        const value = event.target.value;
        setError("");
        setDraft((current) => ({ ...current, [field]: value }));
      },
    };
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const { id_bloqueo, tipo, fecha_desde, fecha_hasta, hora_desde, hora_hasta } = draft;
    const vacation = tipo === "vacaciones";
    if (!vacation && hora_desde >= hora_hasta) {
      setError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await request(id_bloqueo ? endpoint + "/" + id_bloqueo : endpoint, {
        method: id_bloqueo ? "PUT" : "POST",
        body: {
          tipo,
          fecha_desde: tipo === "descanso_diario" ? null : fecha_desde,
          fecha_hasta: vacation ? fecha_hasta : null,
          hora_desde: vacation ? null : hora_desde,
          hora_hasta: vacation ? null : hora_hasta,
        },
      });
      setBlocks((items) => [...items.filter((item) => item.id_bloqueo !== saved.id_bloqueo), saved].sort(
        (first, second) => (first.fecha_desde || "").localeCompare(second.fecha_desde || "") ||
          first.id_bloqueo - second.id_bloqueo,
      ));
      setDraft(null);
      setNotice("Bloqueo guardado.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(block) {
    if (busy || !window.confirm("¿Quitar este bloqueo de tu agenda?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(endpoint + "/" + block.id_bloqueo, { method: "DELETE" });
      setBlocks((items) => items.filter((item) => item.id_bloqueo !== block.id_bloqueo));
      if (draft?.id_bloqueo === block.id_bloqueo) setDraft(null);
      setNotice("Bloqueo retirado.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <details className="agenda-card agenda-blocks" onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary>Descansos y vacaciones</summary>
    {expanded && <>
      <p className="agenda-note">Un descanso de un día sustituye al descanso diario en esa fecha. Las vacaciones bloquean días completos.</p>
      {blocks?.length ? <ul className="agenda-block-list">
        {blocks.map((block) => <li key={block.id_bloqueo}>
          <div><strong>{labels[block.tipo]}</strong><p>{describe(block)}</p></div>
          <div className="agenda-block-actions">
            <button type="button" className="agenda-btn" disabled={busy} onClick={() => edit(block)}>Editar</button>
            <button type="button" className="agenda-btn" disabled={busy} onClick={() => remove(block)}>Quitar</button>
          </div>
        </li>)}
      </ul> : <p className="agenda-muted">{blocks ? "Aún no tienes bloqueos próximos." : error ? "" : "Cargando tus bloqueos…"}</p>}
      {draft ? <form id="agendaBloqueoForm" onSubmit={save}>
        <fieldset className="agenda-block-fields" disabled={busy}>
          <label className="agenda-field">Tipo de bloqueo
            <select id="bloqueoTipo" {...bind("tipo")}>
              {Object.entries(labels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
            </select>
          </label>
          <div className="agenda-form-row">
            {draft.tipo !== "descanso_diario" && <label className="agenda-field">
              {draft.tipo === "vacaciones" ? "Primer día" : "Fecha del descanso"}
              <input id="bloqueoFechaDesde" type="date"
                min={draft.tipo === "vacaciones" && draft.id_bloqueo ? undefined : day} {...bind("fecha_desde")} required />
            </label>}
            {draft.tipo === "vacaciones" && <label className="agenda-field">Último día
              <input id="bloqueoFechaHasta" type="date" min={draft.fecha_desde > day ? draft.fecha_desde : day}
                {...bind("fecha_hasta")} required />
            </label>}
          </div>
          {draft.tipo !== "vacaciones" && <div className="agenda-form-row">
            <label className="agenda-field">Inicio del descanso
              <input id="bloqueoHoraDesde" type="time" {...bind("hora_desde")} required />
            </label>
            <label className="agenda-field">Fin del descanso
              <input id="bloqueoHoraHasta" type="time" {...bind("hora_hasta")} required />
            </label>
          </div>}
          <div className="agenda-block-actions">
            <button className="agenda-btn primary" type="submit">{busy ? "Guardando…" : "Guardar bloqueo"}</button>
            <button className="agenda-btn" type="button" onClick={() => { setDraft(null); setError(""); }}>Cancelar</button>
          </div>
        </fieldset>
      </form> : <button className="agenda-btn primary" type="button" id="btnNuevoBloqueo"
        onClick={() => edit()} disabled={!blocks || busy}>Agregar bloqueo</button>}
      {error && <p className="agenda-form-error" role="alert">{error}</p>}
      {notice && <p className="agenda-note" role="status">{notice}</p>}
    </>}
  </details>;
}
