import { useCallback, useEffect, useRef, useState } from "react";
import { PasswordInput, Toast, isEmail, useToast } from "./authUi.jsx";
import { getUser, normalizeRole, signOut } from "./session.js";
import { request } from "./api.js";
import { loadUserForm, saveUserForm } from "./userManagement.js";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, validNewPassword } from "./passwordPolicy.js";

const defaults = {
  id: null, correo: "", password: "", rol: "Paciente", estado: "Activo",
  nombre: "", apellido: "", documento: "", telefono: "", fecha_nacimiento: "",
  genero: "", direccion: "", eps: "", alergias: "", especialidad: "", id_consultorio: "",
};
const roleColors = { Administrador: "red", Odontologo: "blue", Paciente: "yellow" };

function Icon({ children, spinner = false }) {
  return <span className={"material-symbols-outlined" + (spinner ? " spinner" : "")}>{children}</span>;
}

function UserRows({ data, error, edit, remove }) {
  if (error || !data?.length) return <tr>
    <td colSpan={5} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
      {error ? "❌ Error de conexión: " + error : data ? "Sin usuarios registrados" : "Cargando..."}
    </td>
  </tr>;
  return data.map((user, index) => <tr key={user.id_usuario}>
    <td><strong>{index + 1}</strong></td><td>{user.correo}</td>
    <td><span className={"badge " + (roleColors[user.rol] || "blue")}>{user.rol || "—"}</span></td>
    <td><span className={"badge " + (user.estado === "Activo" ? "green" : "yellow")}>{user.estado || "—"}</span>{user.requiere_restablecer_contrasena && <><br /><small>Restablecimiento pendiente</small></>}</td>
    <td>
      <button className="btn-icon" title="Editar" onClick={() => edit(user.id_usuario)}><Icon>edit</Icon></button>
      {" "}<button className="btn-danger" title="Eliminar" onClick={() => remove(user)}><Icon>delete</Icon></button>
    </td>
  </tr>);
}

function formError(form) {
  const correo = form.correo.trim();
  const password = form.password;
  if (!correo) return ["Ingrese el correo.", "warning"];
  if (!isEmail(correo)) return ["Correo inválido.", "error"];
  if (!form.id && !password) return ["Ingrese una contraseña.", "warning"];
  if (password && !validNewPassword(password)) return [PASSWORD_HINT, "error"];
  const missing = !form.nombre.trim() || !form.apellido.trim() || !form.documento.trim() || !form.telefono.trim();
  if (form.rol === "Paciente" && missing) return ["Complete todos los datos del paciente.", "warning"];
  if (form.rol === "Odontologo" && (missing || !form.especialidad.trim() || !Number(form.id_consultorio))) {
    return ["Complete todos los datos del odontólogo.", "warning"];
  }
  if (form.rol === "Administrador" && missing) return ["Complete todos los datos del administrador.", "warning"];
  return null;
}

