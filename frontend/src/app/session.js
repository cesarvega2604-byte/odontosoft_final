import { useEffect } from "react";
import { request } from "./api.js";

let profile = null;

export function getUser() {
  return profile;
}

export function setUser(value) {
  profile = value;
}

export async function restoreSession(signal) {
  const user = await request("/auth/me", { signal }).catch(() => null);
  if (!signal.aborted) setUser(user);
}

export function normalizeRole(role) {
  return String(role ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export async function signOut(event) {
  event?.preventDefault();
  try {
    await request("/auth/logout", { method: "POST" });
  } catch {
    window.alert("No se pudo cerrar la sesión. Comprueba la conexión e inténtalo de nuevo.");
    return;
  }
  setUser(null);
  for (const key of ["paciente_clinico_id", "paciente_odontograma_id", "cita_clinica_id"]) {
    localStorage.removeItem(key);
  }
  window.location.replace("/login");
}

export function useUser(navigate, redirectDentist = false) {
  const user = getUser();
  const destination = !user ? "/login" : redirectDentist && normalizeRole(user.rol) === "odontologo" ? "/panel_odontologo" : null;
  useEffect(() => {
    if (destination) navigate(destination, { replace: true });
  }, [destination, navigate]);
  return destination ? null : user;
}
