import { useState } from "react";
import { request } from "./api.js";

const initial = { idPaciente: "1", idOdontologo: "1", idTratamiento: "1", idConsultorio: "1", fecha: "2026-07-10", hora: "10:00", estado: "En Espera" };

function Json({ value }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function Result({ value, placeholder, pending, children }) {
  if (!value) return <p style={{ color: "#94a3b8" }}>{placeholder}</p>;
  if (value.busy) return pending;
  if (value.error) return <div className="error">❌ Error: {value.error}</div>;
  return children(value);
}

export default function PruebaTratamientoPage() {
  const [fields, setFields] = useState(initial);
  const [data, setData] = useState(null);
  const [creation, setCreation] = useState(null);
  function bind(field) {
    return {
      value: fields[field],
      onChange: (event) => {
        const value = event.target.value;
        setFields((current) => ({ ...current, [field]: value }));
      },
    };
  }

  async function load() {
    setData({ busy: true });
    try {
      const [citas, tratamientos] = await Promise.all([request("/citas"), request("/tratamientos")]);
      setData({ citas, tratamientos });
    } catch (error) {
      setData({ error: error.message });
    }
  }

  async function create() {
    if (creation?.busy) return;
    setCreation({ busy: true });
    try {
      const cita = await request("/citas", {
        method: "POST",
        body: {
          id_paciente: parseInt(fields.idPaciente, 10),
          id_odontologo: parseInt(fields.idOdontologo, 10),
          id_consultorio: parseInt(fields.idConsultorio, 10),
          fecha: fields.fecha, hora: fields.hora + ":00", estado: fields.estado,
          motivo_consulta: "Prueba de asociación", observaciones: null,
        },
      });
      if (!cita?.id_cita) throw new Error("No se pudo obtener el ID de la cita creada");
      const tratamiento = await request("/tratamientos/" + parseInt(fields.idTratamiento, 10), {
        method: "PUT", body: { id_cita: cita.id_cita },
      }).catch((error) => { throw new Error("Error al asociar tratamiento: " + error.message); });
      setCreation({ cita, tratamiento });
    } catch (error) {
      setCreation({ error: error.message });
    }
  }
  return (
    <>
      {"\n    "}
      <div className={"container"}>
        {"\n        "}
        <h1>{"🧪 Prueba Tratamiento ↔ Cita"}</h1>
        {"\n        "}
        <p>{"Esta página prueba la relación entre tratamientos y citas."}</p>
        {"\n\n        "}
        <hr />
        {"\n\n        "}
        <h3>{"📋 Datos Actuales"}</h3>
        {"\n        "}
        <button onClick={load}>{"Ver todos los datos"}</button>
        {"\n        "}
        <div id={"resultadoDatos"} className={"resultado"}>
          <Result value={data} placeholder="Haz clic en el botón para ver los datos" pending="⏳ Cargando...">
            {({ citas, tratamientos }) => <>
              <h4>📋 Citas ({citas.length})</h4><Json value={citas} />
              <h4>📋 Tratamientos ({tratamientos.length})</h4><Json value={tratamientos} />
              <p><strong>Relación:</strong> Un tratamiento tiene <code>id_cita</code> que referencia a una cita.</p>
            </>}
          </Result>
        </div>
        {"\n\n        "}
        <hr />
        {"\n\n        "}
        <h3>{"📝 Crear Cita y Asociar Tratamiento"}</h3>
        {"\n        "}
        <div className={"row-2"}>
          {"\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"ID Paciente:"}</label>
            {"\n                "}
            <input type={"number"} id={"idPaciente"} {...bind("idPaciente")} />
            {"\n            "}
          </div>
          {"\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"ID Odontólogo:"}</label>
            {"\n                "}
            <input type={"number"} id={"idOdontologo"} {...bind("idOdontologo")} />
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n        "}
        <div className={"row-2"}>
          {"\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"ID Tratamiento:"}</label>
            {"\n                "}
            <input type={"number"} id={"idTratamiento"} {...bind("idTratamiento")} />
            {"\n            "}
          </div>
          {"\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"ID Consultorio:"}</label>
            {"\n                "}
            <input type={"number"} id={"idConsultorio"} {...bind("idConsultorio")} />
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n        "}
        <div className={"row-2"}>
          {"\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"Fecha:"}</label>
            {"\n                "}
            <input type={"date"} id={"fecha"} {...bind("fecha")} />
            {"\n            "}
          </div>
          {"\n            "}
          <div className={"form-group"}>
            {"\n                "}
            <label>{"Hora:"}</label>
            {"\n                "}
            <input type={"time"} id={"hora"} {...bind("hora")} />
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n        "}
        <div className={"form-group"}>
          {"\n            "}
          <label>{"Estado:"}</label>
          {"\n            "}
          <select id="estado" {...bind("estado")}>
            {"\n                "}
            <option value={"En Espera"}>{"En Espera"}</option>
            {"\n                "}
            <option value={"En Consulta"}>{"En Consulta"}</option>
            {"\n                "}
            <option value={"Finalizado"}>{"Finalizado"}</option>
            {"\n                "}
            <option value={"Cancelado"}>{"Cancelado"}</option>
            {"\n            "}
          </select>
          {"\n        "}
        </div>
        {"\n\n        "}
        <button className={"btn-success"} onClick={create}>{"✅ Crear Cita y Asociar Tratamiento"}</button>
        {"\n\n        "}
        <div id={"resultadoCrear"} className={"resultado"}>
          <Result value={creation} placeholder="Completa los campos y haz clic en el botón" pending="⏳ Procesando...">
            {({ cita, tratamiento }) => <>
              <div className="exito">✅ ¡Cita creada y tratamiento asociado exitosamente!</div>
              <h4>Cita creada:</h4><Json value={cita} />
              <h4>Tratamiento actualizado:</h4><Json value={tratamiento} />
              <p><strong>Verifica:</strong> El tratamiento ahora tiene <code>id_cita = {cita.id_cita}</code></p>
            </>}
          </Result>
        </div>
        {"\n    "}
      </div>
      {"\n\n    "}
    </>
  );
}

