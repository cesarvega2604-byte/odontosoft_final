const yesNo = ["Sí", "No"];
const status = ["Sin alteración", "Anormal"];

export const patientFields = [
  ["segundo_apellido", "Segundo apellido"],
  ["genero", "Sexo / género", ["Femenino", "Masculino", "Otro", "No especificado"]],
  ["estado_civil", "Estado civil", ["Soltero(a)", "Casado(a)", "Unión libre", "Separado(a)", "Divorciado(a)", "Viudo(a)"]],
  ["direccion", "Dirección de residencia", { maxLength: 200 }],
  ["ciudad", "Ciudad"],
  ["celular", "Celular", { type: "tel" }],
  ["correo_contacto", "Correo de contacto clínico", { type: "email" }],
  ["eps", "EPS / aseguradora", { maxLength: 100 }],
  ["tipo_afiliacion", "Tipo de afiliación", ["Contributivo", "Subsidiado", "Particular", "Otro"]],
  ["ocupacion", "Ocupación"],
  ["nivel_educativo", "Nivel de estudios", ["Primaria", "Secundaria", "Técnico", "Tecnológico", "Universitario", "Posgrado", "Otro"]],
  ["direccion_oficina", "Dirección de oficina"],
  ["telefono_oficina", "Teléfono de oficina", { type: "tel" }],
  ["nombre_acompanante", "Nombre del acompañante"],
  ["telefono_acompanante", "Teléfono del acompañante", { type: "tel" }],
  ["nombre_responsable", "Nombre del responsable"],
  ["telefono_responsable", "Teléfono del responsable", { type: "tel" }],
  ["remitido_por", "Remitido por"],
  ["atendido_por", "Atendido por"],
  ["contacto_emergencia", "Contacto de emergencia"],
  ["telefono_emergencia", "Teléfono de emergencia", { type: "tel" }],
];

export const consultationFields = [
  ["motivo_consulta", "Motivo de consulta", "note"],
  ["enfermedad_actual", "Enfermedad actual", "note"],
  ["tratamiento_medico_medicacion", "Tratamiento médico o medicación actual", "note"],
  ["alergias", "Alergias a medicamentos o sustancias", "note"],
];

export const historyChecks = [
  ["problemas_coagulacion", "Problemas de coagulación"],
  ["enfermedades_cardiacas", "Enfermedades cardíacas"],
  ["fiebre_reumatica", "Fiebre reumática"],
  ["enfermedades_respiratorias", "Enfermedades respiratorias"],
  ["convulsiones", "Convulsiones"],
  ["hipertension_arterial", "Hipertensión arterial"],
  ["prueba_vih", "Prueba de VIH realizada"],
  ["enfermedades_gastrointestinales", "Enfermedades gastrointestinales"],
  ["hepatitis", "Hepatitis"],
  ["enfermedades_venereas", "Infecciones de transmisión sexual"],
  ["diabetes", "Diabetes"],
  ["embarazo", "Embarazo", [...yesNo, "No aplica"]],
  ["drogas_sustancias", "Consumo de sustancias"],
  ["habitos_relevantes", "Otros hábitos relevantes"],
  ["otras_enfermedades", "Otras enfermedades"],
].map(([id, label, options = yesNo]) => [id, label, options]);

export const historyNotes = [
  ["antecedentes_patologicos", "Antecedentes patológicos", "note"],
  ["antecedentes_quirurgicos", "Antecedentes quirúrgicos", "note"],
  ["antecedentes_farmacologicos", "Antecedentes farmacológicos", "note"],
  ["toxicos_estilo_vida", "Hábitos y estilo de vida", "note"],
  ["gineco_obstetricos", "Antecedentes gineco-obstétricos", "note"],
  ["familia_cronicas_metabolicas", "Enfermedades crónicas y metabólicas en la familia", "note"],
  ["familia_oncologia_cardiopatias", "Antecedentes oncológicos y cardíacos en la familia", "note"],
  ["familia_salud_mental_genetica", "Antecedentes familiares genéticos o de salud mental", "note"],
  ["composicion_hogar", "Composición del hogar", "note"],
  ["genograma", "Genograma", "note"],
  ["redes_apoyo", "Redes de apoyo", "note"],
  ["apgar_familiar", "APGAR familiar"],
  ["condiciones_vivienda", "Condiciones de vivienda", "note"],
  ["factores_psicosociales", "Factores psicosociales", "note"],
  ["revision_sistemas", "Revisión por sistemas", "note"],
];

export const vitalFields = [
  ["temperatura", "Temperatura (°C)"],
  ["presion_arterial", "Presión arterial (mmHg)"],
  ["frecuencia_cardiaca", "Pulso (lpm)"],
  ["frecuencia_respiratoria", "Frecuencia respiratoria (rpm)"],
  ["saturacion_oxigeno", "Saturación de oxígeno (%)"],
  ["peso", "Peso (kg)"],
  ["talla", "Talla"],
  ["imc", "Índice de masa corporal"],
  ["perimetro_abdominal", "Perímetro abdominal (cm)"],
];

