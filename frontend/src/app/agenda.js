import { normalizeRole } from "./session.js";

const dateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function today() {
  const parts = Object.fromEntries(dateFormat.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return parts.year + "-" + parts.month + "-" + parts.day;
}

export function currentTime() {
  return timeFormat.format(new Date());
}

export function localDate(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

export function formatDate(value, options = { day: "numeric", month: "long" }) {
  return new Date(String(value).slice(0, 10) + "T12:00:00").toLocaleDateString("es-CO", options);
}

export function time(appointment) {
  return String(appointment.hora || "").slice(0, 5);
}

export function treatment(appointment) {
  return (appointment.tratamientos || []).map(({ nombre }) => nombre).join(" · ") || appointment.motivo_consulta || "Consulta odontológica";
}

export function cancelled(appointment) {
  return ["cancelado", "cancelada", "inasistencia", "no asistio"].includes(normalizeRole(appointment.estado));
}

export function complete(appointment) {
  return ["finalizado", "finalizada", "completado", "completada"].includes(normalizeRole(appointment.estado));
}

export function tone(appointment) {
  if (cancelled(appointment)) return "cancelada";
  if (complete(appointment)) return "finalizada";
  const state = normalizeRole(appointment.estado);
  return state === "en consulta" ? "consulta" : state === "confirmada" ? "confirmada" : "espera";
}

export function upcoming(appointment) {
  const date = today();
  return !cancelled(appointment) && !complete(appointment) &&
    (appointment.fecha > date || (appointment.fecha === date && time(appointment) >= currentTime()));
}

export function order(a, b) {
  return (a.fecha + " " + a.hora).localeCompare(b.fecha + " " + b.hora);
}

export function duration(item) {
  const text = normalizeRole(item?.duracion_estimada);
  const amounts = text.match(/\d+(?:[.,]\d+)?/g);
  if (!amounts) return 30;
  let number = Number(amounts[0].replace(",", "."));
  if (text.includes("hora")) {
    number *= 60;
    if (amounts[1] && text.includes("min")) number += Number(amounts[1].replace(",", "."));
  }
  return Math.max(5, Math.min(480, Math.floor(number)));
}

export function minutes(hhmm) {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}
