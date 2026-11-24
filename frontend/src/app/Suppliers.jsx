import { useCallback, useEffect, useState } from "react";
import { Toast, useToast } from "./authUi.jsx";
import { request } from "./api.js";
import { signOut, useUser } from "./session.js";
import { VoiceField } from "./VoiceField.jsx";

const emptySupplier = { id: null, empresa: "", contacto_asesor: "", telefono: "", suministro: "", estado_convenio: "Vigente" };
const colors = { Vigente: "green", Vencido: "red", Suspendido: "yellow" };

function SupplierRows({ suppliers, loadError, edit, remove }) {
  if (!suppliers?.length) {
    const text = loadError ? "❌ Error de conexión: " + loadError
      : suppliers ? "Sin proveedores registrados" : "Cargando...";
    return <tr><td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>{text}</td></tr>;
  }
  return suppliers.map((supplier) => (
    <tr key={supplier.id}>
      <td><strong>{supplier.empresa}</strong></td>
      <td>{supplier.contacto_asesor || "—"}</td>
      <td>{supplier.telefono || "—"}</td>
      <td>{supplier.suministro || "—"}</td>
      <td><span className={"badge " + (colors[supplier.estado_convenio] || "green")}>{supplier.estado_convenio}</span></td>
      <td>
        <button className="btn-icon" title="Editar" onClick={() => edit(supplier.id)}><span className="material-symbols-outlined">edit</span></button>
        {" "}
        <button className="btn-danger" title="Eliminar" onClick={() => remove(supplier.id)}><span className="material-symbols-outlined">delete</span></button>
      </td>
    </tr>
  ));
}

