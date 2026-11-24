import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api.js";
import { Toast, useToast } from "./authUi.jsx";
import { normalizeRole, signOut, useUser } from "./session.js";
import { VoiceField } from "./VoiceField.jsx";

const blank = { id: null, nombre: "", descripcion: "", precio: "" };
const integer = new Intl.NumberFormat("es-CO");
const digits = (value) => String(value || "").replace(/\D/g, "");
const currency = (value) => "$ " + integer.format(Number(value) || 0) + " COP";

function Icon({ children, spinner = false }) {
  return <span className={"material-symbols-outlined" + (spinner ? " spinner" : "")}>{children}</span>;
}

function Rows({ data, error, dentist, edit, remove }) {
  if (error || !data?.length) return (
    <tr><td colSpan={5} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
      {error ? "❌ Error al cargar los datos: " + error : data ? "Sin tratamientos registrados" : "Cargando..."}
    </td></tr>
  );
  return data.map((item, index) => (
    <tr key={item.id_tratamiento}>
      <td><strong>{index + 1}</strong></td><td><strong>{item.nombre || "—"}</strong></td>
      <td>{item.descripcion || "—"}</td><td><span className="precio-tabla">{currency(item.costo)}</span></td>
      <td>{dentist ? <span className="solo-lectura-tratamiento" title="El odontólogo solo puede consultar tratamientos">
        <Icon>visibility</Icon> Solo lectura
      </span> : <>
        <button className="btn-icon" title="Editar" onClick={() => edit(item.id_tratamiento)}><Icon>edit</Icon></button>
        {" "}<button className="btn-danger" title="Eliminar" onClick={() => remove(item)}><Icon>delete</Icon></button>
      </>}</td>
    </tr>
  ));
}

