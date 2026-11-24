import { useEffect, useState } from "react";
import { apiOrigin, request } from "./api.js";
import { getUser, normalizeRole } from "./session.js";

const empty = { nombre: "", precio: "", descripcion: "", tiene_imagen: false };
const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 });
const imageUrl = (item) => apiOrigin + "/productos/" + item.id_producto + "/imagen";

function useProductos() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request("/productos", { signal: controller.signal })
      .then(setItems)
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  return { items, setItems, error };
}

export function CatalogoProductos() {
  const { items, error } = useProductos();
  return <section className="seccion productos-publicos" id="productos">
    <div className="seccion-header">
      <h2>Productos odontológicos</h2>
    </div>
    {error && <p role="status">El catálogo no está disponible en este momento.</p>}
    {items?.length === 0 && <p>Aún no hay productos publicados.</p>}
    {items?.length > 0 && <div className="productos-grid">
      {items.map((item) => <article className="producto-card" key={item.id_producto}>
        {item.tiene_imagen && <img loading="lazy" src={imageUrl(item)} alt={item.nombre} />}
        <div>
          <h3>{item.nombre}</h3>
          <p>{item.descripcion}</p>
          <strong>{pesos.format(Number(item.precio))}</strong>
        </div>
      </article>)}
    </div>}
  </section>;
}

function leerImagen(file) {
  if (file.size > 4 * 1024 * 1024) throw new Error("La foto debe pesar hasta 4 MB.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () => reject(new Error("No se pudo leer la foto."));
    reader.readAsDataURL(file);
  });
}

export default function Products({ navigate }) {
  const admin = normalizeRole(getUser()?.rol) === "administrador";
  useEffect(() => {
    if (!admin) navigate("/login", { replace: true });
  }, [admin, navigate]);
  return admin ? <Administrar /> : null;
}

function Administrar() {
  const { items, setItems, error } = useProductos();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);

  function abrir(item) {
    setAlert("");
    setStatus("");
    setForm(item ? { ...item } : { ...empty });
  }

  async function guardar(event) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const file = fields.get("imagen");
    setBusy(true);
    setAlert("");
    try {
      const saved = await request(form.id_producto ? "/productos/" + form.id_producto : "/productos", {
        method: form.id_producto ? "PUT" : "POST",
        body: {
          nombre: fields.get("nombre"), precio: fields.get("precio"), descripcion: fields.get("descripcion"),
          imagen: file?.size ? await leerImagen(file) : null,
          quitar_imagen: fields.has("quitar_imagen"),
        },
      });
      setItems((old) => [saved, ...old.filter((item) => item.id_producto !== saved.id_producto)]
        .sort((a, b) => b.id_producto - a.id_producto));
      setRevision((old) => old + 1);
      setForm(null);
      setStatus("Producto guardado.");
    } catch (e) {
      setAlert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function eliminar(item) {
    if (busy || !window.confirm("¿Eliminar «" + item.nombre + "» del catálogo?")) return;
    setBusy(true);
    setAlert("");
    setStatus("");
    try {
      await request("/productos/" + item.id_producto, { method: "DELETE" });
      setItems((old) => old.filter((value) => value.id_producto !== item.id_producto));
      if (form?.id_producto === item.id_producto) setForm(null);
      setStatus("Producto eliminado.");
    } catch (e) {
      setAlert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="productos-admin">
    <header>
      <a href="/panel">← Volver al panel</a>
      <h1>Productos</h1>
      <button className="agenda-btn primary" disabled={busy || !items} onClick={() => abrir()}>Agregar producto</button>
    </header>
    {form && <form className="agenda-card" key={form.id_producto || "nuevo"} onSubmit={guardar}>
      <h2>{form.id_producto ? "Editar producto" : "Nuevo producto"}</h2>
      <fieldset disabled={busy}>
        <div className="agenda-form-row">
          <label className="agenda-field">Nombre<input name="nombre" maxLength="120" defaultValue={form.nombre} required /></label>
          <label className="agenda-field">Precio en pesos colombianos
            <input name="precio" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={form.precio} required />
          </label>
        </div>
        <label className="agenda-field">Descripción
          <textarea name="descripcion" rows="4" maxLength="2000" defaultValue={form.descripcion} required />
        </label>
        <label className="agenda-field">Imagen del producto
          <input name="imagen" type="file" accept="image/jpeg,image/png,image/webp" />
          <span className="agenda-muted">JPG, PNG o WebP de hasta 4 MB.</span>
        </label>
        {form.tiene_imagen && <label className="producto-quitar-imagen"><input name="quitar_imagen" type="checkbox" /> Quitar imagen actual</label>}
        <div className="agenda-dialog-actions">
          <button type="submit" className="agenda-btn primary">{busy ? "Guardando…" : "Guardar producto"}</button>
          <button type="button" className="agenda-btn" onClick={() => { setForm(null); setAlert(""); }}>Cancelar</button>
        </div>
      </fieldset>
    </form>}
    {(error || alert) && <p className="agenda-form-error" role="alert">{alert || error}</p>}
    {status && <p role="status">{status}</p>}
    {!items && !error && <p role="status">Cargando productos…</p>}
    {items?.length === 0 && <p>Aún no hay productos publicados.</p>}
    <ul className="productos-admin-list">
      {items?.map((item) => <li key={item.id_producto}>
        {item.tiene_imagen && <img src={imageUrl(item) + "?v=" + revision} alt="" />}
        <div><strong>{item.nombre}</strong><p>{item.descripcion}</p><span>{pesos.format(Number(item.precio))}</span></div>
        <div className="producto-actions">
          <button type="button" className="agenda-btn" disabled={busy} onClick={() => abrir(item)}>Editar</button>
          <button type="button" className="agenda-btn" disabled={busy} onClick={() => eliminar(item)}>Eliminar</button>
        </div>
      </li>)}
    </ul>
  </main>;
}