export default function Suppliers({ navigate }) {
  const user = useUser(navigate, true);
  const [suppliers, setSuppliers] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, showToast] = useToast(3500);
  const load = useCallback(async (signal) => {
    try {
      setSuppliers(await request("/proveedores", { signal }));
      setLoadError("");
    } catch (error) {
      if (signal?.aborted) return;
      setSuppliers(null);
      setLoadError(error.message);
    }
  }, []);
  const authorized = Boolean(user);
  useEffect(() => {
    if (!authorized) return;
    const abort = new AbortController();
    load(abort.signal);
    return () => abort.abort();
  }, [authorized, load]);

  function change(field, value) {
    setForm((current) => current ? { ...current, [field]: value } : current);
  }

  async function edit(id) {
    try {
      const supplier = await request("/proveedores/" + id);
      setForm({ ...emptySupplier, ...supplier });
    } catch {
      showToast("❌ Error al cargar el proveedor", "error");
    }
  }

  async function save(event) {
    if (busy || !form) return;
    const { id, estado_convenio } = form;
    const empresa = form.empresa.trim();
    const telefono = form.telefono.trim();
    if (!empresa || !telefono) {
      showToast(empresa ? "⚠️ Por favor, ingresa el teléfono del proveedor" : "⚠️ Por favor, ingresa el nombre de la empresa", "warning");
      event.currentTarget.closest(".modal").querySelector(empresa ? "#inTelefono" : "#inEmpresa").focus();
      return;
    }
    const body = { empresa, telefono, estado_convenio, contacto_asesor: (form.contacto_asesor || "").trim(), suministro: (form.suministro || "").trim() };
    setBusy(true);
    try {
      await request(id ? "/proveedores/" + id : "/proveedores", { method: id ? "PUT" : "POST", body });
      showToast(id ? "✅ Proveedor actualizado correctamente" : "✅ Proveedor registrado correctamente");
      setForm(null);
      await load();
    } catch (error) {
      showToast("❌ " + (error.message || "Error al guardar"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este proveedor? Esta acción no se puede deshacer.")) return;
    try {
      await request("/proveedores/" + id, { method: "DELETE" });
      showToast("✅ Proveedor eliminado correctamente");
      await load();
    } catch (error) {
      showToast("❌ " + (error.message || "Error al eliminar"), "error");
    }
  }
  if (!user) return null;
  return (
    <>
      {"\n    "}
      <Toast message={loadError && !message.text ? { text: "❌ No se pudo conectar con el servidor", type: "error", visible: true } : message} />
      {"\n\n    "}
      {"\n    "}
      <div id="modalProveedor" className={"modal-overlay" + (form ? " open" : "")}>
        {"\n        "}
        <div className={"modal"}>
          {"\n            "}
          <h3>
            {"\n                "}
            <span className={"material-symbols-outlined"}>{"local_shipping"}</span>
            {"\n                "}
            <span id={"modalTitulo"}>{form?.id ? "Editar Proveedor" : "Nuevo Proveedor"}</span>
            {"\n            "}
          </h3>
          {"\n            "}
          <input type="hidden" id="editId" value={form?.id ?? ""} />
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>
              {"Empresa / Proveedor "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n                "}
            <VoiceField type={"text"} id={"inEmpresa"} placeholder={"Ej. Dental S.A.S"} value={form?.empresa ?? ""} onValue={(value) => change("empresa", value)} />
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"Contacto Asesor"}</label>
            {"\n                "}
            <VoiceField type={"text"} id={"inContacto"} placeholder={"Nombre del asesor"} value={form?.contacto_asesor ?? ""} onValue={(value) => change("contacto_asesor", value)} />
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>
              {"Teléfono "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n                "}
            <VoiceField type={"text"} id={"inTelefono"} placeholder={"3001234567"} value={form?.telefono ?? ""} onValue={(value) => change("telefono", value)} />
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"Suministro / Producto"}</label>
            {"\n                "}
            <VoiceField type={"text"} id={"inSuministro"} placeholder={"Ej. Insumos odontológicos"} value={form?.suministro ?? ""} onValue={(value) => change("suministro", value)} />
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"Estado del Convenio"}</label>
            {"\n                "}
            <select id="inEstado" value={form?.estado_convenio ?? emptySupplier.estado_convenio} onChange={(event) => change("estado_convenio", event.target.value)}>
              {"\n                    "}
              <option value={"Vigente"}>{"Vigente"}</option>
              {"\n                    "}
              <option value={"Vencido"}>{"Vencido"}</option>
              {"\n                    "}
              <option value={"Suspendido"}>{"Suspendido"}</option>
              {"\n                "}
            </select>
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"modal-footer"}>
            {"\n                "}
            <button className={"btn-cancelar"} onClick={() => setForm(null)}>{"Cancelar"}</button>
            {"\n                "}
            <button className="btn-guardar" id="btnGuardarProveedor" onClick={save} disabled={busy}>
              <span className={"material-symbols-outlined" + (busy ? " spinner" : "")}>{busy ? "progress_activity" : "save"}</span>
              {" "}{busy ? "Guardando..." : "Guardar"}
            </button>
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n    "}
      </div>
      {"\n\n    "}
      {"\n    "}
      <div className={"dashboard-container"}>
        {"\n        "}
        <aside className={"sidebar"}>
          {"\n            "}
          <div className={"sidebar-brand"}>
            {"\n                "}
            <span className={"material-symbols-outlined"}>{"dentistry"}</span>
            {"\n                "}
            <span>{"OdontoSoft"}</span>
            {"\n            "}
          </div>
          {"\n            "}
          <nav className={"sidebar-menu"}>
            {"\n                "}
            <a href="/panel">
              <span className={"material-symbols-outlined"}>{"group"}</span>
              {" Usuarios"}
            </a>
            {"\n                "}
            <a href="/roles">
              <span className={"material-symbols-outlined"}>{"manage_accounts"}</span>
              {" Roles"}
            </a>
            {"\n                "}
            <a href="/tratamientos">
              <span className={"material-symbols-outlined"}>{"medical_services"}</span>
              {" Tratamientos"}
            </a>
            {"\n                "}
            <a href="/citas">
              <span className={"material-symbols-outlined"}>{"calendar_month"}</span>
              {" Citas"}
            </a>
            {"\n                "}
            <a href="/proveedores" className={"active"}>
              <span className={"material-symbols-outlined"}>{"local_shipping"}</span>
              {" Proveedores"}
            </a>
            {"\n                "}
            <a href="/login" onClick={signOut}>
              <span className={"material-symbols-outlined"}>{"logout"}</span>
              {" Salir"}
            </a>
            {"\n            "}
          </nav>
          {"\n        "}
        </aside>
        {"\n\n        "}
        <main className={"main-content"}>
          {"\n            "}
          <header className={"content-header"}>
            {"\n                "}
            <div>
              {"\n                    "}
              <h2>{"Gestión de Proveedores"}</h2>
              {"\n                    "}
              <p style={{ color: "var(--text-muted)" }}>{"Administra los convenios y contactos comerciales"}</p>
              {"\n                "}
            </div>
            {"\n                "}
            <button className={"btn-primary"} onClick={() => setForm(emptySupplier)}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"add"}</span>
              {" Nuevo Proveedor\n                "}
            </button>
            {"\n            "}
          </header>
          {"\n\n            "}
          <section className={"table-container"}>
            {"\n                "}
            <table>
              {"\n                    "}
              <thead>
                {"\n                        "}
                <tr>
                  {"\n                            "}
                  <th>{"Empresa"}</th>
                  {"\n                            "}
                  <th>{"Contacto"}</th>
                  {"\n                            "}
                  <th>{"Teléfono"}</th>
                  {"\n                            "}
                  <th>{"Suministro"}</th>
                  {"\n                            "}
                  <th>{"Estado"}</th>
                  {"\n                            "}
                  <th>{"Acciones"}</th>
                  {"\n                        "}
                </tr>
                {"\n                    "}
              </thead>
              {"\n                    "}
              <tbody id={"tablaProveedores"}>
                <SupplierRows suppliers={suppliers} loadError={loadError} edit={edit} remove={remove} />
              </tbody>
              {"\n                "}
            </table>
            {"\n            "}
          </section>
          {"\n        "}
        </main>
        {"\n    "}
      </div>
      {"\n\n    "}
    </>
  );
}

