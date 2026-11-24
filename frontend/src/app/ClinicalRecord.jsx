import { useEffect, useId, useRef, useState } from "react";
import { request } from "./api.js";
import { getUser, normalizeRole } from "./session.js";
import { Toast, useToast } from "./authUi.jsx";
import { VoiceField } from "./VoiceField.jsx";
import { downloadClinicalPdf } from "./clinicalPdf.jsx";
import { ClinicalAttachments } from "./ClinicalAttachments.jsx";
import { today } from "./agenda.js";
import { documentTypes } from "./patientIdentity.jsx";
import {
  patientFields, consultationFields, historyChecks, historyNotes, vitalFields, oralFields,
  examinationNotes, diagnosisFields, budgetFields, consentFields, paymentFields, procedureFields, followupFields,
} from "./clinicalFields.js";

const gender = { f: "Femenino", femenino: "Femenino", m: "Masculino", masculino: "Masculino", otro: "Otro" };

function age(date) {
  if (!date) return "";
  const current = today();
  const years = Number(current.slice(0, 4)) - Number(date.slice(0, 4)) - Number(current.slice(5) < date.slice(5));
  return years >= 0 ? years : "";
}

function readLegacyRows(values) {
  const financial = [1, 2, 3, 4].map((index) => ({
    fecha: values["fin_fecha_" + index], abono: values["fin_abono_" + index], saldo: values["fin_saldo_" + index],
  }));
  const executed = [{
    fecha: values.tratamiento_fecha, hora: values.tratamiento_hora, diente_zona: values.tratamiento_diente_zona,
    procedimientos: values.tratamiento_procedimientos, firma_odontologo: values.firma_odontologo, firma_paciente: values.firma_paciente,
  }];
  return {
    movimientos_financieros: Array.isArray(values.movimientos_financieros) ? values.movimientos_financieros
      : financial.filter((row) => Object.values(row).some(Boolean)),
    tratamientos_ejecutados: Array.isArray(values.tratamientos_ejecutados) ? values.tratamientos_ejecutados
      : executed.filter((row) => Object.values(row).some(Boolean)),
  };
}

