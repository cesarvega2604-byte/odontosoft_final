import { useState } from "react";
import { Toast, useToast } from "./authUi.jsx";
import { signOut, useUser } from "./session.js";

export default function ContactoPage({ navigate }) {
  const user = useUser(navigate);
  const [form, setForm] = useState({ nombre: "", correo: "", mensaje: "" });
  const [message, showToast] = useToast();

  function change(field) {
    return (event) => setForm((value) => ({ ...value, [field]: event.target.value }));
  }

  function send() {
    const nombre = form.nombre.trim();
    if (!nombre || !form.correo.trim() || !form.mensaje.trim()) {
      showToast("Completa todos los campos", "error");
      return;
    }
    showToast("Mensaje enviado, " + nombre + ". Te contactaremos pronto.");
    setForm({ nombre: "", correo: "", mensaje: "" });
  }
  if (!user) return null;
  return (
    <>
      {"\n    "}
      <Toast message={message} />
      {"\n\n    "}
      <div className={"dashboard-container"}>
        {"\n        "}
        <aside className={"sidebar"} style={{ backgroundColor: "#1e293b" }}>
          {"\n            "}
          <div className={"sidebar-brand"}>
            {"\n                "}
            <span className={"material-symbols-outlined"}>{"account_circle"}</span>
            {"\n                "}
            <span>{"Paciente"}</span>
            {"\n            "}
          </div>
          {"\n            "}
          <nav className={"sidebar-menu"}>
            {"\n                "}
            <a href="/panel_cliente">
              <span className={"material-symbols-outlined"}>{"arrow_back"}</span>
              {" Mis Servicios"}
            </a>
            {"\n                "}
            <a href="/contacto" className={"active"}>
              <span className={"material-symbols-outlined"}>{"support_agent"}</span>
              {" Soporte"}
            </a>
            {"\n                "}
            <a href="/login" onClick={signOut}>
              <span className={"material-symbols-outlined"}>{"logout"}</span>
              {" Cerrar Sesión"}
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
            <h2>{"Canales de Atención Directa"}</h2>
            {"\n            "}
          </header>
          {"\n\n            "}
          <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
            {"\n                "}
            <div className={"form-container"} style={{ flex: "1", minWidth: "320px" }}>
              {"\n                    "}
              <h3 style={{ marginBottom: "20px" }}>{"Envíanos un Mensaje"}</h3>
              {"\n                    "}
              <div className={"form-group"}>
                {"\n                        "}
                <label>{"Nombre Completo"}</label>
                {"\n                        "}
                <input type={"text"} id="inNombre" value={form.nombre} onChange={change("nombre")} placeholder={"Ej. Juan Pérez"} />
                {"\n                    "}
              </div>
              {"\n                    "}
              <div className={"form-group"}>
                {"\n                        "}
                <label>{"Correo Electrónico"}</label>
                {"\n                        "}
                <input type={"email"} id="inCorreo" value={form.correo} onChange={change("correo")} placeholder={"juan@ejemplo.com"} />
                {"\n                    "}
              </div>
              {"\n                    "}
              <div className={"form-group"}>
                {"\n                        "}
                <label>{"¿En qué podemos ayudarte?"}</label>
                {"\n                        "}
                <textarea id="inMensaje" value={form.mensaje} onChange={change("mensaje")} rows={"4"} placeholder={"Escribe tu consulta aquí..."} />
                {"\n                    "}
              </div>
              {"\n                    "}
              <button className={"btn-primary"} style={{ width: "100%", justifyContent: "center" }} onClick={send}>
                {"\n                        "}
                <span className={"material-symbols-outlined"}>{"send"}</span>
                {" Enviar Consulta\n                    "}
              </button>
              {"\n                "}
            </div>
            {"\n\n                "}
            <div style={{ flex: "1", minWidth: "300px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {"\n                    "}
              <div className={"metric-card"}>
                {"\n                        "}
                <div className={"metric-icon"} style={{ background: "#dcfce7", color: "var(--success)" }}>
                  {"\n                            "}
                  <span className={"material-symbols-outlined"}>{"call"}</span>
                  {"\n                        "}
                </div>
                {"\n                        "}
                <div className={"metric-data"}>
                  {"\n                            "}
                  <h3>{"WhatsApp Directo"}</h3>
                  {"\n                            "}
                  <p>{"+57 300 765 4321"}</p>
                  {"\n                        "}
                </div>
                {"\n                    "}
              </div>
              {"\n                    "}
              <div className={"metric-card"}>
                {"\n                        "}
                <div className={"metric-icon"}>
                  <span className={"material-symbols-outlined"}>{"mail"}</span>
                </div>
                {"\n                        "}
                <div className={"metric-data"}>
                  {"\n                            "}
                  <h3>{"Correo de Soporte"}</h3>
                  {"\n                            "}
                  <p>{"contacto@odontosoft.com"}</p>
                  {"\n                        "}
                </div>
                {"\n                    "}
              </div>
              {"\n                    "}
              <div className={"metric-card"} style={{ borderLeft: "4px solid var(--primary-color)" }}>
                {"\n                        "}
                <div className={"metric-icon"} style={{ background: "#f1f5f9", color: "var(--text-main)" }}>
                  {"\n                            "}
                  <span className={"material-symbols-outlined"}>{"location_on"}</span>
                  {"\n                        "}
                </div>
                {"\n                        "}
                <div className={"metric-data"}>
                  {"\n                            "}
                  <h3>{"Sede Principal"}</h3>
                  {"\n                            "}
                  <p>{"Av. Principal Calle 100 #15-30, Bogotá"}</p>
                  {"\n                        "}
                </div>
                {"\n                    "}
              </div>
              {"\n                "}
            </div>
            {"\n            "}
          </div>
          {"\n        "}
        </main>
        {"\n    "}
      </div>
      {"\n\n    "}
    </>
  );
}

