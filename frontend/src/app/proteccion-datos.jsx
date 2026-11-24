export default function ProteccionDatosPage() {
  return (
    <>
      {"\n    "}
      <div className={"contenedor"}>
        {"\n        "}
        <div className={"tarjeta"}>
          {"\n            "}
          <h1>{"Protección de Datos"}</h1>
          {"\n            "}
          <div className={"imagen-politica"}>
            {"\n                "}
            <img src={"/assets/proteccion_datos.png"} alt={"Protección de Datos"} />
            {"\n            "}
          </div>
          {"\n            "}
          <p>
            {"En "}
            <strong>{"OdontoSoft"}</strong>
            {" nos comprometemos a proteger la información personal y clínica de nuestros pacientes, garantizando un tratamiento seguro, confidencial y responsable de todos los datos registrados en la plataforma."}
          </p>
          {"\n            "}
          <p>{"El tratamiento de los datos personales se realiza conforme a lo establecido en la Ley 1581 de 2012 y demás normas colombianas relacionadas con la protección de datos personales y la confidencialidad de la información."}</p>
          {"\n            "}
          <p>{"Los datos recopilados, como información de identificación, contacto, historias clínicas, diagnósticos, tratamientos y citas, serán utilizados únicamente para la prestación de servicios odontológicos, la gestión administrativa y el mejoramiento de la atención brindada a los pacientes."}</p>
          {"\n            "}
          <p>{"OdontoSoft implementa medidas de seguridad técnicas y administrativas para proteger la información contra accesos no autorizados, pérdida, alteración, divulgación o uso indebido de los datos almacenados en el sistema."}</p>
          {"\n            "}
          <p>{"El acceso a la información está limitado exclusivamente al personal autorizado, quien deberá manejar los datos con total confidencialidad y únicamente para el cumplimiento de sus funciones dentro de la clínica odontológica."}</p>
          {"\n            "}
          <p>{"Los datos personales no serán comercializados, compartidos ni divulgados a terceros sin la autorización del titular, excepto cuando exista una obligación legal o una orden emitida por una autoridad competente."}</p>
          {"\n            "}
          <p>{"Los pacientes podrán ejercer sus derechos de conocer, actualizar, corregir, solicitar la eliminación de sus datos personales o revocar la autorización para su tratamiento, siempre que la legislación colombiana vigente lo permita."}</p>
          {"\n            "}
          <p>{"OdontoSoft realiza copias de seguridad y aplica mecanismos de respaldo de la información con el fin de garantizar la disponibilidad, integridad y recuperación de los datos en caso de incidentes técnicos."}</p>
          {"\n            "}
          <p>{"Al utilizar OdontoSoft, los usuarios aceptan el tratamiento de sus datos personales conforme a las finalidades descritas en esta política y a la normativa vigente sobre protección de datos en Colombia."}</p>
          {"\n            "}
          <a href="/">{"← Volver al inicio"}</a>
          {"\n        "}
        </div>
        {"\n    "}
      </div>
      {"\n"}
    </>
  );
}

