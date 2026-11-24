import { useEffect, useState } from "react";
import { request } from "./api.js";
import { AuthCard, SubmitButton } from "./authUi.jsx";

const ratings = [1, 2, 3, 4, 5];

export default function Survey({ hash = "" }) {
  const token = new URLSearchParams(hash.slice(1)).get("token") || "";
  const [rating, setRating] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await request("/encuestas/responder", { method: "POST", body: {
        token, estrellas: rating, comentario: String(data.get("comentario")).trim(),
        publicar: data.has("publicar"),
      } });
      setSent(true);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <AuthCard icon="dentistry" subtitle="Encuesta de satisfacción">
    {sent ? <p className="encuesta-respuesta" role="status">Gracias por tu opinión. Ya aparece en la página de OdontoSoft.</p> :
      !/^[A-Za-z0-9_-]{43}$/.test(token) ? <p className="encuesta-respuesta">Abre el enlace de la encuesta que recibiste por correo.</p> :
      <form onSubmit={submit} className="encuesta-form">
        <fieldset disabled={busy} className="encuesta-estrellas">
          <legend>¿Cómo fue la atención en tu cita?</legend>
          <div>
            {ratings.map((value) => <label key={value} className={value <= rating ? "seleccionada" : ""}>
              <input type="radio" name="estrellas" value={value} checked={value === rating} required
                aria-label={value + (value === 1 ? " estrella" : " estrellas")}
                onChange={() => setRating(value)} />
              <span aria-hidden="true">★</span>
            </label>)}
          </div>
        </fieldset>
        <label className="encuesta-campo" htmlFor="encuesta-comentario">Comentario</label>
        <textarea id="encuesta-comentario" name="comentario" rows="4" maxLength="600" required disabled={busy} />
        <label className="encuesta-consentimiento">
          <input type="checkbox" name="publicar" required disabled={busy} />
          <span>Acepto que mi calificación y comentario sean públicos y aparezcan sin mi nombre.</span>
        </label>
        <p className="encuesta-nota">Evita incluir datos personales o médicos en tu comentario.</p>
        {error && <p className="encuesta-error" role="alert">{error}</p>}
        <SubmitButton busy={busy} icon="send" busyLabel="Publicando…">Publicar opinión</SubmitButton>
      </form>}
    <p className="link-login"><a href="/#opiniones">Ver opiniones</a></p>
  </AuthCard>;
}

export function Opiniones() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    if (window.location.hash === "#opiniones") document.getElementById("opiniones")?.scrollIntoView();
    request("/opiniones", { signal: abort.signal }).then((page) => {
      setItems(page.opiniones);
      setCursor(page.siguiente);
    }).catch(() => {
      if (!abort.signal.aborted) setError("No se pudieron cargar las opiniones.");
    }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, []);

  async function cargarMas() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const page = await request("/opiniones" + (cursor ? "?antes_de=" + cursor : ""));
      setItems((old) => [...old, ...page.opiniones]);
      setCursor(page.siguiente);
    } catch {
      setError("No se pudieron cargar las opiniones.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="seccion opiniones" id="opiniones">
    <div className="seccion-titulo"><h2>Opiniones de pacientes</h2></div>
    {!items.length && !busy && !error && <p className="opiniones-aviso">Aún no hay opiniones publicadas.</p>}
    {items.length > 0 && <div className="opiniones-grid">
      {items.map((opinion, index) => <article key={index}>
        <div className="calificacion" aria-label={opinion.estrellas + " de 5 estrellas"}>
          <span aria-hidden="true">{"★".repeat(opinion.estrellas)}<span>{"★".repeat(5 - opinion.estrellas)}</span></span>
        </div>
        <p>{opinion.comentario}</p>
      </article>)}
    </div>}
    {busy && <p className="opiniones-aviso" role="status">Cargando opiniones…</p>}
    {error && <p className="opiniones-aviso" role="alert">{error}</p>}
    {(cursor || error) && <div className="opiniones-mas">
      <button type="button" onClick={cargarMas} disabled={busy}>{error ? "Reintentar" : "Ver más opiniones"}</button>
    </div>}
  </section>;
}
