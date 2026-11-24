import { API_URL } from './config';

let token = null;
const listeners = new Set();

export function hasSession() {
  return token !== null;
}

export function subscribeSession(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function setSession(value) {
  token = value;
  listeners.forEach((listener) => listener());
}

async function pedir(path, opciones = {}) {
  const attemptedToken = token;
  const res = await fetch(`${API_URL}${path}`, {
    ...opciones,
    credentials: 'omit',
    headers: {
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...(attemptedToken ? { Authorization: 'Bearer ' + attemptedToken } : {}),
    },
  });

  const texto = await res.text();
  const data = texto ? JSON.parse(texto) : null;

  if (!res.ok) {
    if (res.status === 401 && attemptedToken === token) setSession(null);
    const d = data?.detail;
    const msg = typeof d === 'string'
      ? d
      : Array.isArray(d)
        ? d.map((e) => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join('\n')
        : `Error ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export async function iniciarSesion(correo, contrasena) {
  if (!__DEV__ && !API_URL.startsWith('https://')) {
    throw new Error('Configura una URL HTTPS para conectarte a OdontoSoft.');
  }
  const response = await pedir('/auth/login/consultorios', {
    method: 'POST', body: JSON.stringify({ correo, contrasena }),
  });
  setSession(response.access_token);
}

export async function cerrarSesion() {
  await pedir('/auth/logout', { method: 'POST' });
  setSession(null);
}

export const listarConsultorios = () => pedir('/consultorios/');

export const obtenerConsultorio = (id) => pedir(`/consultorios/${id}`);

export const crearConsultorio = (datos) =>
  pedir('/consultorios/', { method: 'POST', body: JSON.stringify(datos) });

export const actualizarConsultorio = (id, datos) =>
  pedir(`/consultorios/${id}`, { method: 'PUT', body: JSON.stringify(datos) });

export const eliminarConsultorio = (id) =>
  pedir(`/consultorios/${id}`, { method: 'DELETE' });
