import { useEffect, useRef, useState } from "react";
import { AuthCard, EmailField, PasswordField, SubmitButton, Toast, isEmail, postAuth, useToast } from "./authUi.jsx";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, validNewPassword } from "./passwordPolicy.js";

function BackToLogin() {
  return <p className="link-login"><a href="/login">← Volver a iniciar sesión</a></p>;
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, showToast] = useToast(4000);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const correo = email.trim();
    if (!isEmail(correo)) {
      showToast("✉️ Ingresa un correo electrónico válido", "error");
      event.currentTarget.elements.correo.focus();
      return;
    }
    setBusy(true);
    try {
      const data = await postAuth("/auth/solicitar-reset", { correo });
      showToast("✅ " + data.mensaje);
      setEmail("");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Toast message={message} />
      <AuthCard icon="dentistry" subtitle="Recupera el acceso a tu cuenta">
        <form id="forgotForm" onSubmit={submit} noValidate>
          <EmailField value={email} onChange={setEmail} placeholder="tu@correo.com" />
          <SubmitButton id="btnEnviar" busy={busy} icon="mail" busyLabel="Enviando...">Enviar enlace de recuperación</SubmitButton>
        </form>
        <BackToLogin />
      </AuthCard>
    </>
  );
}

export function ResetPassword({ search, hash = "", navigate }) {
  const token = new URLSearchParams(hash.slice(1)).get("token") ?? new URLSearchParams(search).get("token");
  const [busy, setBusy] = useState(false);
  const [message, showToast] = useToast(4000);
  const redirect = useRef(null);

  useEffect(() => () => clearTimeout(redirect.current), []);
  useEffect(() => {
    if (!token) showToast("❌ Enlace inválido o incompleto. Solicita uno nuevo.", "error");
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    if (!token || busy) return;
    const fields = event.currentTarget.elements;
    const nueva_contrasena = fields.inPassword.value;
    if (!validNewPassword(nueva_contrasena)) {
      showToast(PASSWORD_HINT, "warning");
      return;
    }
    if (nueva_contrasena !== fields.inPassword2.value) {
      showToast("❌ Las contraseñas no coinciden", "error");
      return;
    }
    setBusy(true);
    try {
      const data = await postAuth("/auth/reset-password", { token, nueva_contrasena });
      showToast("✅ " + data.mensaje);
      redirect.current = setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (error) {
      showToast(error.message, "error");
      setBusy(false);
    }
  }

  return (
    <>
      <Toast message={message} />
      <AuthCard icon="dentistry" subtitle="Crea tu nueva contraseña">
        <form id="resetForm" onSubmit={submit} noValidate style={token ? undefined : { display: "none" }}>
          <PasswordField id="inPassword" label="Nueva contraseña" placeholder="Mínimo 8 caracteres" minLength={MIN_PASSWORD_LENGTH} hint={PASSWORD_HINT} />
          <PasswordField id="inPassword2" label="Confirmar contraseña" placeholder="Repite la contraseña" minLength={MIN_PASSWORD_LENGTH} />
          <SubmitButton id="btnReset" busy={busy} icon="lock_reset" busyLabel="Guardando...">Guardar nueva contraseña</SubmitButton>
        </form>
        <BackToLogin />
      </AuthCard>
    </>
  );
}
