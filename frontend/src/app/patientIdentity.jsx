import { today } from "./agenda.js";

export const documentTypes = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  CE: "Cédula de extranjería",
  PA: "Pasaporte",
  RC: "Registro civil",
  PPT: "Permiso por Protección Temporal",
  PEP: "Permiso Especial de Permanencia",
  OTRO: "Otro documento",
};

export function DocumentType(props) {
  return <select {...props}>
    <option value="">Selecciona el tipo de documento</option>
    {Object.entries(documentTypes).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
  </select>;
}

export function BirthDate(props) {
  return <input type="date" max={today()} autoComplete="bday" {...props} />;
}
