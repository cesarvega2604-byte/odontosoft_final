import { useEffect, useRef, useState } from "react";
import { AuthCard, EmailField, PasswordField, SubmitButton, Toast, isEmail, postAuth, useToast } from "./authUi.jsx";
import { setUser } from "./session.js";

export default function Login({ navigate }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, showToast] = useToast();
  const redirect = useRef(null);
  useEffect(() => () => clearTimeout(redirect.current), []);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = event.currentTarget.elements;
    const correo = email.trim();
    const contrasena = fields.inPassword.value;
    if (!correo || !isEmail(correo)) {
      showToast(correo ? "✉️ Ingresa un correo electrónico válido" : "✉️ Por favor, ingresa tu correo electrónico", correo ? "error" : "warning");
      fields.correo.focus();
      return;
    }
    if (!contrasena) {
      showToast("🔑 Por favor, ingresa tu contraseña", "warning");
      fields.inPassword.focus();
      return;
    }
    setBusy(true);
    try {
      const user = await postAuth("/auth/login", { correo, contrasena });
      setUser(user);
      const role = String(user.rol ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const label = user.rol === "Odontologo" ? "Odontólogo" : user.rol;
      const destination = role === "paciente" ? "/panel_cliente" : role === "odontologo" ? "/panel_odontologo" : "/panel";
      showToast("✅ ¡Bienvenido, " + user.correo + "! (" + label + ")");
      redirect.current = setTimeout(() => navigate(destination), 2000);
    } catch (error) {
      showToast(error.message, "error");
      setBusy(false);
    }
  }

  return (
    <>
      <Toast message={message} />
      <AuthCard icon="dentistry" subtitle="Sistema de Gestión Odontológica">
        <form id="loginForm" onSubmit={submit} noValidate>
          <EmailField value={email} onChange={setEmail} placeholder="admin@odontosoft.com" />
          <PasswordField id="inPassword" label="Contraseña" placeholder="••••••••" />
          <SubmitButton id="btnLogin" busy={busy} icon="login" busyLabel="Verificando...">Ingresar</SubmitButton>
        </form>
        <p className="link-login">¿No tienes cuenta? <a href="/registro">Regístrate aquí</a></p>
        <p className="link-login"><a href="/forgot-password">¿Olvidaste tu contraseña?</a></p>
      </AuthCard>
    </>
  );
}
