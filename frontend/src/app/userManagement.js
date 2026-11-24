import { request } from "./api.js";

const profileRoutes = {
  Paciente: { path: "/pacientes", id: "id_paciente" },
  Odontologo: { path: "/odontologos", id: "id_odontologo" },
};

const roleLabel = { Administrador: "Administrador", Paciente: "Paciente", Odontologo: "Odontólogo" };

async function records(path) {
  const rows = await request(path).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function linkToProfile(items, account) {
  return items.find((entry) => entry.correo === account.correo)
    || (account.documento && items.find((entry) => entry.documento === account.documento))
    || (account.nombre && account.apellido && items.find((entry) => entry.nombre === account.nombre && entry.apellido === account.apellido))
    || null;
}

export async function loadUserForm(id) {
  const user = await request("/usuarios/" + id);
  const role = user.rol || "Paciente";
  const profileRoute = profileRoutes[role];
  const profile = profileRoute ? linkToProfile(await records(profileRoute.path), user) : null;
  const source = profile || (role === "Odontologo" ? {} : user);
  return {
    id: user.id_usuario, correo: user.correo || "", rol: role, estado: user.estado || "Activo",
    password: "",
    nombre: source.nombre || "", apellido: source.apellido || "", documento: source.documento || "", telefono: source.telefono || "",
    fecha_nacimiento: String(source.fecha_nacimiento || "").slice(0, 10), genero: source.genero || "",
    direccion: source.direccion || "", eps: source.eps || "", alergias: source.alergias || "",
    especialidad: source.especialidad || "", id_consultorio: String(source.id_consultorio || ""),
  };
}

export async function saveUserForm(form) {
  const { id, rol, estado } = form;
  const identity = {
    correo: form.correo.trim(), nombre: form.nombre.trim(), apellido: form.apellido.trim(),
    documento: form.documento.trim(), telefono: form.telefono.trim(),
  };
  const password = form.password;
  const credentials = password ? { contrasena: password } : {};
  const account = { ...identity, ...credentials, rol, estado };
  const profileRoute = profileRoutes[rol];
  const patient = rol === "Paciente" ? {
    fecha_nacimiento: form.fecha_nacimiento || null, genero: form.genero || null,
    direccion: form.direccion.trim() || null, eps: form.eps.trim() || null, alergias: form.alergias.trim() || null,
  } : {};
  const dentist = rol === "Odontologo" ? {
    especialidad: form.especialidad.trim(), id_consultorio: Number(form.id_consultorio),
  } : {};

  if (!id) {
    await request(profileRoute ? "/usuarios/registro" : "/usuarios", {
      method: "POST", body: { ...account, ...patient, ...dentist },
    });
    return { text: "✅ " + roleLabel[rol] + " registrado correctamente" };
  }

  const before = await request("/usuarios/" + id);
  const { documento: _accountDocument, ...patientAccount } = account;
  await request("/usuarios/" + id, {
    method: "PUT", body: before.rol === "Paciente" && rol === "Paciente" ? patientAccount : account,
  });
  if (!profileRoute) return { text: "✅ Administrador actualizado correctamente" };

  const profiles = await records(profileRoute.path);
  const profile = rol === "Paciente"
    ? profiles.find((entry) => entry.correo === before.correo || entry.correo === identity.correo || (identity.documento && entry.documento === identity.documento))
    : profiles.find((entry) => entry.correo === before.correo)
      || profiles.find((entry) => entry.correo === identity.correo)
      || profiles.find((entry) => identity.documento && entry.documento === identity.documento);

  if (profile) {
    const { documento, ...patientIdentity } = identity;
    const { fecha_nacimiento, ...clinicalPatient } = patient;
    await request(profileRoute.path + "/" + profile[profileRoute.id], {
      method: "PUT", body: rol === "Paciente" ? { ...patientIdentity, ...clinicalPatient } : { ...identity, ...dentist },
    });
    return { text: "✅ " + roleLabel[rol] + " actualizado correctamente" };
  }
  if (rol === "Paciente") {
    return { text: "✅ Usuario actualizado, pero no se encontró una ficha de paciente.", type: "warning" };
  }
  await request("/odontologos", { method: "POST", body: { ...identity, ...dentist } });
  return { text: "✅ Usuario convertido a Odontólogo correctamente" };
}
