export default function PacientesPage() {
  return (
    <>
      {"\n\n"}
      <h1>{"Gestión de Pacientes"}</h1>
      {"\n\n"}
      <button>{"Crear Paciente"}</button>
      {"\n\n"}
      <table>
        {"\n\n"}
        <thead>
          {"\n"}
          <tr>
            {"\n"}
            <th>{"ID"}</th>
            {"\n"}
            <th>{"Nombre"}</th>
            {"\n"}
            <th>{"Correo"}</th>
            {"\n"}
            <th>{"Acciones"}</th>
            {"\n"}
          </tr>
          {"\n"}
        </thead>
        {"\n\n"}
        <tbody>
          {"\n\n"}
          <tr>
            {"\n"}
            <td>{"1"}</td>
            {"\n"}
            <td>{"Juan Pérez"}</td>
            {"\n"}
            <td>{"juan@gmail.com"}</td>
            {"\n\n"}
            <td>
              {"\n"}
              <button>{"Editar"}</button>
              {"\n"}
              <button>{"Eliminar"}</button>
              {"\n"}
            </td>
            {"\n\n"}
          </tr>
          {"\n\n"}
        </tbody>
        {"\n\n"}
      </table>
      {"\n\n"}
    </>
  );
}

