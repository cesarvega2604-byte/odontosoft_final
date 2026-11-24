import { spawn, spawnSync } from "node:child_process";
import { readFile, readdir, mkdtemp, rm, copyFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { createHash, X509Certificate } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL(".", import.meta.url));
const browserPath = process.argv[2];
if (!browserPath) throw new Error("Pass the path to Microsoft Edge or another Chromium browser.");
const profile = await mkdtemp(join(tmpdir(), "odontosoft-browser-"));
const visualSpa = process.argv.includes("--visual");
const liveSession = process.argv.includes("--live-session");
const liveClinic = process.argv.includes("--live-clinic");
const clinicApi = "https://127.0.0.1:56484";
const clinicOrigin = "https://127.0.0.1:5176";
const tlsDirectory = process.env.ODONTO_TEST_TLS_DIR;
if (liveClinic && (!tlsDirectory || process.env.NODE_EXTRA_CA_CERTS !== join(tlsDirectory, "cert.pem"))) {
  throw new Error("Set the isolated test certificate directory and NODE_EXTRA_CA_CERTS before starting Node.");
}
const tls = liveClinic ? {
  key: await readFile(join(tlsDirectory, "key.pem")),
  cert: await readFile(join(tlsDirectory, "cert.pem")),
} : null;
const certificatePin = tls && createHash("sha256").update(
  new X509Certificate(tls.cert).publicKey.export({ type: "spki", format: "der" }),
).digest("base64");
const baseline = join(profile, "baseline");
if (visualSpa) {
  const extraction = spawnSync("python", ["-c", `
from pathlib import PurePosixPath
from zipfile import ZipFile
import sys

with ZipFile(sys.argv[1]) as source:
    for entry in source.infolist():
        path = PurePosixPath(entry.filename)
        if not path.is_absolute() and ".." not in path.parts and len(path.parts) > 2 and path.parts[0] == "frontend" and path.parts[1] in {"html", "css", "assets", "js"}:
            source.extract(entry, sys.argv[2])
`, join(frontend, "..", "odontosoft-react y html.zip"), baseline], { encoding: "utf8", windowsHide: true });
  if (extraction.status !== 0) throw new Error(extraction.stderr || extraction.error?.message || "Could not extract visual reference");
}
const types = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript",
  ".css": "text/css", ".png": "image/png",
};
const apiMock = `<script>
  const testPage = location.pathname.split("/").pop();
  const testPatient = { id_paciente: 1, nombre: "Paciente", apellido: "Ficticio", tipo_documento: "CC", documento: "PRUEBA", fecha_nacimiento: "1990-06-15", correo: "paciente@example.invalid", telefono: "1234567" };
  const testDoctor = { id_odontologo: 2, nombre: "Odontólogo", apellido: "Ficticio", correo: "odontologo@example.invalid", id_consultorio: 1 };
  const testOffice = { id_consultorio: 1, nombre: "Consultorio Central" };
  const testTreatment = { id_tratamiento: 1, nombre: "Limpieza", descripcion: "Tratamiento ficticio", costo: 150000, duracion_estimada: "45 min" };
  const testDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota" }).format(new Date());
  const testAppointment = { id_cita: 10, id_paciente: 1, id_odontologo: 2, id_consultorio: 1, fecha: testDate,
    hora: "16:30:00", estado: "En Consulta", duracion_minutos: 45, tratamientos: [testTreatment], odontologo: testDoctor };
  const testUsers = [
    { id_usuario: 3, rol: "Administrador", estado: "Activo", correo: "admin@example.invalid", nombre: "Admin", apellido: "Prueba", documento: "ADMIN", telefono: "1234567" },
    { id_usuario: 1, rol: "Paciente", estado: "Activo", correo: testPatient.correo, ...testPatient },
    { id_usuario: 2, rol: "Odontologo", estado: "Activo", correo: testDoctor.correo, ...testDoctor },
  ];
  let signedInUser = null;
  function setTestUser(user) {
    signedInUser = user;
    localStorage.setItem("usuario_actual", JSON.stringify(user));
  }
  switch (testPage) {
    case "panel.html":
    case "tratamientos.html":
    case "citas.html":
    case "roles.html":
    case "proveedores.html":
      setTestUser(testUsers[new URLSearchParams(location.search).has("dentist") ? 2 : 0]);
      break;
    case "contacto.html":
    case "panel_cliente.html":
      setTestUser(testUsers[1]);
      break;
    case "historia_clinica.html":
    case "odontograma.html":
    case "panel_odontologo.html":
      setTestUser(testUsers[2]);
      localStorage.setItem("paciente_clinico_id", "1");
      localStorage.setItem("paciente_odontograma_id", "1");
      break;
  }
  window.html2pdf = () => ({
    set(options) { this.options = options; return this; },
    from(element) { this.element = element; return this; },
    async save() {
      window.generatedPdf = {
        name: this.options.filename,
        sections: [...this.element.querySelectorAll(".pdf-section-title")].map((heading) => heading.textContent),
        text: this.element.textContent,
      };
    },
  });
  window.fetch = async (url, options = {}) => {
    const { pathname, searchParams } = new URL(url, location.href);
    window.calls ??= [];
    window.calls.push([pathname, options.method || "GET", options.body || null]);
    if (pathname === "/auth/me") return signedInUser ? Response.json(signedInUser) : new Response(null, { status: 401 });
    if (pathname === "/auth/login") {
      return Response.json({ detail: "Correo o contraseña incorrectos" }, { status: 401 });
    }
    if (pathname === "/auth/solicitar-reset") return Response.json({ mensaje: "Enlace de prueba solicitado" });
    if (pathname === "/auth/reset-password") return Response.json({ mensaje: "Contraseña de prueba actualizada" });
    if (pathname === "/auth/registro") return Response.json({ mensaje: "Registro de prueba completado" });
    if (pathname === "/opiniones") return Response.json({ opiniones: [], hay_mas: false });
    if (pathname === "/roles") {
      return Response.json([{ id: 1, nombre: "Rol de prueba", permisos: "READ ONLY" }]);
    }
    if (pathname === "/proveedores") {
      return Response.json([{ id: 1, empresa: "Proveedor de prueba", telefono: "0000000", estado_convenio: "Vigente" }]);
    }
    if (pathname === "/pacientes") return Response.json([testPatient]);
    if (pathname === "/pacientes/1") return Response.json({ ...testPatient, ...JSON.parse(options.body || "{}") });
    if (pathname === "/odontologos") return Response.json(testPage === "panel_cliente.html"
      ? [testDoctor, { ...testDoctor, id_odontologo: 3, nombre: "Profesional", apellido: "Alternativo" }]
      : [testDoctor]);
    if (pathname === "/consultorios") return Response.json([testOffice]);
    if (pathname === "/usuarios") return Response.json(testUsers);
    if (pathname.startsWith("/usuarios/")) return Response.json(testUsers.find((user) => user.id_usuario === Number(pathname.split("/").pop())) || {});
    if (pathname === "/tratamientos") return Response.json([testTreatment]);
    if (pathname === "/tratamientos/1") return Response.json(testTreatment);
    if (pathname === "/citas/10") return Response.json(testAppointment);
    if (pathname === "/citas" || pathname === "/citas/odontologo/2" || pathname === "/citas/paciente/1") return Response.json([testAppointment]);
    if (pathname === "/citas/disponibilidad/alternativa") {
      return Response.json({ id_odontologo: 3, odontologo: "Profesional Alternativo", consultorio: testOffice.nombre,
        fecha: searchParams.get("fecha"), hora: "09:00" });
    }
    if (pathname.startsWith("/citas/disponibilidad/odontologo/")) {
      return Response.json({ horarios: ["08:30", "09:00"], duracion_minutos: 30,
        hora_disponible: searchParams.has("hora") ? searchParams.get("hora") !== "08:00" : null });
    }
    if (pathname.startsWith("/historias-clinicas-detalladas/")) return Response.json({ paciente: testPatient, datos_clinicos: {} });
    if (pathname.startsWith("/odontogramas/")) return Response.json({ dientes: {} });
    return Response.json([]);
  };
</script>`;
const liveApi = `<script>
  const browserFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const target = new URL(input, location.href);
    if (target.origin === "http://127.0.0.1:8000") {
      target.port = "56484";
      return browserFetch(target, options);
    }
    return browserFetch(input, options);
  };
</script>`;
const serve = async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    const [, ...segments] = url.pathname.split("/");
    const original = segments[0] === "original";
    const parts = original ? segments.slice(1) : segments;
    const root = original ? resolve(baseline, "frontend") : resolve(frontend, "dist");
    const file = resolve(root, ...parts);
    if (!file.startsWith(root + sep)) {
      response.writeHead(404).end();
      return;
    }
    const extension = extname(file);
    let data;
    try {
      data = await readFile(file);
    } catch (error) {
      if (original || (extension && extension !== ".html")) throw error;
      data = await readFile(join(root, "index.html"));
    }
    const contentType = types[extension || ".html"] ?? "application/octet-stream";
    if (!liveClinic && contentType.startsWith("text/html")) {
      const html = data.toString();
      data = html.replace(/<body\b[^>]*>/i, (body) => body + (liveSession ? liveApi : apiMock));
    }
    response.writeHead(200, { "Content-Type": contentType }).end(data);
  } catch {
    response.writeHead(404).end();
  }
};
const server = tls ? createHttpsServer(tls, serve) : createServer(serve);

