import { useEffect, useRef, useState } from "react";
import { PasswordInput, SubmitButton, Toast, isEmail, postAuth, useToast } from "./authUi.jsx";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, RECOMMENDED_PASSWORD_LENGTH, validNewPassword } from "./passwordPolicy.js";
import { BirthDate, DocumentType } from "./patientIdentity.jsx";
import { today } from "./agenda.js";

const emptyForm = {
  nombre: "", apellido: "", tipo_documento: "", documento: "", fecha_nacimiento: "",
  correo: "", telefono: "", password: "", confirmation: "",
};

function Field({ id, label, error, children }) {
  return (
    <div className={"form-group" + (id.startsWith("inPassword") || id === "inConfirmPassword" ? " password-group" : "")}>
      <label htmlFor={id}>{label} <span style={{ color: "#ef4444" }}>*</span></label>
      {children}
      {error}
    </div>
  );
}

function Strength({ password }) {
  const length = Array.from(password).length;
  const score = Number(length >= RECOMMENDED_PASSWORD_LENGTH) + Number(/[a-z]/.test(password) && /[A-Z]/.test(password))
    + Number(/\d/.test(password)) + Number(/[^a-zA-Z0-9]/.test(password));
  const strength = !validNewPassword(password) ? ["weak", "Débil"]
    : length >= RECOMMENDED_PASSWORD_LENGTH && score >= 2 ? ["strong", "Fuerte"] : ["medium", "Media"];
  return <div id="passwordStrength" className={"password-strength" + (password ? " " + strength[0] : "")}>
    {password && "Fortaleza: " + strength[1]}
  </div>;
}

function InlineError({ id, visible, children }) {
  return <small id={id} className={"error-message" + (visible ? " show" : "")}>{children}</small>;
}

export default function Register({ navigate }) {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, showToast] = useToast();
  const redirect = useRef(null);
  useEffect(() => () => clearTimeout(redirect.current), []);

  function bind(field) {
    return {
      value: form[field],
      onChange: (event) => {
        const value = event.target.value;
        setForm((current) => ({ ...current, [field]: value }));
      },
    };
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const { nombre, apellido, correo, telefono, tipo_documento, documento, fecha_nacimiento } = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim()]),
    );
    const { password, confirmation } = form;
    let invalid;
    if (!nombre || !apellido || !correo || !telefono || !password || !confirmation
        || !tipo_documento || !documento || !fecha_nacimiento) invalid = "Todos los campos son obligatorios";
    else if (fecha_nacimiento > today()) invalid = "La fecha de nacimiento no puede estar en el futuro";
    else if (!isEmail(correo)) invalid = "Ingresa un correo válido";
    else if (!validNewPassword(password)) invalid = PASSWORD_HINT;
    else if (password !== confirmation) invalid = "Las contraseñas no coinciden";
    if (invalid) {
      showToast(invalid, "error");
      return;
    }
    setBusy(true);
    try {
      await postAuth("/auth/registro", {
        correo, contrasena: password, nombre, apellido, telefono, tipo_documento, documento, fecha_nacimiento,
      });
      showToast("✅ ¡Registro exitoso! Bienvenido " + nombre + " " + apellido);
      setForm(emptyForm);
      redirect.current = setTimeout(() => navigate("/login"), 2000);
    } catch (error) {
      showToast("❌ " + error.message, "error");
      setBusy(false);
    }
  }

  return (
    <>
      <Toast message={message} />
      <div className="registro-card">
        <div className="registro-brand">
          <span className="material-symbols-outlined">dentistry</span>
          <h1>Odonto<span>Soft</span></h1>
        </div>
        <p className="registro-subtitle">Registro de Usuario - Sistema de Gestión Odontológica</p>
        <form id="registroForm" onSubmit={submit} noValidate>
          <Field id="inNombre" label="Nombre">
            <input type="text" id="inNombre" placeholder="Tu nombre" required {...bind("nombre")} />
          </Field>
          <Field id="inApellido" label="Apellido">
            <input type="text" id="inApellido" placeholder="Tu apellido" required {...bind("apellido")} />
          </Field>
          <Field id="inTipoDocumento" label="Tipo de documento">
            <DocumentType id="inTipoDocumento" required {...bind("tipo_documento")} />
          </Field>
          <Field id="inDocumento" label="Número de documento">
            <input type="text" id="inDocumento" maxLength={20} required {...bind("documento")} />
          </Field>
          <Field id="inFechaNacimiento" label="Fecha de nacimiento">
            <BirthDate id="inFechaNacimiento" required {...bind("fecha_nacimiento")} />
          </Field>
          <Field id="inCorreo" label="Correo Electrónico" error={
            <InlineError id="correoError" visible={form.correo && !isEmail(form.correo)}>Ingresa un correo electrónico válido</InlineError>
          }>
            <input type="email" id="inCorreo" placeholder="usuario@dental.com" required {...bind("correo")} />
          </Field>
          <Field id="inTelefono" label="Teléfono">
            <input type="tel" id="inTelefono" placeholder="3001234567" required {...bind("telefono")} />
          </Field>
          <Field id="inPassword" label="Contraseña">
            <PasswordInput id="inPassword" placeholder="••••••••" minLength={MIN_PASSWORD_LENGTH} aria-describedby="passwordHint" {...bind("password")} />
            <small className="password-hint" id="passwordHint">{PASSWORD_HINT}</small>
            <Strength password={form.password} />
          </Field>
          <Field id="inConfirmPassword" label="Confirmar Contraseña">
            <PasswordInput id="inConfirmPassword" placeholder="••••••••" {...bind("confirmation")} />
            <InlineError id="confirmError" visible={form.confirmation && form.password !== form.confirmation}>Las contraseñas no coinciden</InlineError>
          </Field>
          <SubmitButton id="btnRegistrar" busy={busy} icon="how_to_reg" busyLabel="Registrando...">Registrarse</SubmitButton>
        </form>
        <p className="link-login">¿Ya tienes cuenta? <a href="/login">Inicia sesión aquí</a></p>
      </div>
    </>
  );
}
