import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

function readSection(section) {
  const fields = Array.from(section.querySelectorAll(".clinical-profile > div"), (item) => [
    item.querySelector("dt").textContent, item.querySelector("dd").textContent,
  ]);
  for (const label of section.querySelectorAll(".clinical-field label")) {
    const control = label.control;
    const value = control?.value.trim();
    if (!value) continue;
    const row = label.closest(".clinical-entry")?.querySelector("legend").textContent;
    fields.push([row ? row + " · " + label.textContent : label.textContent, value]);
  }
  return { title: section.querySelector("h2").textContent, fields };
}

function ClinicalPdf({ sections, patient, issued }) {
  return (
    <div className="pdf-medical-document">
      <header className="pdf-medical-header">
        <div className="pdf-brand">
          <img className="pdf-logo-img" src="/assets/logo_odontosoft.png" alt="OdontoSoft" />
          <div>
            <div className="pdf-brand-name">Historia clínica odontológica</div>
            <p className="pdf-patient">{patient}</p>
          </div>
        </div>
        <p className="pdf-date">Fecha de emisión · {issued}</p>
      </header>
      {sections.filter(({ fields }) => fields.length).map(({ title, fields }) => (
        <section key={title}>
          <h2 className="pdf-section-title">{title}</h2>
          {fields.map(([label, value], index) => (
            <div className="pdf-field" key={index}>
              <div className="pdf-label">{label}</div>
              <div className="pdf-value">{value}</div>
            </div>
          ))}
        </section>
      ))}
      <footer className="pdf-footer">OdontoSoft · Historia clínica</footer>
    </div>
  );
}

export async function downloadClinicalPdf(form, patient) {
  const sections = Array.from(form.querySelectorAll(".clinical-section"), readSection);
  const html2pdf = window.html2pdf || (await import("html2pdf.js/src/index.js")).default;
  const suffix = patient.replace(/[^a-z0-9áéíóúñ ]/gi, " ").trim().replace(/\s+/g, "_") || "paciente";
  const holder = document.createElement("div");
  holder.className = "pdf-render-holder";
  holder.setAttribute("aria-hidden", "true");
  document.body.append(holder);
  const root = createRoot(holder);
  try {
    const issued = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
    flushSync(() => root.render(<ClinicalPdf sections={sections} patient={patient} issued={issued} />));
    await Promise.all(Array.from(holder.querySelectorAll("img"), (img) => img.decode().catch(() => {})));
    await html2pdf().set({
      margin: [7, 8, 10, 8],
      filename: "Historia_Clinica_" + suffix + ".pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: false, backgroundColor: "#ffffff", logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    }).from(holder.firstElementChild).save();
  } finally {
    root.unmount();
    holder.remove();
  }
}