export const oralFields = [
  ...[
    ["atm_ruidos", "Articulación temporomandibular · ruidos"],
    ["atm_dolor", "Articulación temporomandibular · dolor"],
    ["atm_movimientos", "Articulación temporomandibular · movimientos"],
    ["tejidos_blandos", "Tejidos blandos"],
    ["examen_dental", "Estado dental"],
    ["oclusion", "Oclusión"],
    ["glandulas_salivales", "Glándulas salivales"],
    ["maxilares", "Maxilares"],
    ["senos_maxilares", "Senos maxilares"],
    ["musculos_masticadores", "Músculos masticadores"],
    ["funcion_oclusion", "Función de la oclusión"],
    ["mucosa_labios", "Mucosa de los labios"],
    ["mucosa_lengua", "Mucosa de la lengua"],
    ["mucosa_paladar", "Mucosa del paladar"],
    ["mucosa_piso_boca", "Mucosa del piso de boca"],
    ["mucosa_carrillos", "Mucosa de carrillos"],
  ].map(([id, label]) => [id, label, status]),
  ...[
    ["supernumerarios", "Dientes supernumerarios"],
    ["abrasion", "Abrasión"],
    ["manchas", "Manchas"],
    ["patologia_pulpar", "Patología pulpar"],
    ["placa_blanca", "Placa blanda"],
    ["placa_calcificada", "Placa calcificada"],
  ].map(([id, label]) => [id, label, yesNo]),
];

export const examinationNotes = [
  ["aspecto_general", "Aspecto general", "note"],
  ["cabeza_cuello", "Cabeza y cuello", "note"],
  ["hallazgos_tejidos_blandos", "Hallazgos en tejidos blandos", "note"],
  ["examen_neurologico", "Exploración neurológica", "note"],
  ["otros_hallazgos_dentales", "Otros hallazgos dentales", "note"],
  ["observaciones_dentales", "Observaciones dentales", "note"],
  ["observaciones_examen", "Observaciones del examen", "note"],
  ["radiografias", "Radiografías y piezas evaluadas", "note"],
  ["otros_examenes", "Otras pruebas realizadas", "note"],
  ["resultado_examenes", "Resultados de las pruebas", "note"],
  ["imagenes_anexas", "Notas sobre imágenes y archivos", "note"],
];

export const diagnosisFields = [
  ["diagnostico_definitivo", "Diagnóstico definitivo", "note"],
  ["impresion_diagnostica", "Impresión diagnóstica (CIE-10 / CIE-11)"],
  ["pronostico", "Pronóstico", ["Favorable", "Reservado", "Desfavorable", "Por definir"]],
  ["plan_tratamiento", "Plan de tratamiento", "note"],
  ["farmacoterapia", "Farmacoterapia", "note"],
  ["indicaciones", "Indicaciones al paciente", "note"],
  ["ordenes_medicas", "Órdenes de laboratorio, imágenes o procedimientos", "note"],
  ["interconsultas", "Interconsultas", "note"],
];

export const budgetFields = [
  ["presupuesto", "Servicios presupuestados", "note"],
  ["presupuesto_total", "Total estimado"],
];

export const consentFields = [
  ["consentimiento_nombre_paciente", "Nombre registrado en el consentimiento"],
  ["consentimiento_historia_numero", "Número de historia clínica"],
  ["consentimiento_nombre_odontologo", "Nombre del odontólogo"],
  ["consentimiento_cedula_odontologo", "Identificación del odontólogo"],
  ["consentimiento_direccion_odontologo", "Dirección del odontólogo"],
  ["consentimiento_telefono_odontologo", "Teléfono del odontólogo", { type: "tel" }],
  ["carta_aceptacion", "Constancia de aceptación del diagnóstico y del plan", "note"],
  ["consentimiento_explicacion", "Riesgos, beneficios, antecedentes y alternativas explicadas", "note"],
  ["consentimiento_declaracion", "Tratamiento autorizado y declaración de consentimiento", "note"],
  ["consentimiento_observaciones", "Observaciones del consentimiento", "note"],
  ["consentimientos", "Consentimientos adicionales", "note"],
];

export const paymentFields = [
  ["fecha", "Fecha"],
  ["abono", "Abono"],
  ["saldo", "Saldo"],
];

export const procedureFields = [
  ["fecha", "Fecha de atención"],
  ["hora", "Hora de atención"],
  ["diente_zona", "Diente, cavidad o zona"],
  ["procedimientos", "Procedimientos realizados", "note"],
  ["firma_odontologo", "Constancia del odontólogo", "note"],
  ["firma_paciente", "Constancia del paciente o responsable", "note"],
];

export const followupFields = [
  ["profesional", "Profesional responsable"],
  ["especialidad", "Especialidad"],
  ["registro_profesional", "Registro profesional"],
  ["fecha_hora", "Fecha y hora"],
  ["firma", "Constancia de firma"],
  ["hojas_evolucion", "Notas de evolución", "note"],
  ["notas_enfermeria", "Notas de enfermería", "note"],
  ["epicrisis", "Epicrisis / resumen de alta", "note"],
  ["anexos", "Observaciones de otros anexos", "note"],
];
