import { useEffect, useRef, useState } from "react";
import { apiOrigin, request } from "./api.js";

const maxBytes = 15 * 1024 * 1024;
const images = new Set(["image/jpeg", "image/png", "image/webp"]);
const numberFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export function ClinicalAttachments({ patientId }) {
  const path = "/historias-clinicas-detalladas/paciente/" + patientId + "/adjuntos";
  const controller = useRef(null);
  const picker = useRef(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    request(path, { signal: abort.signal })
      .then(setItems)
      .catch((error) => {
        if (!abort.signal.aborted) setError(error.message);
      });
    return () => abort.abort();
  }, [path]);

  async function attach(event) {
    const files = Array.from(event.target.files);
    event.target.value = "";
    if (!files.length || uploading) return;
    const { signal } = controller.current;
    setUploading(true);
    setError("");
    setOutcome("");
    const failures = [];
    let saved = 0;
    try {
      for (const file of files) {
        if (signal.aborted) return;
        try {
          if (file.size > maxBytes) throw new Error("Supera el límite de 15 MB.");
          const item = await request(path, {
            method: "POST", body: file, signal,
            headers: { "X-Nombre-Archivo": encodeURIComponent(file.name) },
          });
          setItems((current) => [item, ...current]);
          saved++;
        } catch (error) {
          if (signal.aborted) return;
          failures.push(file.name + " · " + error.message);
        }
      }
      setOutcome(saved ? (saved === 1 ? "Archivo guardado." : saved + " archivos guardados.") : "");
      setError(failures.join("\n"));
    } finally {
      if (!signal.aborted) setUploading(false);
    }
  }

  return (
    <div className="clinical-attachments">
      <div className="clinical-attachments-head">
        <div>
          <h3>Radiografías, fotos y documentos</h3>
          <p id="formatosAdjuntos">JPG, PNG, WebP, TIFF, PDF y DICOM. Hasta 15 MB por archivo.</p>
        </div>
        <button type="button" className="clinical-button clinical-button-primary" aria-describedby="formatosAdjuntos"
          disabled={uploading || items === null} onClick={() => picker.current.click()}>
          <span className="material-symbols-outlined" aria-hidden="true">attach_file</span> Adjuntar archivos
        </button>
        <input ref={picker} type="file" hidden multiple accept=".jpg,.jpeg,.png,.webp,.tif,.tiff,.pdf,.dcm,.dicom"
          disabled={uploading || items === null} onChange={attach} />
      </div>
      {uploading && <p role="status">Guardando archivos…</p>}
      {outcome && <p role="status">{outcome}</p>}
      {error && <p className="clinical-attachments-error" role="alert">{error}</p>}
      {!items && !error && <p role="status">Cargando adjuntos…</p>}
      {items?.length === 0 && <p>Este expediente todavía no tiene archivos adjuntos.</p>}
      {!!items?.length && (
        <ul>
          {items.map((item) => {
            const url = apiOrigin + path + "/" + item.id;
            const size = item.tamano >= 1024 * 1024
              ? numberFormat.format(item.tamano / (1024 * 1024)) + " MB"
              : numberFormat.format(Math.max(0.1, item.tamano / 1024)) + " KB";
            return (
              <li key={item.id}>
                <div className="clinical-attachment-name">
                  <span className="material-symbols-outlined" aria-hidden="true">{images.has(item.tipo) ? "image" : "description"}</span>
                  <div><strong>{item.nombre}</strong><small>{size}</small></div>
                </div>
                <div className="clinical-attachments-actions">
                  {images.has(item.tipo) && <a className="clinical-button clinical-button-secondary"
                    href={url + "?vista=1"} target="_blank" rel="noopener noreferrer">Ver imagen</a>}
                  <a className="clinical-button clinical-button-secondary" href={url} download={item.nombre}>
                    <span className="material-symbols-outlined" aria-hidden="true">download</span> Descargar
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