export default function Treatments({ navigate }) {
  const user = useUser(navigate);
  const role = user?.rol;
  const dentist = normalizeRole(role) !== "administrador";
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, showToast] = useToast(3500);
  const modal = useRef(null);

  const load = useCallback(async (signal) => {
    try {
      const items = await request("/tratamientos", { signal });
      setRows([...items].sort((a, b) => a.id_tratamiento - b.id_tratamiento));
      setError("");
    } catch (failure) {
      if (signal?.aborted) return;
      setError(failure.message);
      showToast("❌ No se pudo conectar con la API", "error");
    }
  }, [showToast]);

  const authorized = Boolean(user);
  useEffect(() => {
    if (!authorized) return;
    const pending = new AbortController();
    load(pending.signal);
    return () => pending.abort();
  }, [authorized, load]);

  const creating = Boolean(form && !form.id);
  useEffect(() => {
    if (!creating) return;
    const timer = setTimeout(() => modal.current?.querySelector("#inNombre")?.focus(), 100);
    return () => clearTimeout(timer);
  }, [creating]);

  function update(field, value) {
    setForm((current) => current ? { ...current, [field]: value } : current);
  }

  async function edit(id) {
    if (dentist) return;
    try {
      const item = await request("/tratamientos/" + id);
      setForm({ id: item.id_tratamiento, nombre: item.nombre || "", descripcion: item.descripcion || "",
        precio: Number(item.costo) > 0 ? integer.format(Number(digits(item.costo))) : "" });
    } catch {
      showToast("❌ Error al cargar el tratamiento", "error");
    }
  }

  async function save() {
    if (!form || saving || dentist) return;
    const nombre = form.nombre.trim();
    const descripcion = form.descripcion.trim();
    const costo = Number(digits(form.precio));
    const validation = !nombre ? ["⚠️ Por favor, ingresa el nombre del tratamiento", "#inNombre"] :
      costo <= 0 ? ["⚠️ Por favor, ingresa un precio válido", "#inPrecio"] :
      costo > 99999999 ? ["⚠️ El precio máximo permitido es $ 99.999.999 COP.", "#inPrecio"] : null;
    if (validation) {
      showToast(validation[0], "warning");
      modal.current?.querySelector(validation[1])?.focus();
      return;
    }
    setSaving(true);
    try {
      await request(form.id ? "/tratamientos/" + form.id : "/tratamientos", {
        method: form.id ? "PUT" : "POST",
        body: { nombre, descripcion, costo },
      });
      showToast(form.id ? "✅ Tratamiento actualizado correctamente" : "✅ Tratamiento creado correctamente");
      setForm(null);
      await load();
    } catch (failure) {
      showToast("❌ " + (failure.message || "Error al guardar"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!pendingDelete || deleting || dentist) return;
    setDeleting(true);
    try {
      await request("/tratamientos/" + pendingDelete.id_tratamiento, { method: "DELETE" });
      setPendingDelete(null);
      showToast("✅ Tratamiento eliminado correctamente");
      await load();
    } catch (failure) {
      showToast("❌ " + (failure.message || "Error al eliminar"), "error");
    } finally {
      setDeleting(false);
    }
  }

  if (!authorized) return null;
  return (
    <>
      {"\n\n    "}
      {"\n\n    "}
      <Toast message={message} />
      {"\n\n\n    "}
      {"\n\n    "}
      <div id="confirmModal" className={"confirm-overlay" + (pendingDelete ? " open" : "")} onClick={(event) => { if (!deleting && event.target === event.currentTarget) setPendingDelete(null); }}>
        {"\n\n        "}
        <div className={"confirm-modal"}>
          {"\n\n            "}
          <span className={"material-symbols-outlined confirm-icon warning"} id={"confirmIcon"}>{"\n                warning\n            "}</span>
          {"\n\n            "}
          <h3 id={"confirmTitulo"}>{"\n                ¿Eliminar este tratamiento?\n            "}</h3>
          {"\n\n            "}
          <p id={"confirmMensaje"}>{"\n                Esta acción no se puede deshacer.\n                El tratamiento será eliminado permanentemente del sistema.\n            "}</p>
          {"\n\n            "}
          <div className={"tratamiento-info"} id={"tratamientoInfo"}>
            {"\n\n                "}
            <strong>{"Nombre:"}</strong>
            {"\n\n                "}
            <span id={"confirmNombre"} className={"nombre-tratamiento"}>{pendingDelete?.nombre || "—"}</span>
            {"\n\n                "}
            <br />
            {"\n\n                "}
            <strong>{"Precio:"}</strong>
            {"\n\n                "}
            <span id={"confirmPrecio"} className={"info-text"}>{pendingDelete ? currency(pendingDelete.costo) : "—"}</span>
            {"\n\n            "}
          </div>
          {"\n\n            "}
          <div className={"confirm-footer"} id={"confirmFooter"}>
            {"\n\n                "}
            <button className={"btn-confirm-cancelar"} onClick={() => setPendingDelete(null)} disabled={deleting}>
              {"\n\n                    "}
              <span className={"material-symbols-outlined"}>{"\n                        close\n                    "}</span>
              {"\n\n                    Cancelar\n\n                "}
            </button>
            {"\n\n                "}
            <button className={"btn-confirm-eliminar"} id={"btnConfirmEliminar"} onClick={remove} disabled={deleting}><Icon spinner={deleting}>{deleting ? "progress_activity" : "delete"}</Icon> {deleting ? "Eliminando..." : "Eliminar"}</button>
            {"\n\n            "}
          </div>
          {"\n\n        "}
        </div>
        {"\n\n    "}
      </div>
      {"\n\n\n    "}
      {"\n\n    "}
      <div className={"modal-overlay" + (form ? " open" : "")} id="modalTrat" ref={modal} onClick={(event) => { if (!saving && event.target === event.currentTarget) setForm(null); }}>
        {"\n\n        "}
        <div className={"modal"}>
          {"\n\n            "}
          <h3>
            {"\n\n                "}
            <span className={"material-symbols-outlined"}>{"\n                    medical_services\n                "}</span>
            {"\n\n                "}
            <span id={"modalTitulo"}>{form?.id ? "Editar Tratamiento" : "Nuevo Tratamiento"}</span>
            {"\n\n            "}
          </h3>
          {"\n\n\n            "}
          {"\n\n            "}
          <input id="editId" type="hidden" value={form?.id ?? ""} />
          {"\n\n\n            "}
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n\n                "}
            <label htmlFor={"inNombre"}>
              {"\n                    Nombre del Tratamiento\n                    "}
              <span className={"required"}>{"*"}</span>
              {"\n                "}
            </label>
            {"\n\n                "}
            <VoiceField id="inNombre" type={"text"} placeholder={"Ej. Limpieza Dental"} autoComplete={"off"} value={form?.nombre ?? ""} onValue={(value) => update("nombre", value)} />
            {"\n\n            "}
          </div>
          {"\n\n\n            "}
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n\n                "}
            <label htmlFor={"inDescripcion"}>{"\n                    Descripción\n                "}</label>
            {"\n\n                "}
            <VoiceField as="textarea" id="inDescripcion" rows={"3"} placeholder={"Descripción del procedimiento..."} value={form?.descripcion ?? ""} onValue={(value) => update("descripcion", value)} />
            {"\n\n            "}
          </div>
          {"\n\n\n            "}
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n\n                "}
            <label htmlFor={"inPrecio"}>
              {"\n\n                    Precio Base\n\n                    "}
              <span className={"required"}>{"*"}</span>
              {"\n\n                "}
            </label>
            {"\n\n                "}
            <div className={"precio-input"}>
              {"\n\n                    "}
              <span className={"simbolo-cop"}>{"\n                        $\n                    "}</span>
              {"\n\n                    "}
              <input id="inPrecio" value={form?.precio ?? ""} onChange={(event) => {
                const amount = digits(event.target.value).slice(0, 8);
                update("precio", amount ? integer.format(Number(amount)) : "");
              }} type={"text"} inputMode={"numeric"} autoComplete={"off"} placeholder={"150.000"} maxLength={"11"} aria-describedby={"precioAyuda"} />
              {"\n\n                    "}
              <span className={"texto-cop"}>{"\n                        COP\n                    "}</span>
              {"\n\n                "}
            </div>
            {"\n\n                "}
            <small className={"ayuda-precio"}>{"\n                    Ingresa el valor en pesos colombianos.\n                    Ejemplo: 150.000\n                "}</small>
            {"\n\n            "}
          </div>
          {"\n\n\n            "}
          {"\n\n            "}
          <div className={"modal-footer"}>
            {"\n\n                "}
            <button className={"btn-cancelar"} onClick={() => setForm(null)} disabled={saving}>
              {"\n\n                    "}
              <span className={"material-symbols-outlined"}>{"\n                        close\n                    "}</span>
              {"\n\n                    Cancelar\n\n                "}
            </button>
            {"\n\n\n                "}
            <button className={"btn-guardar"} id={"btnGuardarTratamiento"} onClick={save} disabled={saving}><Icon spinner={saving}>{saving ? "progress_activity" : "save"}</Icon> {saving ? "Guardando..." : "Guardar"}</button>
            {"\n\n            "}
          </div>
          {"\n\n        "}
        </div>
        {"\n\n    "}
      </div>
      {"\n\n\n    "}
      {"\n\n    "}
      <div className={"dashboard-container"}>
        {"\n\n\n        "}
        {"\n\n        "}
        <aside className={"sidebar"}>
          {"\n\n            "}
          <div className={"sidebar-brand"}>
            {"\n\n                "}
            <span className={"material-symbols-outlined"}>{"\n                    dentistry\n                "}</span>
            {"\n\n                "}
            <span>{"\n                    OdontoSoft\n                "}</span>
            {"\n\n            "}
          </div>
          {"\n\n\n            "}
          <nav className={"sidebar-menu"}>
            {"\n\n                "}
            <a href={dentist ? "/panel_odontologo" : "/panel"}>
              {"\n\n                    "}
              <span className={"material-symbols-outlined"}>{"\n                        group\n                    "}</span>
              {"\n\n                    Usuarios\n\n                "}
            </a>
            {"\n\n\n                "}
            {!dentist && <a href="/roles">
              {"\n\n                    "}
              <span className={"material-symbols-outlined"}>{"\n                        manage_accounts\n                    "}</span>
              {"\n\n                    Roles\n\n                "}
            </a>}
            {"\n\n\n                "}
            <a className={"active"} href="/tratamientos">
              {"\n\n                    "}
              <span className={"material-symbols-outlined"}>{"\n                        medical_services\n                    "}</span>
              {"\n\n                    Tratamientos\n\n                "}
            </a>
            {"\n\n\n                "}
            <a href="/citas">
              {"\n\n                    "}
              <span className={"material-symbols-outlined"}>{"\n                        calendar_month\n                    "}</span>
              {"\n\n                    Citas\n\n                "}
            </a>
            {"\n\n\n                "}
            {!dentist && <a href="/proveedores">
              {"\n\n                    "}
              <span className={"material-symbols-outlined"}>{"\n                        local_shipping\n                    "}</span>
              {"\n\n                    Proveedores\n\n                "}
            </a>}
            {"\n\n                "}
            <a href="/login" onClick={signOut}>
              {"\n\n                    "}
              <span className={"material-symbols-outlined"}>{"\n                        logout\n                    "}</span>
              {"\n\n                    Salir\n\n                "}
            </a>
            {"\n\n            "}
          </nav>
          {"\n\n        "}
        </aside>
        {"\n\n\n        "}
        {"\n\n        "}
        <main className={"main-content"}>
          {"\n\n\n            "}
          {"\n\n            "}
          <header className={"content-header"}>
            {"\n\n                "}
            <div>
              {"\n\n                    "}
              <h2>{"\n                        Catálogo de Tratamientos\n                    "}</h2>
              {"\n\n                    "}
              <p style={{ color: "var(--text-muted)" }}>{"\n                        Gestión de tratamientos odontológicos\n                    "}</p>
              {"\n\n                "}
            </div>
            {"\n\n\n                "}
            <button id={"btnNuevoTratamiento"} className={"btn-primary"} onClick={() => setForm(blank)} style={dentist ? { display: "none" } : undefined}>
              {"\n\n                    "}
              <span className={"material-symbols-outlined"}>{"\n                        add\n                    "}</span>
              {"\n\n                    Nuevo Tratamiento\n\n                "}
            </button>
            {"\n\n            "}
          </header>
          {"\n\n\n            "}
          {"\n\n            "}
          <section className={"table-container"}>
            {"\n\n                "}
            <table>
              {"\n\n                    "}
              <thead>
                {"\n\n                        "}
                <tr>
                  {"\n\n                            "}
                  <th>{"\n                                ID\n                            "}</th>
                  {"\n\n                            "}
                  <th>{"\n                                Nombre\n                            "}</th>
                  {"\n\n                            "}
                  <th>{"\n                                Descripción\n                            "}</th>
                  {"\n\n                            "}
                  <th>{"\n                                Precio Base\n                            "}</th>
                  {"\n\n                            "}
                  <th>{"\n                                Acciones\n                            "}</th>
                  {"\n\n                        "}
                </tr>
                {"\n\n                    "}
              </thead>
              {"\n\n\n                    "}
              <tbody id={"tablaTratamientos"}><Rows data={rows} error={error} dentist={dentist} edit={edit} remove={setPendingDelete} /></tbody>
              {"\n\n                "}
            </table>
            {"\n\n            "}
          </section>
          {"\n\n        "}
        </main>
        {"\n\n    "}
      </div>
      {"\n\n\n    "}
      {"\n\n    "}
    </>
  );
}