export default function UserDashboard({ navigate }) {
  const user = getUser();
  const role = normalizeRole(user?.rol);
  const authorized = Boolean(user) && role !== "odontologo" && role !== "paciente";
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [form, setForm] = useState(null);
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, showToast] = useToast(3500);
  const filterInput = useRef(null);

  const load = useCallback(async (signal) => {
    try {
      const rows = await request("/usuarios", { signal });
      setUsers(Array.isArray(rows) ? [...rows].sort((a, b) => a.id_usuario - b.id_usuario) : []);
      setError("");
      setFilter("");
      setRoleFilter("");
    } catch (failure) {
      if (signal?.aborted) return;
      setError(failure.message);
      showToast("❌ No se pudo conectar con el servidor", "error");
    }
  }, [showToast]);

  useEffect(() => {
    if (!authorized) {
      navigate(!user ? "/login" : role === "odontologo" ? "/panel_odontologo" : "/panel_cliente", { replace: true });
      return;
    }
    const pending = new AbortController();
    load(pending.signal);
    return () => pending.abort();
  }, [authorized, Boolean(user), role, navigate, load]);

  const filtered = users?.filter((item) =>
    (!roleFilter || item.rol === roleFilter) &&
    (!filter.trim() || String(item.correo || "").toLowerCase().includes(filter.trim().toLowerCase())),
  );

  function showRole(value) {
    setRoleFilter(value);
    filterInput.current?.focus();
  }

  function keyRole(event, value) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showRole(value);
    }
  }

  function open(value) {
    setTouched({});
    setForm(value);
  }

  function bind(field, fallback = "") {
    return {
      value: form?.[field] ?? fallback,
      onChange: (event) => {
        const value = event.target.value;
        setTouched((current) => ({ ...current, [field]: true }));
        setForm((current) => current ? { ...current, [field]: value } : current);
      },
    };
  }

  async function edit(id) {
    try {
      open(await loadUserForm(id));
    } catch (failure) {
      showToast("❌ " + failure.message, "error");
    }
  }

  async function save() {
    if (!form || saving) return;
    const invalid = formError(form);
    if (invalid) {
      showToast(...invalid);
      return;
    }
    setSaving(true);
    try {
      const result = await saveUserForm(form);
      showToast(result.text, result.type);
      await load();
      setForm(null);
    } catch (failure) {
      showToast(failure.message || "Error al guardar el usuario", "error");
    } finally {
      setSaving(false);
    }
  }

  function confirm(target) {
    setDeleteError("");
    setToDelete(target);
  }

  async function remove() {
    if (!toDelete || deleting) return;
    if (deleteError) {
      setToDelete(null);
      return;
    }
    setDeleting(true);
    try {
      await request("/usuarios/" + toDelete.id_usuario, { method: "DELETE" });
      showToast("✅ Usuario eliminado correctamente");
      setToDelete(null);
      await load();
    } catch (failure) {
      setDeleteError(failure.message || "Error al eliminar el usuario");
    } finally {
      setDeleting(false);
    }
  }

  if (!authorized) return null;
  const emailError = Boolean(touched.correo && form?.correo.trim() && !isEmail(form.correo.trim()));
  const phoneError = Boolean(touched.telefono && form?.telefono.trim() && !/^(\+57)?[0-9]{7,10}$/.test(form.telefono.replace(/[\s-]/g, "")));
  const passwordError = Boolean(touched.password && form?.password && !validNewPassword(form.password));
  return (
    <>
      {"\n    "}
      <Toast message={message} />
      {"\n    \n    "}
      {"\n    "}
      <div className={"confirm-overlay" + (toDelete ? " open" : "")} id="confirmModal">
        {"\n        "}
        <div className={"confirm-modal"}>
          {"\n            "}
          <span className={"material-symbols-outlined confirm-icon " + (deleteError ? "error" : "warning")} id="confirmIcon">{deleteError ? "error" : "warning"}</span>
          {"\n            "}
          <h3 id="confirmTitulo">{deleteError ? "❌ No se puede eliminar" : "¿Eliminar este usuario?"}</h3>
          {"\n            "}
          <p id={"confirmMensaje"}>{deleteError || "Esta acción no se puede deshacer. El usuario será eliminado permanentemente del sistema."}</p>
          {"\n            "}
          <div className={"user-info"} id="userInfo" style={deleteError ? { display: "none" } : undefined}>
            {"\n                "}
            <strong>{"Usuario:"}</strong>
            {" "}
            <span className={"correo"} id={"confirmCorreo"}>{toDelete?.correo ?? "—"}</span>
            <br />
            {"\n                "}
            <strong>{"ID:"}</strong>
            {" "}
            <span id={"confirmId"}>{toDelete?.id_usuario ?? "—"}</span>
            {"  |  "}
            <strong>{"Rol:"}</strong>
            {" "}
            <span id={"confirmRol"}>{toDelete?.rol ?? "—"}</span>
            {"\n            "}
          </div>
          {"\n            "}
          <div className={"confirm-footer"} id={"confirmFooter"}>
            {"\n                "}
            <button className={"btn-confirm-cancelar"} onClick={() => setToDelete(null)} disabled={deleting}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"close"}</span>
              {" Cancelar\n                "}
            </button>
            {"\n                "}
            <button className={deleteError ? "btn-confirm-cancelar" : "btn-confirm-eliminar"} id="btnConfirmEliminar" onClick={remove} disabled={deleting}>
              <Icon spinner={deleting}>{deleting ? "progress_activity" : deleteError ? "close" : "delete"}</Icon>
              {" "}{deleting ? "Eliminando..." : deleteError ? "Cerrar" : "Eliminar"}
            </button>
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n    "}
      </div>
      {"\n\n    "}
      {"\n    "}
      <div className={"modal-overlay" + (form ? " open" : "")} id="modalUsuario">
        {"\n        "}
        <div className={"modal"}>
          {"\n            "}
          <h3>
            {"\n                "}
            <span className={"material-symbols-outlined"}>{"person_add"}</span>
            {"\n                "}
            <span id="modalTitulo">{form?.id ? "Editar Usuario" : "Nuevo Usuario"}</span>
            {"\n            "}
          </h3>
          {"\n\n            "}
          <input id="editId" type="hidden" value={form?.id ?? ""} />
          {"\n\n            "}
          {"\n            "}
          {"\n            "}
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>
              {"Correo Electrónico "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n                "}
            <input id="inCorreo" {...bind("correo")} className={emailError ? "input-error" : ""} type={"email"} placeholder={"usuario@dental.com"} />
            {"\n                "}
            <small className={"error-message" + (emailError ? " show" : "")} id="correoError">{"Ingresa un correo válido"}</small>
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>
              {"Contraseña "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n                "}
            <PasswordInput key={form ? String(form.id ?? "new") : "closed"} id="inPassword"
              placeholder={form?.id ? "Dejar vacío para conservar" : "Mínimo 8 caracteres"} minLength={MIN_PASSWORD_LENGTH}
              aria-describedby="passwordHint" className={passwordError ? "input-error" : ""} {...bind("password")} />
            {"\n                "}
            <small className="password-hint" id="passwordHint">{PASSWORD_HINT}</small>
            {"\n            "}
          </div>
          {"\n\n            "}
          {"\n            "}
          {"\n            "}
          {"\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"Estado"}</label>
            {"\n                "}
            <select id="inEstado" {...bind("estado", "Activo")}>
              {"\n                    "}
              <option value={"Activo"}>{"Activo"}</option>
              {"\n                    "}
              <option value={"Inactivo"}>{"Inactivo"}</option>
              {"\n                "}
            </select>
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>
              {"Rol "}
              <span className={"required"}>{"*"}</span>
            </label>
            {"\n                "}
            <select id="inRol" {...bind("rol", "Paciente")}>
              {"\n                    "}
              <option value={"Administrador"}>{"Administrador"}</option>
              {"\n                    "}
              <option value={"Odontologo"}>{"Odontólogo"}</option>
              {"\n                    "}
              <option value={"Paciente"}>{"Paciente"}</option>
              {"\n                "}
            </select>
            {"\n            "}
          </div>
          {"\n\n            "}
          {"\n            "}
          {"\n            "}
          {"\n\n            "}
          <div id="camposComunes" className={"campos-seccion" + ((form && ["Administrador", "Paciente", "Odontologo"].includes(form.rol)) ? " show" : "")}>
            {"\n                "}
            <div className={"subtitulo"}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"badge"}</span>
              {" Información Personal\n                "}
            </div>
            {"\n                "}
            <div className={"row-2"}>
              {"\n                    "}
              <div className={"form-group"}>
                {"\n                        "}
                <label>{"Nombre *"}</label>
                {"\n                        "}
                <input id="inNombre" {...bind("nombre")} type={"text"} placeholder={"Nombre"} />
                {"\n                    "}
              </div>
              {"\n                    "}
              <div className={"form-group"}>
                {"\n                        "}
                <label>{"Apellido *"}</label>
                {"\n                        "}
                <input id="inApellido" {...bind("apellido")} type={"text"} placeholder={"Apellido"} />
                {"\n                    "}
              </div>
              {"\n                "}
            </div>
            {"\n                "}
            <div className={"row-2"}>
              {"\n                    "}
              <div className={"form-group"}>
                {"\n                        "}
                <label>{"Documento *"}</label>
                {"\n                        "}
                <input id="inDocumento" {...bind("documento")} type="text" placeholder="CC12345678" readOnly={Boolean(form?.id && form.rol === "Paciente")} />
                {"\n                    "}
              </div>
              {"\n                    "}
              <div className={"form-group"}>
                {"\n                        "}
                <label>{"Teléfono *"}</label>
                {"\n                        "}
                <input id="inTelefono" {...bind("telefono")} className={phoneError ? "input-error" : ""} type={"text"} placeholder={"3001234567"} />
                {"\n                        "}
                <small className={"error-message" + (phoneError ? " show" : "")} id="telefonoError">{"Número inválido"}</small>
                {"\n                    "}
              </div>
              {"\n                "}
            </div>
            {"\n            "}
          </div>
          {"\n\n            "}
          {"\n            "}
          {"\n            "}
          {"\n\n            "}
          <div id="camposPaciente" className={"campos-seccion" + ((form?.rol === "Paciente") ? " show" : "")}>
            {"\n                "}
            <div className={"subtitulo"}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"personal_injury"}</span>
              {" Información del Paciente\n                "}
            </div>
            {"\n                "}
            <div className={"row-2"}>
              {"\n                    "}
              <div className={"form-group"}>
                {"\n                        "}
                <label>{"Fecha nacimiento"}</label>
                {"\n                        "}
                <input id="inFechaNacimiento" {...bind("fecha_nacimiento")} type="date" readOnly={Boolean(form?.id)} />
                {"\n                    "}
              </div>
              {"\n                    "}
              <div className={"form-group"}>
                {"\n                        "}
                <label>{"Género"}</label>
                {"\n                        "}
                <select id="inGenero" {...bind("genero")}>
                  {"\n                            "}
                  <option value={""}>{"Seleccione"}</option>
                  {"\n                            "}
                  <option>{"Masculino"}</option>
                  {"\n                            "}
                  <option>{"Femenino"}</option>
                  {"\n                            "}
                  <option>{"Otro"}</option>
                  {"\n                        "}
                </select>
                {"\n                    "}
              </div>
              {"\n                "}
            </div>
            {"\n                "}
            <div className={"form-group"}>
              {"\n                    "}
              <label>{"Dirección"}</label>
              {"\n                    "}
              <input id="inDireccion" {...bind("direccion")} type={"text"} placeholder={"Dirección"} />
              {"\n                "}
            </div>
            {"\n                "}
            <div className={"form-group"}>
              {"\n                    "}
              <label>{"EPS"}</label>
              {"\n                    "}
              <input id="inEps" {...bind("eps")} type={"text"} placeholder={"EPS"} />
              {"\n                "}
            </div>
            {"\n                "}
            <div className={"form-group"}>
              {"\n                    "}
              <label>{"Alergias"}</label>
              {"\n                    "}
              <textarea id="inAlergias" {...bind("alergias")} rows={"3"} placeholder={"Alergias"} />
              {"\n                "}
            </div>
            {"\n            "}
          </div>
          {"\n\n            "}
          {"\n            "}
          {"\n            "}
          {"\n\n            "}
          <div id="camposOdontologo" className={"campos-seccion" + ((form?.rol === "Odontologo") ? " show" : "")}>
            {"\n                "}
            <div className={"subtitulo"}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"dentistry"}</span>
              {"\n                    Información Profesional\n                "}
            </div>
            {"\n                "}
            <div className={"form-group"}>
              {"\n                    "}
              <label>
                {"Especialidad "}
                <span className={"required"}>{"*"}</span>
              </label>
              {"\n                    "}
              <input id="inEspecialidad" {...bind("especialidad")} type={"text"} placeholder={"Ortodoncia"} />
              {"\n                "}
            </div>
            {"\n                "}
            <div className={"form-group"}>
              {"\n                    "}
              <label>
                {"Consultorio "}
                <span className={"required"}>{"*"}</span>
              </label>
              {"\n                    "}
              <select id="inConsultorio" {...bind("id_consultorio")}>
                {"\n                        "}
                <option value={""}>{"Seleccione un consultorio"}</option>
                {"\n                        "}
                <option value={"1"}>{"Consultorio Central (101)"}</option>
                {"\n                        "}
                <option value={"2"}>{"Consultorio Norte (202)"}</option>
                {"\n                    "}
              </select>
              {"\n                "}
            </div>
            {"\n            "}
          </div>
          {"\n\n            "}
          {"\n            "}
          {"\n            "}
          {"\n            "}
          <div className={"modal-footer"}>
            {"\n                "}
            <button className={"btn-cancelar"} type={"button"} onClick={() => setForm(null)} disabled={saving}>{"Cancelar"}</button>
            {"\n                "}
            <button className={"btn-guardar"} id={"btnGuardarUsuario"} type={"button"} onClick={save} disabled={saving}><Icon spinner={saving}>{saving ? "progress_activity" : "save"}</Icon> {saving ? "Guardando..." : "Guardar"}</button>
            {"\n            "}
          </div>
          {"\n\n        "}
        </div>
        {" "}
        {"\n    "}
      </div>
      {" "}
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
            <a className={"active"} href="/panel">
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"group"}</span>
              {" Usuarios\n                "}
            </a>
            {"\n                "}
            <a href="/roles">
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"manage_accounts"}</span>
              {" Roles\n                "}
            </a>
            {"\n                "}
            <a href="/tratamientos">
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"medical_services"}</span>
              {" Tratamientos\n                "}
            </a>
            {"\n                "}
            <a href="/citas">
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"calendar_month"}</span>
              {" Citas\n                "}
            </a>
            {"\n                "}
            <a href="/facturacion"><span className="material-symbols-outlined">receipt_long</span> Facturación</a>
            <a href="/administrar-productos"><span className="material-symbols-outlined">inventory_2</span> Productos</a>
            <a href="/proveedores">
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"local_shipping"}</span>
              {" Proveedores\n                "}
            </a>
            {"\n                "}
            <a href="/login" onClick={signOut}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"logout"}</span>
              {" Salir\n                "}
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
              <h2>{"Gestión de Usuarios"}</h2>
              {"\n                    "}
              <p style={{ color: "var(--text-muted)" }}>{"Clínica e Historial del Personal"}</p>
              {"\n                "}
            </div>
            {"\n                "}
            <button className={"btn-primary"} onClick={() => open(defaults)}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"person_add"}</span>
              {" Nuevo Usuario\n                "}
            </button>
            {"\n            "}
          </header>
          {"\n\n            "}
          <section className={"metrics-grid"}>
            {"\n                "}
            <div className={"metric-card metric-clickable"} id="tarjetaOdontologos" onClick={() => showRole("Odontologo")} onKeyDown={(event) => keyRole(event, "Odontologo")} role={"button"} tabIndex={"0"} title={"Mostrar odontólogos activos"}>
              {"\n                    "}
              <div className={"metric-icon"}>
                {"\n                        "}
                <span className={"material-symbols-outlined"}>{"badge"}</span>
                {"\n                    "}
              </div>
              {"\n                    "}
              <div className={"metric-data"}>
                {"\n                        "}
                <h3 id="cntOdontologos">{filtered?.filter((item) => item.rol === "Odontologo").length ?? "—"}</h3>
                {"\n                        "}
                <p>{"Odontólogos Activos"}</p>
                {"\n                    "}
              </div>
              {"\n                "}
            </div>
            {"\n                "}
            <div className={"metric-card metric-clickable"} id="tarjetaPacientes" onClick={() => showRole("Paciente")} onKeyDown={(event) => keyRole(event, "Paciente")} role={"button"} tabIndex={"0"} title={"Mostrar pacientes registrados"}>
              {"\n                    "}
              <div className={"metric-icon"} style={{ background: "#dcfce7", color: "var(--success)" }}>
                {"\n                        "}
                <span className={"material-symbols-outlined"}>{"patient_list"}</span>
                {"\n                    "}
              </div>
              {"\n                    "}
              <div className={"metric-data"}>
                {"\n                        "}
                <h3 id="cntPacientes">{filtered?.filter((item) => item.rol === "Paciente").length ?? "—"}</h3>
                {"\n                        "}
                <p>{"Pacientes Registrados"}</p>
                {"\n                    "}
              </div>
              {"\n                "}
            </div>
            {"\n            "}
          </section>
          {"\n\n            "}
          <section className={"usuarios-filtro"} aria-label={"Filtro de usuarios"}>
            {"\n                "}
            <div className={"usuarios-filtro-icon"}>
              <span className={"material-symbols-outlined"}>{"search"}</span>
            </div>
            {"\n                "}
            <div className={"usuarios-filtro-campo"}>
              {"\n                    "}
              <label htmlFor={"filtroCorreoUsuarios"}>{"Filtrar usuarios por correo"}</label>
              {"\n                    "}
              <input id="filtroCorreoUsuarios" ref={filterInput} value={filter} onChange={(event) => setFilter(event.target.value)} type={"search"} placeholder={"Escribe un correo para buscar..."} autoComplete={"off"} />
              {"\n                "}
            </div>
            {"\n                "}
            <button type={"button"} className={"btn-limpiar-usuarios"} id="btnLimpiarFiltroUsuarios" onClick={() => { setFilter(""); setRoleFilter(""); }} title={"Mostrar todos los usuarios"}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"close"}</span>
              {" Limpiar\n                "}
            </button>
            {"\n            "}
          </section>
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
                  <th>{"Correo Electrónico"}</th>
                  {"\n                            "}
                  <th>{"Rol"}</th>
                  {"\n                            "}
                  <th>{"Estado"}</th>
                  {"\n                            "}
                  <th>{"Acciones"}</th>
                  {"\n                        "}
                </tr>
                {"\n                    "}
              </thead>
              {"\n                    "}
              <tbody id={"tablaUsuarios"}><UserRows data={filtered} error={error} edit={edit} remove={confirm} /></tbody>
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

