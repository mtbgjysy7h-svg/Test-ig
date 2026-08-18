const VOICE_RATE = 24000;
const PACKET_MS = 20;

class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // The AudioContext stays at the browser-friendly 48 kHz rate, but voice is
    // sent at 24 kHz. That cuts raw microphone bandwidth in half without
    // requiring a special AudioContext sample rate on Safari/iOS.
    this.downsampleFactor = Math.max(1, Math.round(sampleRate / VOICE_RATE));
    this.downsamplePhase = 0;
    this.chunkSize = Math.round(VOICE_RATE * PACKET_MS / 1000);
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
      if (this.downsamplePhase === 0) {
        const value = Math.max(-1, Math.min(1, input[i]));
        this.pending[this.offset++] = value < 0 ? value * 32768 : value * 32767;

        if (this.offset === this.chunkSize) {
          const chunk = this.pending;
          this.port.postMessage(chunk.buffer, [chunk.buffer]);
          this.pending = new Int16Array(this.chunkSize);
          this.offset = 0;
        }
      }

      this.downsamplePhase = (this.downsamplePhase + 1) % this.downsampleFactor;
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

    this.upsampleFactor = Math.max(1, Math.round(sampleRate / VOICE_RATE));
    this.repeatLeft = 0;
    this.lastSample = 0;

    // About 40 ms before starting. Keep at most ~60 ms waiting so a network
    // hiccup cannot turn into seconds of delayed speech.
    this.targetChunks = 2;
    this.maxQueuedChunks = 3;

    this.port.onmessage = (event) => {
      if (event.data?.type === 'clear') {
        this.queue = [];
        this.current = null;
        this.offset = 0;
        this.started = false;
        this.repeatLeft = 0;
        this.lastSample = 0;
        return;
      }

      if (event.data instanceof ArrayBuffer) {
        this.queue.push(new Int16Array(event.data));

        // Always favor fresh speech. Old queued audio is useless in a live call.
        while (this.queue.length > this.maxQueuedChunks) {
          this.queue.shift();
        }

        if (!this.started && this.queue.length >= this.targetChunks) {
          this.started = true;
        }
      }
    };
  }

  nextVoiceSample() {
    if (!this.current || this.offset >= this.current.length) {
      this.current = this.queue.shift() || null;
      this.offset = 0;
      if (!this.current) return null;
    }

    return this.current[this.offset++] / 32768;
  }

  process(_inputs, outputs) {
    const output = outputs[0]?.[0];
    if (!output) return true;
    output.fill(0);
    if (!this.started) return true;

    for (let i = 0; i < output.length; i++) {
      if (this.repeatLeft <= 0) {
        const next = this.nextVoiceSample();
        if (next === null) {
          this.started = false;
          this.repeatLeft = 0;
          break;
        }
        this.lastSample = next;
        this.repeatLeft = this.upsampleFactor;
      }

      output[i] = this.lastSample;
      this.repeatLeft -= 1;
    }

    return true;
  }
}

registerProcessor('mic-capture', MicCaptureProcessor);
registerProcessor('stream-player', StreamPlayerProcessor);
