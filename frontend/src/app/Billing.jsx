import { useCallback, useEffect, useRef, useState } from "react";
import { apiOrigin, request } from "./api.js";
import { AgendaIcon } from "./agendaIcons.jsx";
import { getUser, normalizeRole } from "./session.js";

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" });
const dateTime = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota",
});
const methods = ["Efectivo", "Transferencia", "Tarjeta", "Otro"];
const emailStatus = { pendiente: "Pendiente", enviado: "Enviado", omitido: "Sin envío" };
const dateOnly = (value) => value.split("-").reverse().join("/");

function Invoices({ invoices, admin }) {
  if (!invoices.length) return <p className="odonto-muted">Aún no hay comprobantes para mostrar.</p>;
  return <div className="odonto-table-scroll"><table className="odonto-table">
    <thead><tr>
      <th>Comprobante</th>{admin && <th>Paciente</th>}<th>Servicio</th><th>Emisión</th><th>Total</th>
      {admin && <th>Correo</th>}<th>Archivo</th>
    </tr></thead>
    <tbody>{invoices.map((invoice) => <tr key={invoice.id_factura}>
      <th scope="row">{invoice.numero}</th>
      {admin && <td>{invoice.cliente ?? "Sin dato registrado"}</td>}
      <td>{invoice.concepto ?? "Servicio odontológico"}</td>
      <td>
        {invoice.emitida_en ? dateTime.format(new Date(invoice.emitida_en)) : dateOnly(invoice.fecha_emision)}
        {invoice.solicitada_en ? (
          <small>Compra solicitada el {dateTime.format(new Date(invoice.solicitada_en))}</small>
        ) : !invoice.emitida_en && <small>Hora sin registrar</small>}
      </td>
      <td>{invoice.total === null ? "—" : money.format(invoice.total)}</td>
      {admin && <td>{emailStatus[invoice.estado_correo] ?? "—"}</td>}
      <td><a className="odonto-link" download href={apiOrigin + "/facturas/" + invoice.id_factura + "/pdf"}
        aria-label={"Descargar PDF " + invoice.numero}>Descargar PDF</a></td>
    </tr>)}</tbody>
  </table></div>;
}

