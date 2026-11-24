import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Login from "./Login.jsx";
import { ForgotPassword, ResetPassword } from "./PasswordRecovery.jsx";
import Landing from "./Landing.jsx";
import Contact from "./Contact.jsx";
import Roles from "./Roles.jsx";
import Register from "./Register.jsx";
import Suppliers from "./Suppliers.jsx";
import Products from "./Products.jsx";
import Survey from "./Survey.jsx";
import TreatmentTest from "./TreatmentTest.jsx";
import DentalChart from "./DentalChart.jsx";
import ClinicalRecord from "./ClinicalRecord.jsx";
import DentistDashboard from "./DentistDashboard.jsx";
import PatientDashboard from "./PatientDashboard.jsx";
import TreatmentPlan from "./TreatmentPlan.jsx";
import Billing from "./Billing.jsx";
import Appointments from "./Appointments.jsx";
import Treatments from "./Treatments.jsx";
import UserDashboard from "./UserDashboard.jsx";
import PrivacyPolicy from "./politica-privacidad.jsx";
import DataProtection from "./proteccion-datos.jsx";
import TermsOfUse from "./uso-sistema.jsx";
import Patients from "./pacientes.jsx";
import Dentists from "./odontologos.jsx";
import Specialties from "./especialidades.jsx";
import { routeDetails } from "./routeDetails.mjs";
import { restoreSession, setUser } from "./session.js";

const pages = {
  login: Login,
  "forgot-password": ForgotPassword,
  "reset-password": ResetPassword,
  index: Landing,
  contacto: Contact,
  roles: Roles,
  registro: Register,
  proveedores: Suppliers,
  "administrar-productos": Products,
  encuesta: Survey,
  prueba_tratamiento: TreatmentTest,
  odontograma: DentalChart,
  historia_clinica: ClinicalRecord,
  panel_odontologo: DentistDashboard,
  panel_cliente: PatientDashboard,
  "mi-tratamiento": TreatmentPlan,
  facturacion: Billing,
  citas: Appointments,
  tratamientos: Treatments,
  panel: UserDashboard,
  "politica-privacidad": PrivacyPolicy,
  "proteccion-datos": DataProtection,
  "uso-sistema": TermsOfUse,
  pacientes: Patients,
  odontologos: Dentists,
  especialidades: Specialties,
};

function routeName(pathname) {
  return pathname.replace(/^\/html\//, "/").replace(/\.html$/, "").replace(/^\/|\/$/g, "") || "index";
}

function currentLocation() {
  return window.location.pathname + window.location.search + window.location.hash;
}

function usePageStyles(detail) {
  useLayoutEffect(() => {
    document.title = detail?.title ?? "OdontoSoft";
    const styles = [...(detail?.css ?? [])];
    if (detail && detail.baseStyle !== false) styles.unshift("/css/style.css");
    if (detail?.poppins) {
      styles.unshift("https://fonts.googleapis.com/css2?family=Poppins:wght@" + detail.poppins + "&display=swap");
    }
    const links = styles.map((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.append(link);
      return link;
    });
    return () => links.forEach((link) => link.remove());
  }, [detail]);
}

function App() {
  const [location, setLocation] = useState(currentLocation);
  const [checkingSession, setCheckingSession] = useState(true);
  const url = new URL(location, window.location.origin);
  const path = routeName(url.pathname);
  const Page = Object.hasOwn(pages, path) ? pages[path] : null;
  usePageStyles(Page ? routeDetails[path] : null);

  useEffect(() => {
    localStorage.removeItem("usuario_actual");
    const controller = new AbortController();
    function onExpired() {
      setUser(null);
      window.location.replace("/login");
    }
    window.addEventListener("odontosoft:session-expired", onExpired);
    restoreSession(controller.signal).finally(() => {
      if (!controller.signal.aborted) setCheckingSession(false);
    });
    return () => {
      controller.abort();
      window.removeEventListener("odontosoft:session-expired", onExpired);
    };
  }, []);

  useEffect(() => {
    function onPopState() {
      if (!window.dispatchEvent(new Event("odontosoft:before-route", { cancelable: true }))) {
        window.history.pushState(null, "", location);
        return;
      }
      setLocation(currentLocation());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [location]);

  const navigate = useCallback((href, { replace = false } = {}) => {
    if (!window.dispatchEvent(new Event("odontosoft:before-route", { cancelable: true }))) return;
    const target = new URL(href, window.location.href);
    const targetPath = routeName(target.pathname);
    const canonical = targetPath === "index" ? "/" : "/" + targetPath;
    const next = canonical + target.search + target.hash;
    if (replace) window.history.replaceState(null, "", next);
    else window.history.pushState(null, "", next);
    setLocation(currentLocation());
    window.scrollTo(0, 0);
  }, []);

  function followLink(event) {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.target || anchor.hasAttribute("download") || anchor.origin !== window.location.origin) return;
    if (anchor.getAttribute("href").startsWith("#")) {
      const section = document.getElementById(anchor.hash.slice(1));
      if (section) {
        event.preventDefault();
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    event.preventDefault();
    navigate(anchor.href);
  }

  if (!Page) return <main><p>Página no encontrada.</p><a href="/">Volver al inicio</a></main>;
  if (checkingSession) return <main role="status">Comprobando sesión…</main>;
  return (
    <div className="app-route" onClick={followLink}>
      <Page key={path + url.search} search={url.search} hash={url.hash} navigate={navigate} />
    </div>
  );
}

createRoot(document.getElementById("app")).render(<App />);
