class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 960; // 20 ms at 48 kHz
    this.pending = new Int16Array(this.chunkSize);
    this.offset = 0;
    this.muted = false;
    this.port.onmessage = (event) => {
      if (event.data?.type === 'mute') this.muted = Boolean(event.data.value);
    };
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (output) output.fill(0);
    if (!input || this.muted) return true;

    for (let i = 0; i < input.length; i++) {
      const value = Math.max(-1, Math.min(1, input[i]));
      this.pending[this.offset++] = value < 0 ? value * 32768 : value * 32767;
      if (this.offset === this.chunkSize) {
        const chunk = this.pending;
        this.port.postMessage(chunk.buffer, [chunk.buffer]);
        this.pending = new Int16Array(this.chunkSize);
        this.offset = 0;
      }
    }
    return true;
  }
}

class StreamPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.current = null;
    this.offset = 0;
    this.started = false;
    this.targetChunks = 3;
    this.port.onmessage = (event) => {
      if (event.data?.type === 'clear') {
        this.queue = [];
        this.current = null;
        this.offset = 0;
        this.started = false;
        return;
      }
      if (event.data instanceof ArrayBuffer) {
        this.queue.push(new Int16Array(event.data));
        if (!this.started && this.queue.length >= this.targetChunks) this.started = true;
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0]?.[0];
    if (!output) return true;
    output.fill(0);
    if (!this.started) return true;

    for (let i = 0; i < output.length; i++) {
      if (!this.current || this.offset >= this.current.length) {
        this.current = this.queue.shift() || null;
        this.offset = 0;
        if (!this.current) {
          this.started = false;
          break;
        }
      }
      output[i] = this.current[this.offset++] / 32768;
    }
    return true;
  }
}

registerProcessor('mic-capture', MicCaptureProcessor);
registerProcessor('stream-player', StreamPlayerProcessor);