const browser = spawn(browserPath, [
  "--headless=new", "--disable-gpu", "--disable-background-networking",
  "--no-first-run", "--no-default-browser-check", "--no-proxy-server",
  ...(certificatePin ? ["--ignore-certificate-errors-spki-list=" + certificatePin] : []),
  "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank",
], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
let socket;
try {
  await new Promise((resolve) => server.listen(liveSession || liveClinic ? 5176 : 0, "127.0.0.1", resolve));
  const debuggerUrl = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("Browser debugger startup timed out")), 15000);
    browser.on("error", reject);
    browser.on("exit", (code) => reject(new Error("Browser exited " + code + " " + output)));
    browser.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on ws:\/\/([^/]+)/);
      if (match) {
        clearTimeout(timer);
        resolve("http://" + match[1]);
      }
    });
  });
  const targets = await (await fetch(debuggerUrl + "/json/list")).json();
  const target = targets.find(({ type, url }) => type === "page" && url === "about:blank");
  if (!target) throw new Error("Missing browser tab: " + JSON.stringify(targets));
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") {
      console.error(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    }
  });
  function call(method, params = {}) {
    const key = ++id;
    return new Promise((resolve, reject) => {
      pending.set(key, { resolve, reject });
      socket.send(JSON.stringify({ id: key, method, params }));
    });
  }
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Network.enable");
  await call("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*", "*cdnjs.cloudflare.com*", "*google.com/maps/embed*"] });
  async function evaluate(expression) {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description);
    return result.result.value;
  }
  async function waitFor(expression, message, timeout = 3500) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = await evaluate(expression);
      if (result) return result;
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
    throw new Error(message);
  }
  async function visit(version, page, interactive = false, search = "") {
    const prefix = version === "react" ? "" : "/original";
    const url = `${tls ? "https" : "http"}://127.0.0.1:${server.address().port}${prefix}/html/${page}${interactive ? "?interactive=1" + search : search}`;
    const navigation = await call("Page.navigate", { url });
    if (navigation.errorText) throw new Error(navigation.errorText + " loading " + url);
    await waitFor(
      `location.href === ${JSON.stringify(url)} && document.readyState !== "loading"`,
      "Timed out loading " + url,
    );
  }
  async function snapshot(version, page, width, interactive = false) {
    await visit(version, page, interactive);
    if (version === "react") {
      await waitFor("Boolean(document.querySelector('.app-route')?.firstElementChild)", "React did not mount " + page);
    }
    if (interactive) {
      const ready = {
        "roles.html": "document.querySelector('#tablaRoles')?.textContent.includes('Rol de prueba')",
        "proveedores.html": "document.querySelector('#tablaProveedores')?.textContent.includes('Proveedor de prueba')",
        "tratamientos.html": "document.querySelector('#tablaTratamientos')?.textContent.includes('Limpieza')",
        "panel.html": "document.querySelector('#tablaUsuarios')?.textContent.includes('admin@example.invalid')",
        "odontograma.html": "document.querySelectorAll('.tooth').length === 32 && !document.querySelector('#btnGuardar').disabled",
        "historia_clinica.html": "document.querySelector('#pacienteNombre')?.textContent.includes('Paciente Ficticio')",
        "panel_odontologo.html": "document.querySelector('#citasHoyLista')?.textContent.includes('Paciente Ficticio')",
        "panel_cliente.html": "document.querySelector('#tablaServicios')?.textContent.includes('No hay servicios')",
        "citas.html": "Boolean(document.querySelector('[data-cita=\"10\"]'))",
      }[page];
      if (ready) await waitFor(ready, "Visual data fixture failed for " + page + " in " + version);
    }
    await waitFor(`Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter((link) => link.origin === location.origin).every((link) => Boolean(link.sheet))`, "Local styles did not load for " + page);
    await evaluate(`(async () => {
      document.documentElement.style.setProperty("scroll-behavior", "auto", "important");
      const style = document.createElement("style");
      style.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important }";
      document.head.append(style);
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => {})));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`);
    const screenshot = await call("Page.captureScreenshot", {
      format: "png",
      clip: { x: 0, y: 0, width, height: 850, scale: 1 },
    });
    return screenshot.data;
  }
  const selectedPages = process.argv.filter((argument) => argument.startsWith("--page=")).map((argument) => argument.slice("--page=".length));
  async function visualDifference(original, migrated) {
    if (original === migrated) return 0;
    return evaluate(`(async () => {
          async function read(png) {
            const blob = new Blob([Uint8Array.from(atob(png), (byte) => byte.charCodeAt(0))], { type: "image/png" });
            const image = await createImageBitmap(blob);
            const canvas = new OffscreenCanvas(image.width, image.height);
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            return context.getImageData(0, 0, image.width, image.height).data;
          }
          const [original, migrated] = await Promise.all([read(${JSON.stringify(original)}), read(${JSON.stringify(migrated)})]);
          let changed = 0;
          for (let i = 0; i < original.length; i += 4) {
            if (Math.max(...[0, 1, 2].map((channel) => Math.abs(original[i + channel] - migrated[i + channel]))) > 12) changed++;
          }
          return changed * 400 / original.length;
    })()`);
  }

  if (visualSpa) {
    const pages = (await readdir(join(baseline, "frontend", "html"))).filter((page) => !selectedPages.length || selectedPages.includes(page));
    const failures = [];
    const permittedDifference = 2;
    for (const width of [1366, 390]) {
      await call("Emulation.setDeviceMetricsOverride", { width, height: 850, deviceScaleFactor: 1, mobile: false });
      for (const page of pages) {
        let diff;
        for (let attempt = 0; attempt < 3; attempt++) {
          const original = await snapshot("original", page, width, true);
          const migrated = await snapshot("react", page, width, true);
          diff = await visualDifference(original, migrated);
          if (diff <= permittedDifference) break;
          console.log(page, width, "rechecking a frame with", diff.toFixed(3) + "% differing pixels");
        }
        console.log(page, width, diff ? diff.toFixed(3) + "% differing pixels" : "exact");
        if (diff > permittedDifference) failures.push(page + " at " + width);
      }
    }
    if (failures.length) throw new Error("Visual comparison exceeded tolerance: " + failures.join(", "));
    console.log(pages.length * 2 + " viewport comparisons within tolerance");
  }
  function inputValues(fields) {
    return evaluate(`(() => {
        for (const [selector, value] of Object.entries(${JSON.stringify(fields)})) {
          const field = document.querySelector(selector);
          const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value").set;
          set.call(field, value);
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
        }
    })()`);
  }

  if (liveSession) {
    async function login(name) {
      await waitFor("Boolean(document.querySelector('#loginForm'))", "Login did not render");
      await inputValues({ "#inCorreo": name + "@clinic.example", "#inPassword": "ClavePruebaAcceso123!" });
      await evaluate("document.querySelector('#loginForm').requestSubmit()");
      await waitFor("location.pathname === '/panel_odontologo' && !!document.querySelector('#pacientesGrid')", "Dentist login failed");
    }
    await visit("react", "login.html", true);
    await login("doctor1");
    const cookies = await call("Network.getCookies", { urls: ["http://127.0.0.1:56484/"] });
    if (!cookies.cookies.some(({ name, httpOnly }) => name === "odontosoft_session" && httpOnly)) {
      throw new Error("Browser did not store an HttpOnly session");
    }
    await visit("react", "odontograma.html", true, "&paciente=1");
    await waitFor("document.querySelector('#saveStatus')?.textContent.includes('Odontograma cargado')", "Authenticated reload did not restore the session");
    await evaluate("document.querySelector('#btnGuardar').click()");
    await waitFor("document.querySelector('#saveStatus')?.textContent.includes('están guardados')", "Clinical save through live API failed");
    await visit("react", "panel_odontologo.html", true);
    await waitFor("Boolean(document.querySelector('.paciente-card'))", "Assigned patient was not listed");
    await evaluate("document.querySelector('.sidebar-menu a[href=\"#\"]').click()");
    await waitFor("location.pathname === '/login' && !!document.querySelector('#loginForm')", "Logout did not return to login");
    await login("doctor2");
    await visit("react", "odontograma.html", true, "&paciente=1");
    await waitFor("document.querySelector('#toast')?.textContent.includes('No tienes permiso') && document.querySelector('#btnGuardar').disabled", "Unassigned dentist could work with the chart");
    console.log("Browser session, reload, assigned clinical save and unassigned denial passed with FastAPI and PostgreSQL");
  }

  if (liveClinic) {
    const password = "ClavePruebaAcceso123!";
    async function login(name, route) {
      await waitFor("Boolean(document.querySelector('#loginForm'))", "Login did not render");
      await inputValues({ "#inCorreo": name + "@clinic.example", "#inPassword": password });
      await evaluate("document.querySelector('#loginForm').requestSubmit()");
      await waitFor("location.pathname === " + JSON.stringify(route), "Login did not reach " + route, 7000);
    }
    const originCheck = (origin) => fetch(clinicApi + "/auth/login", {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
    });
    const [allowed, denied, health, docs] = await Promise.all([
      originCheck(clinicOrigin), originCheck("https://127.0.0.1:5177"), fetch(clinicApi + "/health"), fetch(clinicApi + "/docs"),
    ]);
    if (!health.ok || docs.status !== 404 || allowed.headers.get("access-control-allow-origin") !== clinicOrigin ||
        denied.status !== 400 || denied.headers.has("access-control-allow-origin") ||
        !health.headers.has("strict-transport-security")) {
      throw new Error("Production HTTPS and exact CORS checks failed");
    }
    const futureDay = await evaluate(`(() => {
      const date = new Date(new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota" }).format(new Date()) + "T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + 2);
      return date.toISOString().slice(0, 10);
    })()`);
    const headers = { "Content-Type": "application/json", Origin: clinicOrigin };
    async function separateSession(name) {
      const response = await fetch(clinicApi + "/auth/login", {
        method: "POST", headers, body: JSON.stringify({ correo: name + "@clinic.example", contrasena: password }),
      });
      if (!response.ok) throw new Error("Concurrent login failed");
      const profile = await response.json();
      const cookie = response.headers.get("set-cookie").split(";", 1)[0];
      return {
        cookie,
        submit: () => fetch(clinicApi + "/citas/reservar/paciente", {
          method: "POST", headers: { ...headers, Cookie: cookie },
          body: JSON.stringify({
            id_usuario: profile.id_usuario, id_odontologo: 2, id_tratamiento: 1, fecha: futureDay, hora: "14:30",
          }),
        }),
      };
    }
    const sessions = await Promise.all(["patient2", "racer"].map(separateSession));
    if (sessions[0].cookie === sessions[1].cookie) throw new Error("The sessions must have different cookies");
    const race = await Promise.all(sessions.map(({ submit }) => submit()));
    if (race.map(({ status }) => status).sort().join(",") !== "201,409") {
      throw new Error("Expected one reservation and one 409, received " + race.map(({ status }) => status));
    }
    console.log("HTTPS, exact CORS and concurrent reservations passed (201 and 409)");

    await visit("react", "login.html");
    await login("patient1", "/panel_cliente");
    const { cookies } = await call("Network.getCookies", { urls: [clinicApi + "/"] });
    if (!cookies.some(({ name, httpOnly, secure, sameSite }) => name === "odontosoft_session" && httpOnly && secure && sameSite === "Strict")) {
      throw new Error("Browser did not store the secure cookie");
    }
    async function book(hour) {
      await waitFor("document.querySelector('#btnAbrirReserva')?.disabled === false", "Patient dashboard did not load");
      await evaluate("document.querySelector('#btnAbrirReserva').click()");
      await waitFor("document.querySelector('#reservaOdontologo')?.value === '1'", "Booking catalog did not load");
      await inputValues({ "#reservaFecha": futureDay, "#reservaTratamiento": "1" });
      await waitFor("!!document.querySelector('[data-hora=\"" + hour + "\"]')", "No slot for " + hour);
      await evaluate("document.querySelector('[data-hora=\"" + hour + "\"]').click()");
      await waitFor("document.querySelector('#btnReservar')?.disabled === false", "Booking form remained disabled");
      await evaluate("document.querySelector('#reservaForm').requestSubmit()");
      await waitFor("!document.querySelector('#modalReserva') && document.querySelector('#tablaCitas')?.textContent.includes(" +
        JSON.stringify(hour) + ")", "The appointment did not appear in My Appointments");
    }
    await waitFor("document.querySelector('#btnAbrirReserva')?.disabled === false", "Patient dashboard did not load");
    await evaluate("document.querySelector('#btnAbrirReserva').click()");
    await waitFor("document.querySelector('#reservaOdontologo')?.value === '1'", "Booking catalog did not load");
    await inputValues({ "#reservaFecha": futureDay, "#reservaHora": "18:00" });
    await waitFor("document.querySelector('#reservaError')?.textContent.includes('entre las 08:00 y las 18:00') && " +
      "document.querySelector('#btnReservar')?.disabled", "Booking form accepted a start time at closing");
    await inputValues({ "#reservaFecha": futureDay, "#reservaHora": "14:30" });
    await waitFor("document.querySelector('#reservaError')?.textContent.includes('ya no está disponible')",
      "The requested time should be blocked by the shared room");
    await evaluate("document.querySelector('#btnBuscarAlternativa').click()");
    await waitFor("document.querySelector('#reservaAlternativa')?.textContent.includes('doctor2 Prueba') && " +
      "document.querySelector('#reservaAlternativa')?.textContent.includes('15:00')", "The next alternative did not appear");
    await evaluate("document.querySelector('#btnUsarAlternativa').click()");
    await waitFor("document.querySelector('#reservaOdontologo')?.value === '2' && " +
      "document.querySelector('#reservaHora')?.value === '15:00' && document.querySelector('#btnReservar')?.disabled === false",
      "The alternative did not update the booking");
    await evaluate("document.querySelector('#modalReserva .agenda-close').click()");
    await book("08:30");
    await book("10:30");
    await evaluate("document.querySelector('.sidebar-menu a[href=\"/login\"]').click()");
    await login("doctor1", "/panel_odontologo");
    await evaluate("document.querySelector('.sidebar-menu a[href=\"/citas\"]').click()");
    function later(days) {
      const date = new Date(futureDay + "T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    }
    const overrideDay = later(1);
    const vacationStart = later(5);
    const vacationEnd = later(6);
    await waitFor("Boolean(document.querySelector('.agenda-blocks summary'))", "Private agenda has no blocks section");
    await evaluate("document.querySelector('.agenda-blocks summary').click()");
    async function saveBlock(type, fields, label) {
      await waitFor("document.querySelector('#btnNuevoBloqueo')?.disabled === false", "The private block list did not load");
      await evaluate("document.querySelector('#btnNuevoBloqueo').click()");
      await inputValues({ "#bloqueoTipo": type });
      if (Object.keys(fields).length) await inputValues(fields);
      await evaluate("document.querySelector('#agendaBloqueoForm').requestSubmit()");
      await waitFor("!document.querySelector('#agendaBloqueoForm') && " +
        "document.querySelector('.agenda-block-list')?.textContent.includes(" + JSON.stringify(label) + ")",
      "The browser could not save " + label, 7000);
    }
    await saveBlock("descanso_diario", {}, "Descanso diario");
    await saveBlock("descanso_puntual", {
      "#bloqueoFechaDesde": overrideDay, "#bloqueoHoraDesde": "15:00", "#bloqueoHoraHasta": "16:00",
    }, "Descanso de un día");
    await saveBlock("vacaciones", {
      "#bloqueoFechaDesde": vacationStart, "#bloqueoFechaHasta": vacationEnd,
    }, "Vacaciones");
    function appointmentRow(hour) {
      return "Array.from(document.querySelectorAll('#tablaCitas tr')).find((row) => row.textContent.includes(" +
        JSON.stringify(futureDay + " " + hour) + "))";
    }
    async function edit(hour, values, expectedHour, expectedStatus) {
      const row = appointmentRow(hour);
      await waitFor("Boolean(" + row + "?.querySelector('[title=Editar]'))", "Appointment row missing at " + hour);
      await evaluate(row + ".querySelector('[title=Editar]').click()");
      await waitFor("Boolean(document.querySelector('#modalCita.open #inHora')?.value)", "Edit dialog did not load");
      await inputValues(values);
      await evaluate("document.querySelector('#btnGuardarCita').click()");
      await waitFor("!document.querySelector('#modalCita.open') && " + appointmentRow(expectedHour) +
        "?.textContent.includes(" + JSON.stringify(expectedStatus) + ")", "Appointment edit did not persist", 7000);
    }
    await edit("08:30", { "#inHora": "09:30" }, "09:30", "En Espera");
    await edit("10:30", { "#inEstado": "Cancelado" }, "10:30", "Cancelado");
    await edit("09:30", { "#inEstado": "En Consulta" }, "09:30", "En Consulta");
    await evaluate(appointmentRow("09:30") + ".querySelector('.btn-atender-cita').click()");
    await waitFor("location.pathname === '/historia_clinica' && document.querySelector('#btnGuardar')?.disabled === false",
      "The dentist could not open the visit");
    const clinicalUrl = await evaluate("location.href");
    const field = '[data-key="motivo_consulta"]';
    const note = "Revision dental ficticia para verificar respaldo";
    await inputValues({ [field]: note });
    await evaluate("document.querySelector('#btnGuardar').click()");
    await waitFor("document.querySelector('#toast')?.textContent.includes('Historia clínica guardada')", "Clinical record did not save");
    await call("Page.navigate", { url: clinicalUrl });
    await waitFor("document.querySelector('#btnGuardar')?.disabled === false && document.querySelector(" +
      JSON.stringify(field) + ")?.value === " + JSON.stringify(note), "Clinical record did not survive a reload");

    const downloadPath = await mkdtemp(join(profile, "pdf-"));
    await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath });
    await evaluate("document.querySelector('#btnPdfCompleta').click()");
    const downloadDeadline = Date.now() + 45000;
    let pdfName;
    while (!pdfName && Date.now() < downloadDeadline) {
      pdfName = (await readdir(downloadPath)).find((name) => name.startsWith("Historia_Clinica_") && name.endsWith(".pdf"));
      if (!pdfName) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!pdfName) throw new Error("PDF download missing. " + await evaluate("document.querySelector('#toast')?.textContent"));
    const pdfPath = join(downloadPath, pdfName);
    const pdf = await readFile(pdfPath);
    if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")) || pdf.length < 10000) throw new Error("PDF file is incomplete");
    await copyFile(pdfPath, join(tlsDirectory, "historia-ficticia.pdf"));

    await visit("react", "odontograma.html", true, "&paciente=1");
    await waitFor("document.querySelector('#saveStatus')?.textContent.includes('Odontograma cargado')", "Dental chart did not load");
    await evaluate(`document.querySelector('[data-diente="18"] [data-superficie="central"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
    await evaluate(`document.querySelector('[data-estado="caries"]').click()`);
    await evaluate("document.querySelector('#btnGuardar').click()");
    await waitFor("document.querySelector('#saveStatus')?.textContent.includes('están guardados')", "Dental chart did not save");
    await visit("react", "odontograma.html", true, "&paciente=1");
    await waitFor("document.querySelector('#saveStatus')?.textContent.includes('Odontograma cargado')", "Dental chart could not be reopened");
    const tooth = await evaluate("fetch(" + JSON.stringify(clinicApi + "/odontogramas/paciente/1") +
      ", { credentials: 'include' }).then(response => response.json()).then(chart => chart.dientes[18].superficies.central.estado)");
    if (tooth !== "caries") throw new Error("The chart did not retain the saved surface");

    await visit("react", "citas.html");
    await edit("09:30", { "#inEstado": "Finalizado" }, "09:30", "Finalizado");
    await visit("react", "panel_odontologo.html");
    await waitFor("Boolean(document.querySelector('.sidebar-menu a[href=\"#\"]'))", "Dentist dashboard did not load");
    await evaluate("document.querySelector('.sidebar-menu a[href=\"#\"]').click()");
    await login("doctor2", "/panel_odontologo");
    await visit("react", "odontograma.html", true, "&paciente=1");
    await waitFor("document.querySelector('#toast')?.textContent.includes('No tienes permiso') && document.querySelector('#btnGuardar').disabled",
      "Unassigned dentist could use the chart");
    const denials = await evaluate("Promise.all(" + JSON.stringify([
      clinicApi + "/odontogramas/paciente/1", clinicApi + "/historias-clinicas-detalladas/paciente/1",
    ]) + ".map((url) => fetch(url, { credentials: 'include' }).then(({ status }) => status)))");
    if (denials.join(",") !== "403,403") throw new Error("Unassigned dentist could read clinical data");
    const privateBlocks = await evaluate("fetch(" + JSON.stringify(clinicApi + "/bloqueos-agenda") +
      ", { credentials: 'include' }).then(response => response.json())");
    if (privateBlocks.length !== 0) throw new Error("Another dentist could see the configured blocks");
    await visit("react", "panel_odontologo.html");
    await waitFor("Boolean(document.querySelector('.sidebar-menu a[href=\"#\"]'))", "Dentist dashboard did not load");
    await evaluate("document.querySelector('.sidebar-menu a[href=\"#\"]').click()");
    await login("patient1", "/panel_cliente");
    const checks = [[futureDay, "14:00"], [overrideDay, "14:00"], [overrideDay, "15:00"], [vacationStart, "08:00"],
      [vacationEnd, "17:30"], [later(7), "17:30"], [later(7), "17:45"]];
    const availability = await evaluate("Promise.all(" + JSON.stringify(checks.map(([day, hour]) =>
      clinicApi + "/citas/disponibilidad/odontologo/1?fecha=" + day + "&hora=" + hour)) +
      ".map(url => fetch(url, { credentials: 'include' }).then(r => r.json()).then(value => value.hora_disponible)))");
    if (availability.join(",") !== "false,true,false,false,false,true,false") {
      throw new Error("Incorrect availability after saving private agenda blocks: " + availability);
    }
    console.log("Browser verified private breaks, vacation dates and 08:00–18:00 availability");
    console.log("Browser verified booking, rescheduling, cancellation, attendance, chart, history, PDF download and access denials");
  }

  if (!visualSpa && !liveSession && !liveClinic) {
    await visit("react", "index.html", true);
    await waitFor("Boolean(document.querySelector('.slide.active')) && document.querySelector('.slide.active') === document.querySelector('.slide')", "Landing did not mount");
    await evaluate("document.querySelector('.carousel-btn.next').click()");
    await waitFor("document.querySelector('.slide.active') === document.querySelectorAll('.slide')[1]", "Carousel did not advance");
    await evaluate("document.querySelector('.menu-login').click()");
    await waitFor("location.pathname === '/login' && !!document.querySelector('#loginForm')", "Login route did not mount");
    await evaluate("document.querySelector('.toggle-password').click()");
    await waitFor("document.querySelector('#inPassword').type === 'text'", "Password visibility failed");
    await evaluate(`(() => {
      const email = document.querySelector('#inCorreo');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(email, "prueba@example.invalid");
      email.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector('#inPassword').value = "prueba-ficticia";
      document.querySelector('#loginForm').requestSubmit();
    })()`);
    await waitFor("window.calls?.some(([path]) => path === '/auth/login') && document.querySelector('#toast').textContent.includes('incorrectos')", "Login validation failed");
    await evaluate("document.querySelector('a[href=\"/forgot-password\"]').click()");
    await waitFor("location.pathname === '/forgot-password' && !!document.querySelector('#forgotForm')", "Recovery route did not mount");
    await inputValues({ "#inCorreo": "prueba@example.invalid" });
    await evaluate("document.querySelector('#forgotForm').requestSubmit()");
    await waitFor("document.querySelector('#toast')?.textContent.includes('Enlace de prueba solicitado')", "Recovery request was not submitted");
    await evaluate("history.back()");
    await waitFor("location.pathname === '/login' && !!document.querySelector('#loginForm')", "Browser history did not restore login");
    await visit("react", "reset-password.html", true);
    await waitFor("document.querySelector('#resetForm')?.style.display === 'none' && document.querySelector('#toast').textContent.includes('inválido')", "Old reset URL failed");
    await visit("react", "reset-password.html", true, "&check=1#token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    await waitFor("Boolean(document.querySelector('#inPassword2'))", "Reset form did not mount with a token");
    await inputValues({ "#inPassword": "PruebaOdonto2026!", "#inPassword2": "PruebaOdonto2026!" });
    await evaluate("document.querySelector('#resetForm').requestSubmit()");
    await waitFor(`window.calls?.some(([path, method, body]) => path === "/auth/reset-password" && method === "POST" &&
      JSON.parse(body).token === "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")`, "Reset request did not preserve the token");
    for (const [page, form, table, name] of [
      ["roles.html", "modalRol", "tablaRoles", "Rol de prueba"],
      ["proveedores.html", "modalProveedor", "tablaProveedores", "Proveedor de prueba"],
    ]) {
      await visit("react", page, true);
      await waitFor(`document.getElementById(${JSON.stringify(table)})?.textContent.includes(${JSON.stringify(name)})`, "List did not load: " + page);
      await evaluate("document.querySelector('header button.btn-primary').click()");
      await waitFor(`document.getElementById(${JSON.stringify(form)})?.classList.contains("open")`, "Dialog did not open: " + page);
      await evaluate("document.querySelector('.btn-cancelar').click()");
      await waitFor(`!document.getElementById(${JSON.stringify(form)})?.classList.contains("open")`, "Dialog did not close: " + page);
    }
    await visit("react", "registro.html", true);
    await waitFor("!!document.querySelector('#registroForm')", "Registration did not mount");
    await evaluate("document.querySelector('#registroForm').requestSubmit()");
    await waitFor("document.querySelector('#toast')?.textContent.includes('obligatorios')", "Registration validation failed");
    await inputValues({
      "#inNombre": "Paciente", "#inApellido": "Ficticio", "#inCorreo": "registro@example.invalid",
      "#inTelefono": "3000000000", "#inPassword": "PruebaOdonto2026!", "#inConfirmPassword": "PruebaOdonto2026!",
      "#inTipoDocumento": "CC", "#inDocumento": "DOC-REGISTRO", "#inFechaNacimiento": "1990-06-15",
    });
    await evaluate("document.querySelector('#registroForm').requestSubmit()");
    await waitFor(`window.calls?.some(([path, method, body]) => path === "/auth/registro" && method === "POST" &&
      JSON.parse(body).correo === "registro@example.invalid" && JSON.parse(body).tipo_documento === "CC" &&
      JSON.parse(body).documento === "DOC-REGISTRO" && JSON.parse(body).fecha_nacimiento === "1990-06-15")`, "Registration payload failed");
    await visit("react", "odontograma.html", true);
    await waitFor("document.querySelectorAll('.tooth').length === 32 && !document.querySelector('#btnGuardar').disabled", "Dental chart did not load");
    await evaluate(`document.querySelector('[data-diente="18"] [data-superficie="central"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
    await waitFor("document.querySelector('#superficieActual')?.textContent.includes('central')", "Dental surface was not selected");
    await evaluate(`document.querySelector('[data-estado="caries"]').click()`);
    await waitFor(`document.querySelector('[data-estado="caries"]').classList.contains("active")`, "Dental status was not selected");
    await evaluate("document.querySelector('#btnGuardar').click()");
    await waitFor(`window.calls?.some(([path, method, body]) =>
      path === "/odontogramas/paciente/1" && method === "PUT" && JSON.parse(body).dientes[18].superficies.central.estado === "caries"
    )`, "Dental chart did not save the selected surface");
    await visit("react", "historia_clinica.html", true);
    await waitFor(`document.querySelector('#pacienteNombre')?.textContent.includes("Paciente Ficticio") && window.calls?.some(([path]) => path === "/historias-clinicas-detalladas/paciente/1")`, "Clinical record did not load");
    await waitFor(`["#personalTipoDocumento", "#personalDocumento", "#personalNacimiento"].every(
      (selector) => document.querySelector(selector)?.matches("dd") && document.querySelector(selector)?.textContent
    ) && document.querySelector('[data-key="eps"]')?.readOnly === false`, "Clinical identity editing permissions failed");
    await inputValues({ '[data-key="eps"]': "EPS Ficticia" });
    await waitFor("document.querySelectorAll('#examen').length === 1 && !document.querySelector('.hc-steps')", "Clinical record is not a single form");
    await evaluate("document.querySelector('#btnPdfCompleta').click()");
    await waitFor(`window.generatedPdf?.sections.includes("Información general") && window.generatedPdf.text.includes("Paciente Ficticio") && window.calls?.some(([path, method, body]) =>
      path === "/historias-clinicas-detalladas/paciente/1" && method === "PUT" &&
      JSON.parse(body).datos_clinicos.eps === "EPS Ficticia" && !("documento" in JSON.parse(body).datos_clinicos))`, "Clinical record PDF or save failed");
    await visit("react", "panel_cliente.html", true);
    await waitFor("document.querySelector('#btnAbrirReserva')?.disabled === false", "Patient dashboard did not load");
    await evaluate("document.querySelector('.btn-perfil-header').click()");
    await waitFor("document.querySelector('#modalEditarPerfil.open #inDocumento')?.value === 'PRUEBA'", "Patient identity did not load in the profile");
    await inputValues({ "#inTipoDocumento": "CE", "#inDocumento": "DOC-PERFIL", "#inFechaNacimiento": "1991-06-15" });
    await evaluate("document.querySelector('#btnGuardarPerfil').click()");
    await waitFor(`window.calls?.some(([path, method, body]) => path === "/pacientes/1" && method === "PUT" &&
      JSON.parse(body).tipo_documento === "CE" && JSON.parse(body).documento === "DOC-PERFIL" &&
      JSON.parse(body).fecha_nacimiento === "1991-06-15")`, "Patient identity changes were not saved");
    await evaluate("document.querySelector('#btnAbrirReserva').click()");
    await waitFor("document.querySelector('#reservaOdontologo')?.value === '2'", "Reservation catalog failed");
    await evaluate(`(() => {
      const date = document.querySelector('#reservaFecha');
      const tomorrow = new Date(date.min + "T12:00:00Z");
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(date, tomorrow.toISOString().slice(0, 10));
      date.dispatchEvent(new Event("input", { bubbles: true }));
      date.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(`document.querySelector('[data-hora="08:30"]') && !document.querySelector('[data-hora="08:00"]')`, "Reservation did not exclude occupied slots");
    await evaluate(`document.querySelector('[data-hora="08:30"]').click()`);
    await waitFor("!document.querySelector('#btnReservar')?.disabled", "Reservation could not be confirmed");
    await evaluate("document.querySelector('#reservaForm').requestSubmit()");
    await waitFor(`window.calls?.some(([path, method, body]) =>
      path === "/citas/reservar/paciente" && method === "POST" && JSON.parse(body).hora === "08:30"
    ) && !document.querySelector("#modalReserva")`, "Reservation was not saved");
    await evaluate("document.querySelector('#btnAbrirReserva').click()");
    await waitFor("document.querySelector('#reservaOdontologo')?.value === '2'", "Booking catalog did not reload");
    const alternateDate = await evaluate(`(() => {
      const date = new Date(document.querySelector("#reservaFecha").min + "T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + 1);
      return date.toISOString().slice(0, 10);
    })()`);
    await inputValues({ "#reservaFecha": alternateDate, "#reservaHora": "08:00" });
    await waitFor("document.querySelector('#reservaError')?.textContent.includes('ya no está disponible')", "The selected slot is busy");
    await evaluate("document.querySelector('#btnBuscarAlternativa').click()");
    await waitFor("document.querySelector('#reservaAlternativa')?.textContent.includes('Profesional Alternativo')", "No alternative was shown");
    await evaluate("document.querySelector('#btnUsarAlternativa').click()");
    await waitFor("document.querySelector('#reservaOdontologo')?.value === '3' && " +
      "document.querySelector('#reservaHora')?.value === '09:00' && document.querySelector('#btnReservar')?.disabled === false",
      "The alternative did not populate the reservation");
    if (await evaluate("window.calls.filter(([path, method]) => path === '/citas/reservar/paciente' && method === 'POST').length") !== 1) {
      throw new Error("Choosing a suggestion should not book the appointment");
    }
    await evaluate("document.querySelector('#reservaForm').requestSubmit()");
    await waitFor(`window.calls?.some(([path, method, body]) =>
      path === "/citas/reservar/paciente" && method === "POST" &&
      JSON.parse(body).id_odontologo === 3 && JSON.parse(body).hora === "09:00"
    ) && !document.querySelector("#modalReserva")`, "The alternative booking was not submitted");

    await visit("react", "panel_odontologo.html", true);
    await waitFor("document.querySelector('.paciente-card')?.textContent.includes('Paciente Ficticio')", "Dentist dashboard did not load");
    await evaluate("document.querySelector('.paciente-card .btn-clinico').click()");
    await waitFor("document.querySelector('#fichaPaciente.open #fichaTitulo')?.textContent.includes('Paciente Ficticio')", "Quick details did not open");
    await evaluate("document.querySelector('#fichaContenido .agenda-btn.primary').click()");
    await waitFor("location.pathname === '/historia_clinica' && new URLSearchParams(location.search).get('paciente') === '1' && !!document.querySelector('#historiaForm')", "Clinical link did not retain the patient");

    await visit("react", "citas.html", true);
    await waitFor("document.querySelectorAll('.cal-day').length === 42 && !!document.querySelector('[data-cita=\"10\"]')", "Monthly calendar did not load");
    await evaluate(`(() => {
      const select = document.querySelector("#calVista");
      select.value = "semana";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor("document.querySelectorAll('.cal-day').length === 7", "Weekly calendar did not load");
    await evaluate("document.querySelector('[data-cita=\"10\"]').click()");
    await waitFor("document.querySelector('#calDetalle.open #calDetalleTitulo')?.textContent.includes('Paciente Ficticio')", "Calendar detail did not open");
    await evaluate("document.querySelector('#calEditar').click()");
    await waitFor("document.querySelector('#modalCita.open #editId')?.value === '10'", "Calendar edit did not load");
    await evaluate("document.querySelector('#btnGuardarCita').click()");
    await waitFor(`window.calls?.some(([path, method, body]) =>
      path === "/citas/10" && method === "PUT" && JSON.parse(body).duracion_minutos === 45
    ) && !document.querySelector("#modalCita.open")`, "Calendar edit was not saved");

    await visit("react", "tratamientos.html", true);
    await waitFor("document.querySelector('#tablaTratamientos')?.textContent.includes('Limpieza')", "Treatment catalog did not load");
    await evaluate("document.querySelector('#tablaTratamientos .btn-icon').click()");
    await waitFor("document.querySelector('#modalTrat.open #inPrecio')?.value === '150.000'", "Treatment price did not load");
    await evaluate("document.querySelector('#btnGuardarTratamiento').click()");
    await waitFor(`window.calls?.some(([path, method, body]) =>
      path === "/tratamientos/1" && method === "PUT" && JSON.parse(body).costo === 150000
    ) && !document.querySelector("#modalTrat.open")`, "Treatment edit was not saved");
    await visit("react", "tratamientos.html", true, "&dentist=1");
    await waitFor("document.querySelector('.solo-lectura-tratamiento')?.textContent.includes('Solo lectura') && !document.querySelector('#tablaTratamientos .btn-icon')", "Dentist can edit the treatment catalog");

    await visit("react", "panel.html", true);
    await waitFor("document.querySelector('#tablaUsuarios')?.textContent.includes('admin@example.invalid')", "Admin dashboard did not load");
    await evaluate("document.querySelector('#tarjetaPacientes').click()");
    await waitFor("document.querySelector('#tablaUsuarios')?.textContent.includes('paciente@example.invalid') && !document.querySelector('#tablaUsuarios').textContent.includes('admin@example.invalid')", "User role filter failed");
    await evaluate("document.querySelector('#btnLimpiarFiltroUsuarios').click()");
    await waitFor("document.querySelector('#tablaUsuarios')?.textContent.includes('admin@example.invalid')", "Resetting the user filter failed");
    await evaluate("document.querySelector('#tablaUsuarios .btn-icon').click()");
    await waitFor("document.querySelector('#modalUsuario.open #editId')?.value === '1'", "User edit did not load");
    await evaluate("document.querySelector('#btnGuardarUsuario').click()");
    await waitFor(`window.calls?.some(([path, method, body]) =>
      path === "/pacientes/1" && method === "PUT" && JSON.parse(body).correo === "paciente@example.invalid"
    )`, "Patient profile edit was not saved");

    const routeMarkers = {
      index: ".slide", login: "#loginForm", registro: "#registroForm", "forgot-password": "#forgotForm", "reset-password": "#resetForm",
      "politica-privacidad": "h1", "proteccion-datos": "h1", "uso-sistema": "h1", pacientes: "table", odontologos: "table", especialidades: "table",
      contacto: "#inMensaje", roles: "#tablaRoles", proveedores: "#tablaProveedores", prueba_tratamiento: "#resultadoDatos",
      odontograma: "#q1", historia_clinica: "#historiaForm", panel_odontologo: "#pacientesGrid", panel_cliente: "#tablaServicios",
      citas: "#calGrid", tratamientos: "#tablaTratamientos", panel: "#tablaUsuarios",
    };
    for (const [route, marker] of Object.entries(routeMarkers)) {
      await visit("react", route + ".html", true);
      await waitFor(`Boolean(document.querySelector(${JSON.stringify(marker)}))`, "Legacy URL did not mount: " + route);
    }
    console.log("All 22 SPA routes and representative navigation, authentication, administration, agenda and clinical workflows passed");
  }
} finally {
  socket?.close();
  server.close();
  if (browser.exitCode === null) {
    const closed = new Promise((resolve) => browser.once("close", resolve));
    browser.kill();
    await closed;
  }
  if (dirname(resolve(profile)) === resolve(tmpdir()) && basename(profile).startsWith("odontosoft-browser-")) {
    await rm(profile, { recursive: true, force: true, maxRetries: 4 });
  }
}
