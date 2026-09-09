// Tiny WebAudio SFX engine — no external assets, everything is synthesized.
// Kept deliberately small; each sound is an oscillator with a gain envelope.

type SfxName = 'shoot' | 'explosion' | 'hit' | 'powerup' | 'gameover';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture (e.g. the Start button). */
  resume() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(name: SfxName) {
    if (this.muted || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'shoot':
        this.blip('square', 660, 420, 0.08, 0.12, t);
        break;
      case 'explosion':
        this.noise(0.28, 0.5, t);
        this.blip('sawtooth', 180, 60, 0.28, 0.2, t);
        break;
      case 'hit':
        this.blip('sawtooth', 300, 90, 0.25, 0.3, t);
        break;
      case 'powerup':
        this.blip('triangle', 520, 990, 0.18, 0.2, t);
        break;
      case 'gameover':
        this.blip('sawtooth', 440, 70, 0.9, 0.3, t);
        break;
    }
  }

  private blip(
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    gain: number,
    t: number,
  ) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, t: number) {
    if (!this.ctx || !this.master) return;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = this.ctx.createBufferSource();
    const env = this.ctx.createGain();
    src.buffer = buffer;
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(env).connect(this.master);
    src.start(t);
  }
}
