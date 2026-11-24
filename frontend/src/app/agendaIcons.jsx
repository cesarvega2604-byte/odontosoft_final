const iconos={
  calendario:'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M7 18h2',
  persona:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  pacientes:'M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 21v-2a7 7 0 0 1 14 0v2M18 4a3 3 0 0 1 0 6M21 20v-2a5 5 0 0 0-3-4M6 4a3 3 0 0 0 0 6M3 20v-2a5 5 0 0 1 3-4',
  diente:'M12 5C8 2 3 4 4 9c1 4 1 10 4 12 2 1 2-7 4-7s2 8 4 7c3-2 3-8 4-12 1-5-4-7-8-4Z',
  ficha:'M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h8',
  salud:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
  buscar:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM15 15l6 6',
  salir:'M9 3H4v18h5M10 12h11M16 7l5 5-5 5',
  correo:'M3 5h18v14H3ZM3 6l9 7 9-7',
  telefono:'M7 3H3c-1 9 9 19 18 18v-4l-5-2-2 3a16 16 0 0 1-8-8l3-2Z',
  tarjeta:'M3 5h18v14H3ZM7 10h3M7 14h3M14 10h4M14 14h4',
  actualizar:'M20 7a9 9 0 1 0 1 9M20 3v5h-5',
  inicio:'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  listo:'M21 11v1a9 9 0 1 1-5-8M8 11l4 4L21 4',
  reloj:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  agregar:'M12 4v16M4 12h16',
  guardar:'M4 3h14l3 3v15H3V3ZM7 3v6h10V3M7 21v-8h10v8',
  cerrar:'M5 5l14 14M19 5L5 19',
  soporte:'M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v6h4v-6ZM20 12h2v6h-4v-6ZM18 19l-3 2h-3',
 };
 const mapa={dentistry:'diente',group:'pacientes',groups:'pacientes',space_dashboard:'inicio',calendar_month:'calendario',event_available:'calendario',pending_actions:'reloj',task_alt:'listo',medical_services:'salud',search:'buscar',refresh:'actualizar',clinical_notes:'ficha',person_search:'persona',badge:'tarjeta',mail:'correo',call:'telefono',health_and_safety:'salud',logout:'salir',person:'persona',add:'agregar',close:'cerrar',save:'guardar',account_circle:'persona',medical_information:'ficha',support_agent:'soporte',manage_accounts:'persona',local_shipping:'tarjeta',stethoscope:'salud',check_circle:'listo',schedule:'reloj',filter_alt:'buscar',edit:'ficha',delete:'cerrar',warning:'salud',progress_activity:'actualizar'};

export function AgendaIcon({ name, style }) {
  const shape = iconos[mapa[name]];
  return <span className="material-symbols-outlined" style={style} aria-hidden={shape ? true : undefined}>
    {shape ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d={shape} /></svg> : name}
  </span>;
}
