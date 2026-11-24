import { useEffect, useState } from "react";
import { CatalogoProductos } from "./Products.jsx";
import { Opiniones } from "./Survey.jsx";

export default function IndexPage() {
  const [active, setActive] = useState(0);
  const [restart, resetTimer] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setActive((slide) => (slide + 1) % 3), 5000);
    return () => clearInterval(interval);
  }, [restart]);
  function selectSlide(slide) {
    setActive((slide + 3) % 3);
    resetTimer((value) => value + 1);
  }
  return (
    <>
      {"\n    "}
      {"\n    "}
      <header className={"header"} id={"inicio"}>
        {"\n        "}
        <a className={"logo"} href={"#inicio"} aria-label={"Ir al inicio"}>
          {"\n            "}
          <span className={"material-symbols-outlined logo-icon"}>{"dentistry"}</span>
          {"\n            "}
          <h1>
            {"Odonto"}
            <span>{"Soft"}</span>
          </h1>
          {"\n        "}
        </a>
        {"\n\n        "}
        <nav className={"menu"} aria-label={"Navegación principal"}>
          {"\n            "}
          <a href={"#inicio"}>{"Inicio"}</a>
          {"\n            "}
          <a href={"#servicios"}>{"Servicios"}</a>
          <a href="#productos">Productos</a>
          <a href="#opiniones">Opiniones</a>
          {"\n            "}
          <a href={"#funciones"}>{"Funciones"}</a>
          {"\n            "}
          <a href={"#ubicacion"}>{"Ubicación"}</a>
          {"\n            "}
          <a href="/login" className={"menu-login"}>{"Iniciar Sesión"}</a>
          {"\n            "}
          <a href="/registro" className={"menu-register"}>{"Registrarse"}</a>
          {"\n        "}
        </nav>
        {"\n    "}
      </header>
      {"\n\n    "}
      {"\n    "}
      <section className={"hero"}>
        {"\n        "}
        <div className={"hero-overlay"} />
        {"\n\n        "}
        <div className={"hero-content"}>
          {"\n            "}
          <span className={"hero-badge"}>
            {"\n                "}
            <span className={"material-symbols-outlined"}>{"verified"}</span>
            {"\n                Gestión odontológica en un solo lugar\n            "}
          </span>
          {"\n\n            "}
          <h2>
            {"Cuida tus pacientes con "}
            <span>{"OdontoSoft"}</span>
          </h2>
          {"\n\n            "}
          <p>{"\n                Sistema de gestión odontológica para organizar pacientes, citas,\n                historias clínicas, tratamientos, odontogramas y procesos administrativos\n                de una forma sencilla y ordenada.\n            "}</p>
          {"\n\n            "}
          <div className={"hero-buttons"}>
            {"\n                "}
            <a href="/login" className={"btn"}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"login"}</span>
              {"\n                    Comenzar\n                "}
            </a>
            {"\n                "}
            <a href={"#funciones"} className={"btn btn-outline"}>{"\n                    Ver funcionalidades\n                "}</a>
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"hero-mini-info"}>
            {"\n                "}
            <span>
              <span className={"material-symbols-outlined"}>{"calendar_month"}</span>
              {" Citas"}
            </span>
            {"\n                "}
            <span>
              <span className={"material-symbols-outlined"}>{"person"}</span>
              {" Pacientes"}
            </span>
            {"\n                "}
            <span>
              <span className={"material-symbols-outlined"}>{"description"}</span>
              {" Historias clínicas"}
            </span>
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n    "}
      </section>
      {"\n\n\n    "}
      {"\n    "}
      <section className={"intro-odontosoft"}>
        {"\n        "}
        <div className={"intro-contenido"}>
          {"\n            "}
          <span className={"seccion-etiqueta"}>{"Bienvenido a OdontoSoft"}</span>
          {"\n            "}
          <h2>{"Tu clínica odontológica, más organizada"}</h2>
          {"\n            "}
          <p>{"\n                OdontoSoft es un sistema pensado para ayudar a organizar la información\n                de pacientes, citas y procesos de una clínica odontológica de manera sencilla.\n            "}</p>
          {"\n        "}
        </div>
        {"\n    "}
      </section>
      {"\n\n    "}
      {"\n    "}
      <CatalogoProductos />
      <section className={"seccion servicios-seccion"} id={"servicios"}>
        {"\n        "}
        <div className={"seccion-titulo"}>
          {"\n            "}
          <span className={"seccion-etiqueta"}>{"Nuestros servicios"}</span>
          {"\n            "}
          <h2>{"Soluciones para cuidar tu salud oral"}</h2>
          {"\n            "}
          <p>{"Conoce los servicios odontológicos que ofrece nuestra clínica para cuidar tu sonrisa y la de tu familia."}</p>
          {"\n        "}
        </div>
        {"\n\n        "}
        <div className={"servicios-grid"}>
          {"\n            "}
          <article className={"servicio-card"}>
            {"\n                "}
            <div className={"servicio-icon"}>
              <span className={"material-symbols-outlined"}>{"dentistry"}</span>
            </div>
            {"\n                "}
            <h3>{"Odontología general"}</h3>
            {"\n                "}
            <p>{"Evaluación, diagnóstico y tratamientos básicos para mantener una buena salud bucal."}</p>
            {"\n            "}
          </article>
          {"\n\n            "}
          <article className={"servicio-card"}>
            {"\n                "}
            <div className={"servicio-icon"}>
              <span className={"material-symbols-outlined"}>{"cleaning_services"}</span>
            </div>
            {"\n                "}
            <h3>{"Limpieza dental"}</h3>
            {"\n                "}
            <p>{"Eliminación de placa y sarro para proteger los dientes y mantener una sonrisa saludable."}</p>
            {"\n            "}
          </article>
          {"\n\n            "}
          <article className={"servicio-card"}>
            {"\n                "}
            <div className={"servicio-icon"}>
              <span className={"material-symbols-outlined"}>{"health_and_safety"}</span>
            </div>
            {"\n                "}
            <h3>{"Valoración odontológica"}</h3>
            {"\n                "}
            <p>{"Revisión completa de la salud oral y orientación sobre el tratamiento adecuado."}</p>
            {"\n            "}
          </article>
          {"\n\n            "}
          <article className={"servicio-card"}>
            {"\n                "}
            <div className={"servicio-icon"}>
              <span className={"material-symbols-outlined"}>{"grid_view"}</span>
            </div>
            {"\n                "}
            <h3>{"Ortodoncia"}</h3>
            {"\n                "}
            <p>{"Tratamientos para corregir la posición de los dientes y mejorar la mordida."}</p>
            {"\n            "}
          </article>
          {"\n\n            "}
          <article className={"servicio-card"}>
            {"\n                "}
            <div className={"servicio-icon"}>
              <span className={"material-symbols-outlined"}>{"auto_awesome"}</span>
            </div>
            {"\n                "}
            <h3>{"Blanqueamiento dental"}</h3>
            {"\n                "}
            <p>{"Procedimientos estéticos para mejorar el tono de los dientes y la apariencia de la sonrisa."}</p>
            {"\n            "}
          </article>
          {"\n\n            "}
          <article className={"servicio-card"}>
            {"\n                "}
            <div className={"servicio-icon"}>
              <span className={"material-symbols-outlined"}>{"sentiment_satisfied"}</span>
            </div>
            {"\n                "}
            <h3>{"Diseño de sonrisa"}</h3>
            {"\n                "}
            <p>{"Alternativas estéticas personalizadas para lograr una sonrisa armónica y natural."}</p>
            {"\n            "}
          </article>
          {"\n\n            "}
          <article className={"servicio-card"}>
            {"\n                "}
            <div className={"servicio-icon"}>
              <span className={"material-symbols-outlined"}>{"medical_services"}</span>
            </div>
            {"\n                "}
            <h3>{"Endodoncia"}</h3>
            {"\n                "}
            <p>{"Tratamiento de conductos para conservar piezas dentales afectadas y aliviar molestias."}</p>
            {"\n            "}
          </article>
          {"\n\n            "}
          <article className={"servicio-card"}>
            {"\n                "}
            <div className={"servicio-icon"}>
              <span className={"material-symbols-outlined"}>{"child_care"}</span>
            </div>
            {"\n                "}
            <h3>{"Odontopediatría"}</h3>
            {"\n                "}
            <p>{"Atención odontológica especializada para niños en un ambiente seguro y amigable."}</p>
            {"\n            "}
          </article>
          {"\n        "}
        </div>
        {"\n    "}
      </section>
      {"\n\n    "}
      {"\n    "}
      <Opiniones />
      <section className={"seccion carrusel-seccion"} id={"funciones"}>
        {"\n        "}
        <div className={"seccion-titulo"}>
          {"\n            "}
          <span className={"seccion-etiqueta"}>{"Funcionalidades"}</span>
          {"\n            "}
          <h2>{"Todo lo necesario para gestionar tu clínica"}</h2>
          {"\n            "}
          <p>{"Conoce las principales funcionalidades que ofrece OdontoSoft para organizar y facilitar el trabajo de la clínica."}</p>
          {"\n        "}
        </div>
        {"\n\n        "}
        <div className={"carousel"} aria-label={"Carrusel de OdontoSoft"}>
          {"\n            "}
          <button className={"carousel-btn prev"} onClick={() => selectSlide(active - 1)} type={"button"} aria-label={"Imagen anterior"}>
            {"\n                "}
            <span className={"material-symbols-outlined"}>{"chevron_left"}</span>
            {"\n            "}
          </button>
          {"\n\n            "}
          <div className={"carousel-track"}>
            {"\n                "}
            <article className={active === 0 ? "slide active" : "slide"}>
              {"\n                    "}
              <img src={"/assets/imagen_odonto.png"} alt={"Sistema OdontoSoft"} />
              {"\n                    "}
              <div className={"slide-info"}>
                {"\n                        "}
                <span>{"01"}</span>
                {"\n                        "}
                <div>
                  {"\n                            "}
                  <h3>{"Una gestión más organizada"}</h3>
                  {"\n                            "}
                  <p>{"Centraliza la información de la clínica y facilita el trabajo diario."}</p>
                  {"\n                        "}
                </div>
                {"\n                    "}
              </div>
              {"\n                "}
            </article>
            {"\n\n                "}
            <article className={active === 1 ? "slide active" : "slide"}>
              {"\n                    "}
              <img src={"https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=1400&q=85"} alt={"Atención odontológica"} />
              {"\n                    "}
              <div className={"slide-info"}>
                {"\n                        "}
                <span>{"02"}</span>
                {"\n                        "}
                <div>
                  {"\n                            "}
                  <h3>{"Atención enfocada en el paciente"}</h3>
                  {"\n                            "}
                  <p>{"Consulta información y registra los procesos de cada paciente de forma ordenada."}</p>
                  {"\n                        "}
                </div>
                {"\n                    "}
              </div>
              {"\n                "}
            </article>
            {"\n\n                "}
            <article className={active === 2 ? "slide active" : "slide"}>
              {"\n                    "}
              <img src={"https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1400&q=85"} alt={"Consultorio odontológico"} />
              {"\n                    "}
              <div className={"slide-info"}>
                {"\n                        "}
                <span>{"03"}</span>
                {"\n                        "}
                <div>
                  {"\n                            "}
                  <h3>{"Una clínica conectada"}</h3>
                  {"\n                            "}
                  <p>{"Integra agenda, historias, tratamientos, pagos y otros procesos del sistema."}</p>
                  {"\n                        "}
                </div>
                {"\n                    "}
              </div>
              {"\n                "}
            </article>
            {"\n            "}
          </div>
          {"\n\n            "}
          <button className={"carousel-btn next"} onClick={() => selectSlide(active + 1)} type={"button"} aria-label={"Siguiente imagen"}>
            {"\n                "}
            <span className={"material-symbols-outlined"}>{"chevron_right"}</span>
            {"\n            "}
          </button>
          {"\n\n            "}
          <div className={"carousel-dots"} aria-label={"Seleccionar imagen"}>
            {"\n                "}
            <button className={active === 0 ? "dot active" : "dot"} onClick={() => selectSlide(0)} type={"button"} aria-label={"Imagen 1"} />
            {"\n                "}
            <button className={active === 1 ? "dot active" : "dot"} onClick={() => selectSlide(1)} type={"button"} aria-label={"Imagen 2"} />
            {"\n                "}
            <button className={active === 2 ? "dot active" : "dot"} onClick={() => selectSlide(2)} type={"button"} aria-label={"Imagen 3"} />
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n    "}
      </section>
      {"\n\n\n    "}
      {"\n    "}
      <section className={"seccion grafica-seccion"}>
        {"\n        "}
        <div className={"grafica-contenedor"}>
          {"\n            "}
          <div className={"grafica-texto"}>
            {"\n                "}
            <span className={"seccion-etiqueta"}>{"El sistema"}</span>
            {"\n                "}
            <h2>{"OdontoSoft reúne las áreas principales de una clínica"}</h2>
            {"\n                "}
            <p>{"\n                    La gráfica representa cómo se organizan los módulos del proyecto\n                    por áreas de trabajo. No son estadísticas de pacientes, sino una\n                    vista visual de las funcionalidades disponibles.\n                "}</p>
            {"\n\n                "}
            <div className={"grafica-puntos"}>
              {"\n                    "}
              <div>
                <span className={"material-symbols-outlined"}>{"check_circle"}</span>
                {" Gestión clínica"}
              </div>
              {"\n                    "}
              <div>
                <span className={"material-symbols-outlined"}>{"check_circle"}</span>
                {" Agenda y atención"}
              </div>
              {"\n                    "}
              <div>
                <span className={"material-symbols-outlined"}>{"check_circle"}</span>
                {" Administración"}
              </div>
              {"\n                    "}
              <div>
                <span className={"material-symbols-outlined"}>{"check_circle"}</span>
                {" Seguridad y usuarios"}
              </div>
              {"\n                "}
            </div>
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"grafica-card"}>
            {"\n                "}
            <h3>{"Áreas del sistema"}</h3>
            {"\n\n                "}
            <div className={"bar-item"}>
              {"\n                    "}
              <div>
                <span>{"Gestión clínica"}</span>
                <strong>{"6 módulos"}</strong>
              </div>
              {"\n                    "}
              <div className={"bar"}>
                <span style={{ width: "86%" }} />
              </div>
              {"\n                "}
            </div>
            {"\n\n                "}
            <div className={"bar-item"}>
              {"\n                    "}
              <div>
                <span>{"Administración"}</span>
                <strong>{"6 módulos"}</strong>
              </div>
              {"\n                    "}
              <div className={"bar"}>
                <span style={{ width: "86%" }} />
              </div>
              {"\n                "}
            </div>
            {"\n\n                "}
            <div className={"bar-item"}>
              {"\n                    "}
              <div>
                <span>{"Agenda y seguimiento"}</span>
                <strong>{"3 módulos"}</strong>
              </div>
              {"\n                    "}
              <div className={"bar"}>
                <span style={{ width: "43%" }} />
              </div>
              {"\n                "}
            </div>
            {"\n\n                "}
            <div className={"bar-item"}>
              {"\n                    "}
              <div>
                <span>{"Seguridad y acceso"}</span>
                <strong>{"2 módulos"}</strong>
              </div>
              {"\n                    "}
              <div className={"bar"}>
                <span style={{ width: "29%" }} />
              </div>
              {"\n                "}
            </div>
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n    "}
      </section>
      {"\n\n    "}
      {"\n    "}
      <section className={"seccion ubicacion-seccion"} id={"ubicacion"}>
        {"\n        "}
        <div className={"seccion-titulo"}>
          {"\n            "}
          <span className={"seccion-etiqueta"}>{"Encuéntranos"}</span>
          {"\n            "}
          <h2>{"Ubicación"}</h2>
          {"\n            "}
          <p>{"Información de contacto y ubicación de OdontoSoft."}</p>
          {"\n        "}
        </div>
        {"\n\n        "}
        <div className={"ubicacion-grid"}>
          {"\n            "}
          <div className={"ubicacion-info"}>
            {"\n                "}
            <div className={"contacto-item"}>
              {"\n                    "}
              <div className={"contacto-icon"}>
                <span className={"material-symbols-outlined"}>{"location_on"}</span>
              </div>
              {"\n                    "}
              <div>
                {"\n                        "}
                <h3>{"Dirección"}</h3>
                {"\n                        "}
                <p>
                  {"Calle 45 #15-20"}
                  <br />
                  {"Bogotá, Colombia"}
                </p>
                {"\n                    "}
              </div>
              {"\n                "}
            </div>
            {"\n\n                "}
            <div className={"contacto-item"}>
              {"\n                    "}
              <div className={"contacto-icon"}>
                <span className={"material-symbols-outlined"}>{"phone"}</span>
              </div>
              {"\n                    "}
              <div>
                {"\n                        "}
                <h3>{"Teléfono"}</h3>
                {"\n                        "}
                <p>{"+57 320 123 4567"}</p>
                {"\n                    "}
              </div>
              {"\n                "}
            </div>
            {"\n\n                "}
            <div className={"contacto-item"}>
              {"\n                    "}
              <div className={"contacto-icon"}>
                <span className={"material-symbols-outlined"}>{"mail"}</span>
              </div>
              {"\n                    "}
              <div>
                {"\n                        "}
                <h3>{"Correo"}</h3>
                {"\n                        "}
                <p>{"contacto@odontosoft.com"}</p>
                {"\n                    "}
              </div>
              {"\n                "}
            </div>
            {"\n\n                "}
            <a className={"map-btn"} target={"_blank"} rel={"noopener"} href={"https://www.google.com/maps/search/?api=1&query=Calle+45+%2315-20,+Bogota,+Colombia"}>
              {"\n                    "}
              <span className={"material-symbols-outlined"}>{"map"}</span>
              {"\n                    Ver en Google Maps\n                "}
            </a>
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"mapa"}>
            {"\n                "}
            <iframe title={"Ubicación de OdontoSoft"} src={"https://www.google.com/maps?q=Calle%2045%20%2315-20%2C%20Bogota%2C%20Colombia&output=embed"} loading={"lazy"} referrerpolicy={"no-referrer-when-downgrade"}>{"\n                "}</iframe>
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n    "}
      </section>
      {"\n\n    "}
      {"\n    "}
      <footer className={"footer"}>
        {"\n        "}
        <div className={"footer-contenedor"}>
          {"\n            "}
          <div className={"footer-seccion"}>
            {"\n                "}
            <div className={"logo-footer"}>
              {"\n                    "}
              <span className={"material-symbols-outlined logo-icon-footer"}>{"dentistry"}</span>
              {"\n                    "}
              <h1>
                {"Odonto"}
                <span>{"Soft"}</span>
              </h1>
              {"\n                "}
            </div>
            {"\n                "}
            <p className={"footer-description"}>{"\n                    Sistema de gestión odontológica diseñado para facilitar la administración\n                    de pacientes, citas, historias clínicas, tratamientos y procesos de la clínica.\n                "}</p>
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"footer-seccion"}>
            {"\n                "}
            <h3>{"Accesos rápidos"}</h3>
            {"\n                "}
            <ul className={"footer-links"}>
              {"\n                    "}
              <li>
                <a href={"#inicio"}>{"Inicio"}</a>
              </li>
              {"\n                    "}
              <li>
                <a href={"#servicios"}>{"Servicios"}</a>
              </li>
              {"\n                    "}
              <li>
                <a href={"#funciones"}>{"Funcionalidades"}</a>
              </li>
              {"\n                    "}
              <li>
                <a href={"#ubicacion"}>{"Ubicación"}</a>
              </li>
              {"\n                "}
            </ul>
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"footer-seccion"}>
            {"\n                "}
            <h3>{"Contacto"}</h3>
            {"\n                "}
            <p>{"📍 Calle 45 #15-20, Bogotá, Colombia"}</p>
            {"\n                "}
            <p>{"📞 +57 320 123 4567"}</p>
            {"\n                "}
            <p>{"✉️ contacto@odontosoft.com"}</p>
            {"\n            "}
          </div>
          {"\n\n            "}
          <div className={"footer-seccion"}>
            {"\n                "}
            <h3>{"Información"}</h3>
            {"\n                "}
            <ul className={"footer-links"}>
              {"\n                    "}
              <li>
                <a href="/politica-privacidad">{"Política de privacidad"}</a>
              </li>
              {"\n                    "}
              <li>
                <a href="/uso-sistema">{"Uso del sistema"}</a>
              </li>
              {"\n                    "}
              <li>
                <a href="/proteccion-datos">{"Protección de datos"}</a>
              </li>
              {"\n                "}
            </ul>
            {"\n            "}
          </div>
          {"\n        "}
        </div>
        {"\n\n        "}
        <hr />
        {"\n\n        "}
        <p className={"copyright"}>
          {"\n            "}
          <span className={"material-symbols-outlined copyright-icon"}>{"dentistry"}</span>
          {"\n            "}
          <span className={"copyright-logo"}>
            {"Odonto"}
            <span className={"copyright-logo-soft"}>{"Soft"}</span>
          </span>
          {"\n            © 2026 | Todos los derechos reservados.\n        "}
        </p>
        {"\n    "}
      </footer>
      {"\n\n    "}
    </>
  );
}

