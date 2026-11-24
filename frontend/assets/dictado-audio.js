class DictadoOdontoSoft extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(2048);
    this.length = 0;
    this.frames = 0;
    this.stopped = false;
    this.port.onmessage = ({ data }) => {
      if (data !== "detener") return;
      this.stopped = true;
      this.flush();
      this.port.postMessage("detenido");
    };
  }

  flush() {
    if (!this.length) return;
    const samples = this.buffer.slice(0, this.length);
    this.port.postMessage(samples.buffer, [samples.buffer]);
    this.length = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (this.stopped || !channel) return true;
    for (const sample of channel) {
      if (this.frames >= sampleRate * 60) break;
      const bounded = Math.max(-1, Math.min(1, sample));
      this.buffer[this.length++] = bounded < 0 ? bounded * 32768 : bounded * 32767;
      this.frames++;
      if (this.length === this.buffer.length) this.flush();
    }
    return true;
  }
}

registerProcessor("dictado-odontosoft", DictadoOdontoSoft);
