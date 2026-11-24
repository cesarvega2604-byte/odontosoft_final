import { useState } from "react";
import { normalizeRole } from "./session.js";
import * as agenda from "./agenda.js";

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function Calendar({ appointments, doctors, dentist, patientName, open, create, refresh }) {
  const [reference, setReference] = useState(() => new Date(agenda.today() + "T12:00:00"));
  const [dateInput, setDateInput] = useState(agenda.today);
  const [view, setView] = useState("mes");
  const [chosenDoctor, setChosenDoctor] = useState("");
  const [search, setSearch] = useState("");
  const monthly = view === "mes";
  const doctor = dentist ? String(doctors[0]?.id_odontologo || "") : chosenDoctor;
  const start = new Date(reference);
  const month = start.getMonth();
  if (monthly) start.setDate(1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const query = normalizeRole(search);
  const days = new Map();
  for (const appointment of appointments) {
    if (doctor && Number(appointment.id_odontologo) !== Number(doctor)) continue;
    if (query && !normalizeRole(patientName(appointment.id_paciente) + " " + agenda.treatment(appointment)).includes(query)) continue;
    const date = days.get(appointment.fecha) ?? [];
    date.push(appointment);
    days.set(appointment.fecha, date);
  }
  for (const items of days.values()) items.sort(agenda.order);
  const periods = Array.from({ length: monthly ? 42 : 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    const date = agenda.localDate(day);
    return { day, date, items: days.get(date) || [] };
  });
  const total = periods.reduce((sum, day) => sum + day.items.length, 0);

  function move(delta) {
    setReference((value) => {
      const next = new Date(value);
      if (monthly) {
        next.setDate(1);
        next.setMonth(next.getMonth() + delta);
      } else {
        next.setDate(next.getDate() + delta * 7);
      }
      return next;
    });
  }

  return (
    <section className="agenda-card calendario-shell" aria-label="Calendario de citas">
      <header className="cal-toolbar">
        <div><div className="agenda-eyebrow">AGENDA ODONTOSOFT</div>
          <h2 id="calTitulo">{monthly ? reference.toLocaleDateString("es-CO", { month: "long", year: "numeric" }) : "Semana del " + agenda.formatDate(agenda.localDate(start))}</h2>
          <p className="agenda-muted">Hora de Colombia · America/Bogota</p>
        </div>
        <div className="cal-nav">
          <button className="agenda-btn" id="calAnterior" aria-label="Periodo anterior" onClick={() => move(-1)}>‹</button>
          <button className="agenda-btn" id="calHoy" onClick={() => setReference(new Date(agenda.today() + "T12:00:00"))}>Hoy</button>
          <button className="agenda-btn" id="calSiguiente" aria-label="Periodo siguiente" onClick={() => move(1)}>›</button>
          <select id="calVista" aria-label="Vista del calendario" value={view} onChange={(event) => setView(event.target.value)}>
            <option value="mes">Mes</option><option value="semana">Semana</option>
          </select>
        </div>
      </header>
      <div className="cal-layout">
        <aside className="cal-aside">
          <label className="agenda-field" htmlFor="calFecha">Ir a una fecha
            <input type="date" id="calFecha" value={dateInput} onChange={(event) => {
              const value = event.target.value;
              setDateInput(value);
              if (value) setReference(new Date(value + "T12:00:00"));
            }} />
          </label>
          <label className="agenda-field" htmlFor="calOdontologo">Odontólogo
            <select id="calOdontologo" value={doctor} disabled={dentist} onChange={(event) => setChosenDoctor(event.target.value)}>
              <option value="">Todos los odontólogos</option>
              {doctors.map((item) => <option key={item.id_odontologo} value={item.id_odontologo}>{item.nombre} {item.apellido}</option>)}
            </select>
          </label>
          <label className="agenda-field" htmlFor="calBuscar">Buscar paciente o tratamiento
            <input type="search" id="calBuscar" placeholder="Nombre o tratamiento…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="cal-legend">
            <strong>Estados</strong>
            <span><i className="espera" />Pendiente / En espera</span>
            <span><i className="consulta" />En consulta</span>
            <span><i className="confirmada" />Confirmada</span>
            <span><i className="finalizada" />Finalizada</span>
            <span><i className="cancelada" />Cancelada</span>
          </div>
          <p id="calResumen" className="agenda-muted" aria-live="polite">{total} {total === 1 ? "cita" : "citas"} en este periodo{total ? "" : ". Puedes agendar con el botón + de cada día."}</p>
          <button className="agenda-btn" id="calActualizar" onClick={refresh}>Actualizar agenda</button>
          <p className="agenda-note" id="calSync">Actualizado {agenda.currentTime()} · Se actualiza cada 15 s</p>
        </aside>
        <div className="cal-scroll">
          <div className="cal-weekdays">{weekdays.map((name) => <span key={name}>{name}</span>)}</div>
          <div id="calGrid" className={"cal-grid" + (monthly ? "" : " week-view")} aria-label="Días y citas">
            {periods.map(({ day, date, items }) => <section key={date}
              className={"cal-day" + (monthly && day.getMonth() !== month ? " other-month" : "") + (date === agenda.today() ? " is-today" : "")}
              aria-label={agenda.formatDate(date)}>
              <div className="cal-day-head"><span>{day.getDate()}</span>
                <button data-nueva-fecha={date} aria-label={"Agendar el " + date} title="Nueva cita" onClick={() => create(date, doctor)}>+</button>
              </div>
              <div className="cal-events">{items.map((item) => <button key={item.id_cita} className={"cal-event " + agenda.tone(item)}
                data-cita={item.id_cita} onClick={(event) => open(item, event.currentTarget)}>
                <span className="cal-event-time">{agenda.time(item)} · {item.duracion_minutos || 30} min</span>
                <strong>{patientName(item.id_paciente)}</strong><span>{agenda.treatment(item)}</span>
              </button>)}</div>
            </section>)}
          </div>
        </div>
      </div>
    </section>
  );
}
