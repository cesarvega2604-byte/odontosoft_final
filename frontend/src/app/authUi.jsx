import { useCallback, useEffect, useRef, useState } from "react";
import { apiOrigin } from "./api.js";

const connectionMessage = "❌ No se pudo conectar con el servidor. Verifica que el backend esté corriendo.";

export function isEmail(value) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
}

export async function postAuth(path, body) {
  let response;
  try {
    response = await fetch(apiOrigin + path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(connectionMessage);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Error " + response.status);
  }
  return data;
}

export function useToast(duration = 3000) {
  const timer = useRef(null);
  const [message, setMessage] = useState({ text: "", type: "success", visible: false });
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((text, type = "success") => {
    clearTimeout(timer.current);
    setMessage({ text, type, visible: true });
    timer.current = setTimeout(() => setMessage((value) => ({ ...value, visible: false })), duration);
  }, [duration]);
  return [message, show];
}

export function Toast({ message }) {
  const appearance = message.text ? " " + (message.visible ? "show " : "") + message.type : "";
  return <div id="toast" className={"toast" + appearance} role="status">{message.text}</div>;
}

export function AuthCard({ icon, subtitle, children }) {
  return (
    <div className="login-card">
      <div className="login-brand">
        <span className="material-symbols-outlined">{icon}</span>
        <h1>Odonto<span>Soft</span></h1>
      </div>
      <p className="login-subtitle">{subtitle}</p>
      {children}
    </div>
  );
}

export function EmailField({ value, onChange, placeholder }) {
  const invalid = value.trim() && !isEmail(value.trim());
  return (
    <div className="form-group">
      <label htmlFor="inCorreo">Correo Electrónico</label>
      <input type="email" id="inCorreo" name="correo" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} required />
      <small id="correoHelper" className={"error-message" + (invalid ? " show" : "")}>Ingresa un correo electrónico válido</small>
    </div>
  );
}

export function PasswordField({ id, label, placeholder, minLength, hint }) {
  return (
    <div className="form-group password-group">
      <label htmlFor={id}>{label}</label>
      <PasswordInput id={id} placeholder={placeholder} minLength={minLength} aria-describedby={hint ? id + "Hint" : undefined} />
      {hint && <small className="password-hint" id={id + "Hint"}>{hint}</small>}
    </div>
  );
}

export function PasswordInput({ id, ...properties }) {
  const [visible, setVisible] = useState(false);
  function toggle() {
    setVisible((current) => !current);
  }
  return (
      <div className="input-wrapper">
        <input {...properties} type={visible ? "text" : "password"} id={id} name={id} required />
        <span
          className="material-symbols-outlined toggle-password"
          role="button"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggle();
            }
          }}
        >{visible ? "visibility" : "visibility_off"}</span>
      </div>
  );
}

export function SubmitButton({ id, busy, icon, busyLabel, children }) {
  return (
    <button id={id} type="submit" className="btn-primary" disabled={busy}>
      <span className={"material-symbols-outlined" + (busy ? " spinner" : "")}>{busy ? "progress_activity" : icon}</span>
      {" "}{busy ? busyLabel : children}
    </button>
  );
}
