import { useEffect, useRef, useState } from "react";
import { request } from "./api.js";
import * as agenda from "./agenda.js";

function scheduleQuery(date, hour, treatment) {
  const query = new URLSearchParams({ fecha: date });
  if (hour) query.set("hora", hour);
  if (treatment !== "0") query.set("id_tratamiento", treatment);
  return query;
}

export default function Reservation({ user, close, booked }) {
  const [catalog, setCatalog] = useState(null);
  const [doctor, setDoctor] = useState("");
  const [treatment, setTreatment] = useState("0");
  const [date, setDate] = useState(agenda.today);
  const [hour, setHour] = useState("");
  const [reason, setReason] = useState("");
  const [availability, setAvailability] = useState(null);
  const [alternativeRequest, setAlternativeRequest] = useState(null);
  const [alternative, setAlternative] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, refresh] = useState(0);
  const closeButton = useRef(null);
  const day = agenda.today();
  const professional = catalog?.doctors.find((item) => String(item.id_odontologo) === doctor);
  const office = catalog?.offices.find((item) => Number(item.id_consultorio) === Number(professional?.id_consultorio));
  const key = [doctor, date, hour, treatment, revision].join("|");
  const schedule = availability?.key === key ? availability : null;
  const alternatives = alternativeRequest?.key === key ? alternativeRequest : null;
  const suggestion = alternatives === alternative?.request ? alternative : null;
  const suggestions = schedule?.horarios || [];
  const outsideHours = hour && (hour < "08:00" || hour >= "18:00" ||
    agenda.minutes(hour) + (schedule?.duracion_minutos || 0) > agenda.minutes("18:00"));
  const validation = outsideHours
    ? "La cita debe quedar completa entre las 08:00 y las 18:00."
    : hour && date && (date < day || (date === day && hour <= agenda.currentTime()))
    ? "Selecciona una fecha y hora futuras."
    : hour && schedule?.hora_disponible === false
      ? "Ese horario ya no está disponible. Elige otro horario o busca otro odontólogo."
      : "";
  const canBook = Boolean(date && hour && doctor && schedule?.hora_disponible && !validation && !saving);

  useEffect(() => {
    const abort = new AbortController();
    const options = { signal: abort.signal };
    closeButton.current?.focus();
    Promise.all([request("/odontologos", options), request("/tratamientos", options), request("/consultorios", options)])
      .then(([doctors, treatments, offices]) => {
        setCatalog({ doctors, treatments, offices });
        setDoctor(doctors[0] ? String(doctors[0].id_odontologo) : "");
      })
      .catch((error) => {
        if (!abort.signal.aborted) setLoadError("No se pudo cargar la reserva: " + error.message);
      });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    function onEscape(event) {
      if (event.key === "Escape" && !saving) close();
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [close, saving]);

  useEffect(() => {
    if (!date || !doctor) return;
    const abort = new AbortController();
    request("/citas/disponibilidad/odontologo/" + doctor + "?" + scheduleQuery(date, hour, treatment), { signal: abort.signal })
      .then((value) => setAvailability({ ...value, key }))
      .catch((error) => {
        if (!abort.signal.aborted) setAvailability({ key, error: error.message });
      });
    return () => abort.abort();
  }, [key, doctor, date, hour, treatment]);

  useEffect(() => {
    if (!alternatives) return;
    const abort = new AbortController();
    const query = scheduleQuery(date, hour, treatment);
    query.set("odontologo_id", doctor);
    request("/citas/disponibilidad/alternativa?" + query, { signal: abort.signal })
      .then((slot) => setAlternative({ request: alternatives, slot }))
      .catch((error) => {
        if (!abort.signal.aborted) setAlternative({ request: alternatives, error: error.message });
      });
    return () => abort.abort();
  }, [alternatives, date, hour, treatment, doctor]);

  function change(set) {
    return (event) => {
      setSubmitError("");
      setAlternativeRequest(null);
      set(event.target.value);
    };
  }

  function chooseSlot(slot) {
    setHour(slot);
    setSubmitError("");
    setAlternativeRequest(null);
  }

  function chooseAlternative(slot) {
    setDoctor(String(slot.id_odontologo));
    setDate(slot.fecha);
    chooseSlot(slot.hora);
  }

  async function submit(event) {
    event.preventDefault();
    if (!canBook) return;
    setSaving(true);
    setSubmitError("");
    try {
      await request("/citas/reservar/paciente", {
        method: "POST",
        body: { id_usuario: Number(user.id_usuario), id_odontologo: Number(doctor), id_tratamiento: Number(treatment) || null,
          fecha: date, hora: hour, motivo_consulta: reason.trim() || null },
      });
    } catch (error) {
      refresh((value) => value + 1);
      setSubmitError(error.message);
      setSaving(false);
      return;
    }
    booked();
  }

  return (
    <div id="modalReserva" className="agenda-overlay open" role="dialog" aria-modal="true" aria-labelledby="reservaTitulo"
      onClick={(event) => { if (event.target === event.currentTarget && !saving) close(); }}>
      <div className="agenda-dialog">
        <div className="agenda-dialog-head">
          <div><div className="agenda-eyebrow">RESERVA ONLINE</div><h3 id="reservaTitulo">Agenda tu cita</h3></div>
          <button type="button" className="agenda-close" aria-label="Cerrar reserva" ref={closeButton} disabled={saving} onClick={close}>×</button>
        </div>
        <form id="reservaForm" onSubmit={submit}>
          <label className="agenda-field" htmlFor="reservaTratamiento">¿Qué atención necesitas?
            <select id="reservaTratamiento" value={treatment} onChange={change(setTreatment)} required>
              <option value="0">Valoración inicial</option>
              {catalog?.treatments.map((item) => <option key={item.id_tratamiento} value={item.id_tratamiento}>
                {item.nombre} · {agenda.duration(item)} minutos
              </option>)}
            </select>
          </label>
          <label className="agenda-field" htmlFor="reservaOdontologo">Odontólogo
            <select id="reservaOdontologo" value={doctor} onChange={change(setDoctor)} required>
              {catalog?.doctors.map((item) => <option key={item.id_odontologo} value={item.id_odontologo}>
                {item.nombre} {item.apellido}{item.especialidad ? " · " + item.especialidad : ""}
              </option>)}
              {catalog && !catalog.doctors.length && <option value="">No hay odontólogos registrados</option>}
            </select>
          </label>
          <p id="reservaDoctorInfo" className="agenda-note">
            {professional && (office?.nombre || "Consultorio asignado") + (professional.horario ? " · " + professional.horario : "")}
          </p>
          <div className="agenda-form-row">
            <label className="agenda-field" htmlFor="reservaFecha">Fecha
              <input id="reservaFecha" type="date" min={day} value={date} onChange={change(setDate)} required />
            </label>
            <label className="agenda-field" htmlFor="reservaHora">Hora de inicio
              <input id="reservaHora" type="time" min="08:00" max="17:59" step="900" value={hour} onChange={change(setHour)} required />
            </label>
          </div>
          <p id="reservaDuracion" className="agenda-note">
            {schedule?.duracion_minutos ? "Duración estimada: " + schedule.duracion_minutos + " minutos · " : ""}Hora de Colombia
          </p>
          <div id="reservaDisponibilidad" className="reserva-disponibilidad" aria-live="polite">
            {!date || !doctor ? "Selecciona odontólogo y fecha" : !schedule ? "Consultando disponibilidad…" :
              schedule.error ? "No se pudo comprobar la disponibilidad" : <>
                <strong>Horarios sugeridos disponibles</strong>
                <div className="reserva-horas">
                  {suggestions.length ? suggestions.map((slot) => <button key={slot} type="button" data-hora={slot}
                    className={slot === hour ? "active" : ""} onClick={() => chooseSlot(slot)}>{slot}</button>)
                    : <p>No hay horarios sugeridos para esta fecha.</p>}
                </div>
              </>}
          </div>
          <p className="agenda-note">Horario de atención de 08:00 a 18:00. La cita debe terminar dentro de ese horario.</p>
          <button type="button" className="agenda-btn" id="btnBuscarAlternativa"
            disabled={!doctor || !date || date < day || saving || Boolean(alternatives && !suggestion)}
            onClick={() => setAlternativeRequest({ key })}>
            {alternatives && !suggestion ? "Buscando…" : "Buscar otro odontólogo"}
          </button>
          {alternatives && <div id="reservaAlternativa" className="reserva-disponibilidad reserva-alternativa" aria-live="polite">
            {!suggestion ? "Consultando el próximo horario libre…" :
              suggestion.error ? "No se pudo buscar otro odontólogo. " + suggestion.error :
              suggestion.slot ? <>
                <strong>{suggestion.slot.odontologo}</strong>
                <p>{agenda.formatDate(suggestion.slot.fecha)} · {suggestion.slot.hora} · {suggestion.slot.consultorio}</p>
                <button type="button" className="agenda-btn" id="btnUsarAlternativa" disabled={saving}
                  onClick={() => chooseAlternative(suggestion.slot)}>Usar este horario</button>
              </> : "No encontramos otro odontólogo disponible para esta atención en los próximos 30 días desde la fecha solicitada."}
          </div>}
          <label className="agenda-field" htmlFor="reservaMotivo">Motivo de tu consulta (opcional)
            <textarea id="reservaMotivo" rows={2} maxLength={1000} placeholder="Cuéntanos qué necesitas…" value={reason} onChange={change(setReason)} />
          </label>
          <p id="reservaError" className="agenda-form-error" role="alert">{loadError || submitError || schedule?.error || validation}</p>
          <div className="agenda-dialog-actions">
            <button type="button" className="agenda-btn" onClick={close} disabled={saving}>Volver</button>
            <button type="submit" className="agenda-btn primary" id="btnReservar" disabled={!canBook}>{saving ? "Reservando…" : "Confirmar cita"}</button>
          </div>
          <p className="agenda-note">La cita quedará En Espera y aparecerá en tu listado y en la agenda del odontólogo.</p>
        </form>
      </div>
    </div>
  );
}
