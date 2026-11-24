import { useCallback, useEffect, useState } from "react";
import { Toast, useToast } from "./authUi.jsx";
import { request } from "./api.js";
import { signOut, useUser } from "./session.js";
import { VoiceField } from "./VoiceField.jsx";

const emptyRole = { id: null, nombre: "", descripcion: "", permisos: "READ ONLY" };
const colors = { "FULL ACCESS": "red", "READ / UPDATE": "blue", "READ ONLY": "green" };

function RoleRows({ roles, loadError, edit, remove }) {
  if (!roles?.length) {
    const text = loadError ? "❌ Error de conexión: " + loadError
      : roles ? "Sin roles. Crea el primero." : "Cargando...";
    return <tr><td colSpan={5} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>{text}</td></tr>;
  }
  return roles.map((role) => (
    <tr key={role.id}>
      <td><strong>{role.id}</strong></td>
      <td><strong>{role.nombre}</strong></td>
      <td>{role.descripcion || "—"}</td>
      <td><span className={"badge " + (colors[role.permisos] || "blue")}>{role.permisos || "—"}</span></td>
      <td>
        <button className="btn-icon" title="Editar" onClick={() => edit(role.id)}><span className="material-symbols-outlined">edit</span></button>
        {" "}
        <button className="btn-danger" title="Eliminar" onClick={() => remove(role.id)}><span className="material-symbols-outlined">delete</span></button>
      </td>
    </tr>
  ));
}

export default function RolesPage({ navigate }) {
  const user = useUser(navigate, true);
  const [roles, setRoles] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, showToast] = useToast(3500);
  const load = useCallback(async (signal) => {
    try {
      setRoles(await request("/roles", { signal }));
      setLoadError("");
    } catch (error) {
      if (signal?.aborted) return;
      setRoles(null);
      setLoadError(error.message);
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    const abort = new AbortController();
    load(abort.signal);
    return () => abort.abort();
  }, [Boolean(user), load]);

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function edit(id) {
    try {
      const role = await request("/roles/" + id);
      setForm({ ...emptyRole, ...role, descripcion: role.descripcion || "", permisos: role.permisos || "READ ONLY" });
    } catch (error) {
      showToast("❌ " + error.message, "error");
    }
  }

  async function save(event) {
    if (busy || !form) return;
    const nombre = form.nombre.trim();
    if (!nombre) {
      showToast("⚠️ Por favor, ingresa el nombre del rol", "warning");
      event.currentTarget.closest(".modal").querySelector("#inNombre").focus();
      return;
    }
    setBusy(true);
    try {
      await request(form.id ? "/roles/" + form.id : "/roles", {
        method: form.id ? "PUT" : "POST",
        body: { nombre, descripcion: form.descripcion.trim(), permisos: form.permisos },
      });
      showToast(form.id ? "✅ Rol actualizado correctamente" : "✅ Rol creado correctamente");
      setForm(null);
      await load();
    } catch (error) {
      showToast("❌ " + (error.message || "Error al guardar"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este rol? Esta acción no se puede deshacer.")) return;
    try {
      await request("/roles/" + id, { method: "DELETE" });
      showToast("✅ Rol eliminado correctamente");
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
      <div id="modalRol" className={"modal-overlay" + (form ? " open" : "")}>
        {"\n        "}
        <div className={"modal"}>
          {"\n            "}
          <h3>
            {"\n                "}
            <span className={"material-symbols-outlined"}>{"manage_accounts"}</span>
            {"\n                "}
            <span id={"modalTitulo"}>{form?.id ? "Editar Rol" : "Nuevo Rol"}</span>
            {"\n            "}
          </h3>
          {"\n            "}
          <input type="hidden" id="editId" value={form?.id ?? ""} />
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>
              {"Nombre del Rol "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n                "}
            <VoiceField type="text" id="inNombre" placeholder="Ej. Odontólogo" value={form?.nombre ?? ""} onValue={(value) => change("nombre", value)} />
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"Descripción Operativa"}</label>
            {"\n                "}
            <VoiceField as="textarea" id="inDescripcion" rows={3} placeholder="Descripción del rol..." value={form?.descripcion ?? ""} onValue={(value) => change("descripcion", value)} />
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"Nivel de Permisos"}</label>
            {"\n                "}
            <select id="inPermisos" value={form?.permisos ?? emptyRole.permisos} onChange={(event) => change("permisos", event.target.value)}>
              {"\n                    "}
              <option value={"FULL ACCESS"}>{"FULL ACCESS"}</option>
              {"\n                    "}
              <option value={"READ / UPDATE"}>{"READ / UPDATE"}</option>
              {"\n                    "}
              <option value={"READ ONLY"}>{"READ ONLY"}</option>
              {"\n                "}
            </select>
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"modal-footer"}>
            {"\n                "}
            <button className={"btn-cancelar"} onClick={() => setForm(null)}>{"Cancelar"}</button>
            {"\n                "}
            <button className="btn-guardar" id="btnGuardarRol" onClick={save} disabled={busy}>
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
            <a href="/roles" className={"active"}>
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
            <a href="/proveedores">
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
              <h2>{"Roles y Permisos del Sistema"}</h2>
              {"\n                    "}
              <p style={{ color: "var(--text-muted)" }}>{"Gestión de accesos y privilegios"}</p>
              {"\n                "}
            </div>
            {"\n                "}
            <button className={"btn-primary"} onClick={() => setForm(emptyRole)}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"add_moderator"}</span>
              {" Nuevo Rol\n                "}
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
                  <th>{"ID"}</th>
                  {"\n                            "}
                  <th>{"Nombre del Rol"}</th>
                  {"\n                            "}
                  <th>{"Descripción"}</th>
                  {"\n                            "}
                  <th>{"Permisos"}</th>
                  {"\n                            "}
                  <th>{"Acciones"}</th>
                  {"\n                        "}
                </tr>
                {"\n                    "}
              </thead>
              {"\n                    "}
              <tbody id={"tablaRoles"}>
                <RoleRows roles={roles} loadError={loadError} edit={edit} remove={remove} />
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

