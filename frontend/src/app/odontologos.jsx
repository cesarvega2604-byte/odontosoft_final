export default function OdontologosPage() {
  return (
    <>
      {"\n\n"}
      <h1>{"Gestión de Odontólogos"}</h1>
      {"\n\n"}
      <button>{"Crear Odontólogo"}</button>
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
            <th>{"Especialidad"}</th>
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
            <td>{"Ana Gómez"}</td>
            {"\n"}
            <td>{"Ortodoncia"}</td>
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