function Symbol({ name }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

function Field({ definition, value, onChange }) {
  const inputId = useId();
  const [key, label, input] = definition;
  const note = input === "note";
  const content = String(value ?? "");
  const common = { id: inputId, "data-key": key, value: content };
  return (
    <div className={"clinical-field" + (note ? " clinical-field-note" : "")}>
      <label htmlFor={inputId}>{label}</label>
      {Array.isArray(input)
        ? <select {...common} onChange={(event) => onChange(event.target.value)}>
            <option value="">Sin registrar</option>
            {content && !input.includes(content) && <option>{content}</option>}
            {input.map((choice) => <option key={choice}>{choice}</option>)}
          </select>
        : input?.type === "email"
          ? <input {...common} type="email" onChange={(event) => onChange(event.target.value)} />
          : <VoiceField {...common} {...(typeof input === "object" ? input : {})}
              as={note ? "textarea" : "input"} onValue={onChange} />}
    </div>
  );
}

function Fields({ definitions, values, onChange }) {
  return (
    <div className="clinical-fields">
      {definitions.map((definition) => (
        <Field key={definition[0]} definition={definition} value={values[definition[0]]}
          onChange={(value) => onChange(definition[0], value)} />
      ))}
    </div>
  );
}

function ClinicalSection({ id, title, icon, action, children }) {
  return (
    <section className="clinical-section" aria-labelledby={id}>
      <div className="clinical-section-heading">
        <span className="clinical-section-icon"><Symbol name={icon} /></span>
        <h2 id={id}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProfileFields({ patient }) {
  const identity = [
    ["personalNombre", "Nombres", patient.nombre],
    ["personalPrimerApellido", "Primer apellido", patient.apellido],
    ["personalTipoDocumento", "Tipo de documento", documentTypes[patient.tipo_documento]],
    ["personalDocumento", "Número de documento", patient.documento],
    ["personalNacimiento", "Fecha de nacimiento", patient.fecha_nacimiento],
    ["personalEdad", "Edad", age(patient.fecha_nacimiento)],
    ["personalTelefono", "Teléfono registrado", patient.telefono],
  ];
  return (
    <dl className="clinical-profile">
      {identity.map(([id, label, value]) => (
        <div key={id}>
          <dt>{label}</dt><dd id={id}>{value !== "" && value != null ? value : "Sin registrar"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Entries({ rows, definitions, onChange, onAdd, onRemove, empty, noun }) {
  return (
    <>
      {!rows.length && <p className="clinical-empty">{empty}</p>}
      {rows.map((row, index) => (
        <fieldset className="clinical-entry" key={row.key}>
          <legend>{noun} {index + 1}</legend>
          <Fields definitions={definitions} values={row.fields}
            onChange={(key, value) => onChange(row.key, key, value)} />
          <button className="clinical-remove" type="button" onClick={() => onRemove(row.key)}
            aria-label={"Quitar " + noun.toLowerCase() + " " + (index + 1)}><Symbol name="remove_circle" /> Quitar</button>
        </fieldset>
      ))}
      <button className="clinical-button clinical-button-secondary" type="button" onClick={onAdd}>
        <Symbol name="add" /> Añadir {noun.toLowerCase()}
      </button>
    </>
  );
}

export default function ClinicalRecord({ search, navigate }) {
  const params = new URLSearchParams(search);
  const patientId = params.get("paciente") || localStorage.getItem("paciente_clinico_id");
  const appointmentId = params.get("cita") || localStorage.getItem("cita_clinica_id");
  const user = getUser();
  const dentist = normalizeRole(user?.rol) === "odontologo";
  const [patient, setPatient] = useState(null);
  const [values, setValues] = useState({});
  const [entries, setEntries] = useState({});
  const [appointment, setAppointment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, showToast] = useToast();
  const form = useRef(null);
  const nextKey = useRef(0);
  const endpoint = "/historias-clinicas-detalladas/paciente/" + patientId;
  const loaded = Number(patient?.id_paciente) === Number(patientId);
  const patientName = loaded ? [patient.nombre, patient.apellido, values.segundo_apellido].filter(Boolean).join(" ") : "";

  useEffect(() => {
    if (!user || !dentist || !patientId) {
      navigate(!user ? "/login" : !dentist ? "/panel" : "/panel_odontologo", { replace: true });
      return;
    }
    const abort = new AbortController();
    const options = { signal: abort.signal };
    async function load() {
      setLoadError("");
      setPatient(null);
      setAppointment(null);
      try {
        const record = await request(endpoint, options);
        const person = record.paciente;
        const initial = { ...record.datos_clinicos };
        const rawGender = initial.genero ?? person.genero ?? "";
        initial.genero = gender[String(rawGender).trim().toLowerCase()] || rawGender;
        initial.direccion ??= person.direccion;
        initial.eps ??= person.eps;
        initial.alergias ??= person.alergias;
        initial.correo_contacto ??= person.correo;
        const visit = appointmentId ? await request("/citas/" + appointmentId, options).catch(() => null) : null;
        const current = Number(visit?.id_paciente) === Number(patientId) ? visit : null;
        if (!abort.signal.aborted) {
          if (current?.estado === "En Consulta") initial.motivo_consulta ||= current.motivo_consulta || "";
          setValues(initial);
          setEntries(Object.fromEntries(Object.entries(readLegacyRows(initial)).map(([group, list]) => [
            group, list.filter((fields) => fields && typeof fields === "object" && !Array.isArray(fields))
              .map((fields) => ({ key: ++nextKey.current, fields })),
          ])));
          setAppointment(current);
          setPatient(person);
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          setLoadError(error.message);
          showToast(error.message, "error");
        }
      }
    }
    load();
    return () => abort.abort();
  }, [Boolean(user), dentist, patientId, appointmentId, endpoint, navigate, showToast]);

  function update(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function entryActions(group, defaults = {}) {
    return {
      rows: entries[group] ?? [],
      onAdd: () => {
        const row = { key: ++nextKey.current, fields: defaults };
        setEntries((current) => ({ ...current, [group]: [...(current[group] ?? []), row] }));
      },
      onChange: (id, key, value) => setEntries((current) => ({
        ...current, [group]: current[group].map((row) => row.key === id ? { ...row, fields: { ...row.fields, [key]: value } } : row),
      })),
      onRemove: (id) => setEntries((current) => ({
        ...current, [group]: current[group].filter((row) => row.key !== id),
      })),
    };
  }

  async function save() {
    if (!loaded || saving) return false;
    setSaving(true);
    const tables = Object.fromEntries(Object.entries(entries).map(([group, rows]) => [
      group, rows.map((row) => row.fields).filter((fields) => Object.values(fields).some((value) => String(value ?? "").trim())),
    ]));
    try {
      await request(endpoint, {
        method: "PUT", body: { id_paciente: Number(patientId), datos_clinicos: { ...values, ...tables } },
      });
      showToast("Historia clínica guardada");
      return true;
    } catch (error) {
      showToast(error.message, "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    if (saving || exporting) return;
    setExporting(true);
    try {
      if (await save()) await downloadClinicalPdf(form.current, patientName);
    } catch (error) {
      showToast(error.message || "No se pudo generar el PDF", "error");
    } finally {
      setExporting(false);
    }
  }

  if (!user || !dentist || !patientId) return null;
  const procedureDefaults = appointment?.estado === "En Consulta"
    ? { fecha: appointment.fecha, hora: String(appointment.hora || "").slice(0, 5) } : {};
  const fieldProps = { values, onChange: update };
  return (
    <main className="clinical-sheet">
      <Toast message={message} />
      <div className="clinical-sheet-shell">
        <a className="clinical-back" href="/panel_odontologo"><Symbol name="arrow_back" /> Panel del odontólogo</a>
        <header className="clinical-sheet-hero">
          <div className="clinical-sheet-brand"><Symbol name="dentistry" /> OdontoSoft</div>
          <h1>Historia clínica odontológica</h1>
          {loaded && <p id="pacienteNombre" className="clinical-patient-name">{patientName}</p>}
          {appointment && <p className="clinical-visit">Cita del {appointment.fecha} · {String(appointment.hora || "").slice(0, 5)}</p>}
          {loaded && <a className="clinical-plan" href={"/mi-tratamiento?paciente=" + patientId}>Ver plan del paciente <Symbol name="arrow_outward" /></a>}
        </header>
        {loaded ? <>
          <div className="clinical-toolbar">
            <span><Symbol name="mic" /> Pulsa el micrófono para grabar y vuelve a pulsarlo para transcribir.</span>
            <div>
              <button id="btnPdfCompleta" className="clinical-button clinical-button-secondary" type="button"
                onClick={exportPdf} disabled={saving || exporting}><Symbol name="picture_as_pdf" /> Descargar PDF</button>
              <button id="btnGuardar" className="clinical-button clinical-button-primary" type="submit" form="historiaForm"
                disabled={saving || exporting}><Symbol name="save" /> {saving ? "Guardando…" : "Guardar historia"}</button>
            </div>
          </div>
          <form id="historiaForm" className="clinical-form" ref={form} noValidate onSubmit={(event) => { event.preventDefault(); save(); }}>
            <ClinicalSection id="informacion" title="Información general" icon="person">
              <ProfileFields patient={patient} />
              <Fields definitions={patientFields} {...fieldProps} />
            </ClinicalSection>
            <ClinicalSection id="anamnesis" title="Motivo de consulta y anamnesis" icon="clinical_notes">
              <Fields definitions={consultationFields} {...fieldProps} />
              <h3>Antecedentes consultados</h3>
              <Fields definitions={historyChecks} {...fieldProps} />
              <details className="clinical-details">
                <summary>Antecedentes detallados y contexto familiar</summary>
                <Fields definitions={historyNotes} {...fieldProps} />
              </details>
            </ClinicalSection>
            <ClinicalSection id="examen" title="Examen odontológico" icon="dentistry" action={
              <a className="clinical-button clinical-button-secondary" href={"/odontograma?paciente=" + patientId}
                target="_blank" rel="noopener noreferrer"><Symbol name="open_in_new" /> Abrir odontograma</a>
            }>
              <h3>Signos vitales</h3>
              <Fields definitions={vitalFields} {...fieldProps} />
              <h3>Hallazgos de la exploración</h3>
              <Fields definitions={oralFields} {...fieldProps} />
              <Fields definitions={examinationNotes} {...fieldProps} />
              <ClinicalAttachments key={patientId} patientId={patientId} />
            </ClinicalSection>
            <ClinicalSection id="diagnostico" title="Diagnóstico y plan de tratamiento" icon="medical_services">
              <Fields definitions={diagnosisFields} {...fieldProps} />
            </ClinicalSection>
            <ClinicalSection id="presupuesto" title="Presupuesto" icon="request_quote">
              <Fields definitions={budgetFields} {...fieldProps} />
            </ClinicalSection>
            <ClinicalSection id="consentimiento" title="Aceptación y consentimiento informado" icon="assignment_turned_in">
              <Fields definitions={consentFields} {...fieldProps} />
            </ClinicalSection>
            <ClinicalSection id="estado-financiero" title="Estado financiero" icon="receipt_long">
              <Entries {...entryActions("movimientos_financieros")} definitions={paymentFields} noun="Movimiento"
                empty="Todavía no hay movimientos registrados en la historia." />
            </ClinicalSection>
            <ClinicalSection id="tratamientos" title="Tratamientos ejecutados" icon="fact_check">
              <Entries {...entryActions("tratamientos_ejecutados", procedureDefaults)} definitions={procedureFields} noun="Tratamiento"
                empty="Todavía no hay procedimientos registrados." />
              <details className="clinical-details">
                <summary>Seguimiento y notas de evolución</summary>
                <Fields definitions={followupFields} {...fieldProps} />
              </details>
            </ClinicalSection>
          </form>
        </> : <p role={loadError ? "alert" : "status"} className="clinical-load">{loadError || "Cargando historia clínica…"}</p>}
      </div>
    </main>
  );
}