export default function Billing({ navigate }) {
  const user = getUser();
  const role = normalizeRole(user?.rol);
  const admin = role === "administrador";
  const allowed = admin || role === "paciente";
  const back = admin ? "/panel" : "/panel_cliente";
  const [data, setData] = useState(null);
  const [person, setPerson] = useState("");
  const [service, setService] = useState("");
  const [filter, setFilter] = useState("");
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const purchaseKey = useRef(null);

  const load = useCallback(async (signal) => {
    const options = { signal };
    const [invoices, purchases, people, services] = await Promise.all([
      request("/facturas/", options), request("/compras-servicio/", options),
      request("/pacientes", options), request("/tratamientos", options),
    ]);
    setData({ invoices, purchases, people, services: services.filter((item) => Number(item.costo) > 0) });
  }, []);

  useEffect(() => {
    if (!user || !allowed) {
      navigate(user ? "/panel_odontologo" : "/login", { replace: true });
      return;
    }
    const abort = new AbortController();
    load(abort.signal).catch((error) => { if (!abort.signal.aborted) setFeedback({ error: error.message }); });
    return () => abort.abort();
  }, [user, allowed, load, navigate]);

  const profile = data?.people.find((entry) => entry.correo === user?.correo) ??
    (data?.people.length === 1 ? data.people[0] : null);
  const patientId = admin ? Number(person) : profile?.id_paciente;
  const selectedService = data?.services.find((entry) => entry.id_tratamiento === Number(service));
  const belongsTo = (entry) => !filter || String(entry.id_paciente) === filter;
  const pending = data?.purchases.filter((entry) => !entry.id_factura && belongsTo(entry)) ?? [];
  const historyPeople = new Map(data?.invoices.filter((row) => row.id_paciente !== null)
    .map((row) => [row.id_paciente, row.cliente ?? "Paciente"]));
  data?.people.forEach((row) => historyPeople.set(row.id_paciente, row.nombre + " " + row.apellido));

  async function buy(event) {
    event.preventDefault();
    if (!patientId || !selectedService || busy) return;
    const selection = patientId + "/" + service + "/" + selectedService.costo;
    if (purchaseKey.current?.selection !== selection) {
      purchaseKey.current = { selection, value: crypto.randomUUID() };
    }
    setBusy(true);
    setFeedback(null);
    try {
      await request("/compras-servicio/paciente/" + patientId, {
        method: "POST",
        body: { id_tratamiento: Number(service), clave: purchaseKey.current.value, precio: selectedService.costo },
      });
      await load();
      purchaseKey.current = null;
      setService("");
      setFeedback({ text: admin ? "Compra registrada. Selecciónala para confirmar el pago recibido." :
        "Solicitud recibida. El comprobante se emitirá cuando el consultorio confirme el pago." });
    } catch (error) {
      setFeedback({ error: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event) {
    event.preventDefault();
    if (busy || !payment?.method) return;
    setBusy(true);
    setFeedback(null);
    try {
      const invoice = await request("/compras-servicio/" + payment.id + "/confirmar-pago", {
        method: "POST", body: { metodo: payment.method },
      });
      await load();
      setPayment(null);
      setFeedback({ text: `Pago confirmado. Se emitió el comprobante ${invoice.numero}.` });
    } catch (error) {
      setFeedback({ error: error.message });
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) return null;
  return <main className="odonto-workspace">
    <a className="odonto-back" href={back}><AgendaIcon name="arrow_back" /> Volver al panel</a>
    <header className="odonto-feature-header">
      <div>
        <h1>Facturación</h1>
        <p>{admin ? "Confirma pagos y consulta los comprobantes de cada paciente." : "Solicita servicios y descarga tus comprobantes de pago."}</p>
      </div>
    </header>
    {feedback && <p className={feedback.error ? "odonto-feedback error" : "odonto-feedback"} role={feedback.error ? "alert" : "status"}>{feedback.error ?? feedback.text}</p>}
    {data === null && !feedback && <p role="status">Cargando facturación…</p>}
    {data && <>
      <section className="odonto-card">
        <h2>{admin ? "Registrar compra" : "Solicitar un servicio"}</h2>
        {data.services.length === 0 ? <p className="odonto-muted">No hay servicios con precio disponible.</p> :
          !admin && !profile ? <p className="odonto-muted">Tu perfil de paciente aún no está vinculado.</p> :
          <form className="odonto-inline-form" onSubmit={buy}>
            {admin && <label><span id="billing-patient-label">Paciente</span><select aria-labelledby="billing-patient-label" required value={person} onChange={(event) => setPerson(event.target.value)}>
              <option value="">Selecciona el paciente</option>
              {data.people.map((row) => <option key={row.id_paciente} value={row.id_paciente}>{row.nombre} {row.apellido} · {row.correo || "#" + row.id_paciente}</option>)}
            </select></label>}
            <label><span id="billing-service-label">Servicio</span><select aria-labelledby="billing-service-label" required value={service} onChange={(event) => setService(event.target.value)}>
              <option value="">Selecciona un servicio</option>
              {data.services.map((row) => <option key={row.id_tratamiento} value={row.id_tratamiento}>{row.nombre} · {money.format(row.costo)}</option>)}
            </select></label>
            <button className="odonto-primary" disabled={busy}>{admin ? "Registrar compra" : "Solicitar servicio"}</button>
          </form>}
        {!admin && <p className="odonto-muted">El pago se realiza con el consultorio.</p>}
      </section>
      {admin && <div className="odonto-card odonto-filter">
        <label><span id="billing-history-label">Filtrar historial por paciente</span><select aria-labelledby="billing-history-label" value={filter} onChange={(event) => { setFilter(event.target.value); setPayment(null); }}>
          <option value="">Todos los pacientes</option>
          {[...historyPeople].map(([id, name]) => <option key={id} value={id}>{name} · #{id}</option>)}
        </select></label>
      </div>}
      {pending.length > 0 && <section className="odonto-card">
        <h2>Compras pendientes de pago</h2>
        <ul className="odonto-phase-list">{pending.map((entry) => <li key={entry.id}>
          <div className="odonto-phase-main">
            <h3>{entry.concepto}</h3>
            <small>{admin && entry.cliente + " · "}{dateTime.format(new Date(entry.solicitada_en))}</small>
          </div>
          <strong>{money.format(entry.precio)}</strong>
          {admin && <button className="odonto-secondary" type="button" disabled={busy}
            onClick={() => setPayment({ id: entry.id, method: "" })}>Registrar pago</button>}
          {admin && payment?.id === entry.id && <form className="odonto-inline-form odonto-payment" onSubmit={confirm}>
            <label><span id="billing-payment-label">Medio de pago</span><select aria-labelledby="billing-payment-label" required value={payment.method}
              onChange={(event) => setPayment({ ...payment, method: event.target.value })}>
              <option value="">Selecciona el medio de pago</option>
              {methods.map((method) => <option key={method}>{method}</option>)}
            </select></label>
            <button className="odonto-primary" disabled={busy}>Confirmar pago recibido</button>
            <button className="odonto-secondary" type="button" disabled={busy} onClick={() => setPayment(null)}>Cancelar</button>
          </form>}
        </li>)}</ul>
      </section>}
      <section className="odonto-card">
        <div className="odonto-section-heading"><h2>Historial de facturación</h2><small>Hora de Colombia</small></div>
        <Invoices invoices={data.invoices.filter(belongsTo)} admin={admin} />
      </section>
    </>}
  </main>;
}
