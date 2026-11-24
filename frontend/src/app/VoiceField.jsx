import { useEffect, useRef, useState } from "react";
import { request } from "./api.js";

const errors = {
  NotAllowedError: "Permite el acceso al micrófono en el navegador y en Windows.",
  NotFoundError: "Conecta un micrófono para usar el dictado.",
  NotReadableError: "El micrófono no está disponible. Revisa si otra aplicación lo está usando.",
};
let activeCapture = null;

function wav(chunks, sampleRate) {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const header = new DataView(new ArrayBuffer(44));
  for (const [offset, tag] of [[0, "RIFF"], [8, "WAVEfmt "], [36, "data"]]) {
    for (let i = 0; i < tag.length; i++) header.setUint8(offset + i, tag.charCodeAt(i));
  }
  header.setUint32(4, 36 + byteLength, true);
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  header.setUint32(40, byteLength, true);
  return new Blob([header.buffer, ...chunks], { type: "audio/wav" });
}

function release(capture) {
  clearTimeout(capture.timer);
  capture.stream?.getTracks().forEach((track) => track.stop());
  capture.source?.disconnect();
  capture.processor?.disconnect();
  capture.processor?.port.close();
  if (capture.context && capture.context.state !== "closed") {
    capture.context.close().catch(() => {});
  }
  capture.stream = capture.source = capture.processor = capture.context = null;
  if (activeCapture === capture) activeCapture = null;
}

export function VoiceField({ as: Field = "input", value, onValue, disabled, ...properties }) {
  const input = useRef(null);
  const session = useRef(null);
  const currentField = useRef({ value, onValue });
  currentField.current = { value, onValue };
  const [phase, setPhase] = useState("idle");
  const [notice, setNotice] = useState("");

  useEffect(() => () => {
    const capture = session.current;
    session.current = null;
    if (capture) {
      capture.abort.abort();
      release(capture);
    }
  }, []);

  async function stop(capture) {
    if (session.current !== capture || capture.stopping) return;
    capture.stopping = true;
    setPhase("processing");
    setNotice("Transcribiendo en español…");
    try {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 350);
        capture.flush = () => {
          clearTimeout(timeout);
          resolve();
        };
        capture.processor.port.postMessage("detener");
      });
      if (capture.abort.signal.aborted) return;
      const audio = wav(capture.chunks, capture.context.sampleRate);
      release(capture);
      capture.chunks.length = 0;
      const { texto } = await request("/dictado/transcribir", {
        method: "POST", body: audio, signal: capture.abort.signal,
      });
      if (session.current !== capture) return;
      if (texto) {
        const field = currentField.current;
        field.onValue([field.value.trimEnd(), texto].filter(Boolean).join(" "));
        input.current?.focus();
      }
      setNotice(texto ? "Dictado añadido." : "No se detectaron palabras. Intenta de nuevo.");
    } catch (error) {
      if (session.current === capture) setNotice(error.message || "No se pudo transcribir el dictado.");
    } finally {
      release(capture);
      if (session.current === capture) {
        session.current = null;
        setPhase("idle");
      }
    }
  }

  async function toggle() {
    if (session.current) return stop(session.current);
    if (activeCapture) return setNotice("Detén el micrófono del otro campo para dictar aquí.");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      return setNotice("Abre OdontoSoft desde el icono de escritorio o en un navegador compatible por HTTPS.");
    }
    const capture = { chunks: [], abort: new AbortController() };
    session.current = activeCapture = capture;
    setPhase("opening");
    setNotice("");
    try {
      capture.context = new AudioContext({ sampleRate: 16000 });
      await capture.context.resume();
      if (capture.abort.signal.aborted) return;
      capture.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      if (capture.abort.signal.aborted) return release(capture);
      if (!capture.context.audioWorklet) throw new Error("El navegador no admite el dictado local.");
      await capture.context.audioWorklet.addModule("/assets/dictado-audio.js");
      if (capture.abort.signal.aborted) return;
      capture.processor = new AudioWorkletNode(capture.context, "dictado-odontosoft");
      capture.processor.port.onmessage = ({ data }) => {
        if (data === "detenido") capture.flush?.();
        else capture.chunks.push(data);
      };
      capture.source = capture.context.createMediaStreamSource(capture.stream);
      capture.source.connect(capture.processor);
      capture.processor.connect(capture.context.destination);
      capture.timer = setTimeout(() => stop(capture), 59_000);
      setPhase("recording");
      setNotice("Grabando. Pulsa el micrófono para transcribir.");
    } catch (error) {
      release(capture);
      if (session.current === capture) {
        session.current = null;
        setPhase("idle");
        setNotice(errors[error.name] || error.message || "No se pudo iniciar el micrófono.");
      }
    }
  }

  const control = <Field {...properties} disabled={disabled} ref={input} value={value} onChange={(event) => onValue(event.target.value)} />;
  if (disabled || properties.readOnly) return control;
  const recording = phase === "recording";
  const label = recording ? "Detener y transcribir" : "Dictar por voz";
  return (
    <div className="voice-field">
      {control}
      <button type="button" className={"voice-button" + (recording ? " recording" : "")}
        title={label} aria-label={label} aria-pressed={recording}
        disabled={phase === "opening" || phase === "processing"} onClick={toggle}>
        <span className="material-symbols-outlined" aria-hidden="true">{recording ? "mic_off" : "mic"}</span>
      </button>
      {notice && <small className="voice-notice" role="status">{notice}</small>}
    </div>
  );
}
