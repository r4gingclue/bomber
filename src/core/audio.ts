import { proceduralAudioKind, type AudioEvent } from './audio-events';
import {
  loadAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences,
  type StorageLike,
} from './audio-preferences';

export interface AudioBusControls {
  setMaster(value: number): void;
  setMusic(value: number): void;
  setSfx(value: number): void;
}

export class AudioSys {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicStep = 0;
  private nextNote = 0;
  private settings: AudioPreferences;

  constructor(
    private readonly storage: StorageLike | undefined = browserStorage(),
    private buses?: AudioBusControls,
  ) {
    this.settings = loadAudioPreferences(storage);
    this.applyLevels();
  }

  get muted(): boolean { return this.settings.muted; }
  get preferences(): Readonly<AudioPreferences> { return { ...this.settings }; }

  /** Call on first user gesture (browser autoplay policy). Idempotent. */
  resume(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.buses = this.nodeBusControls();
    this.applyLevels();
    this.nextNote = this.ctx.currentTime + 0.1;
    window.setInterval(() => this.schedule(), 30);
  }

  toggleMute(): void {
    this.settings = { ...this.settings, muted: !this.settings.muted };
    this.persistAndApply();
  }

  setMusicVolume(value: number): void {
    this.settings = { ...this.settings, music: clamp01(value) };
    this.persistAndApply();
  }

  setSfxVolume(value: number): void {
    this.settings = { ...this.settings, sfx: clamp01(value) };
    this.persistAndApply();
  }

  handle(event: AudioEvent): void {
    if (!this.ctx) return;
    const ev = proceduralAudioKind(event);
    switch (ev) {
      case 'boom': this.noise(0.5, 300, 0.5); break;
      case 'splash': this.noise(0.18, 1800, 0.15); break;
      case 'drop': this.blip(220, 0.05, 'square', 0.15); break;
      case 'fire': this.blip(660, 0.03, 'square', 0.08); break;
      case 'hit': this.blip(110, 0.2, 'sawtooth', 0.25); break;
      case 'ping': this.sweep(880, 1760, 0.3); break;
      case 'ui': this.blip(520, 0.05, 'sine', 0.12); break;
      case 'die': this.sweep(440, 55, 0.8); break;
    }
  }

  private env(gain: number, dur: number): GainNode {
    const g = this.ctx!.createGain();
    const t = this.ctx!.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(this.sfxBus!);
    return g;
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number): void {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(this.env(gain, dur));
    o.start();
    o.stop(this.ctx!.currentTime + dur);
  }

  private sweep(from: number, to: number, dur: number): void {
    const o = this.ctx!.createOscillator();
    o.type = 'sine';
    const t = this.ctx!.currentTime;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    o.connect(this.env(0.2, dur));
    o.start();
    o.stop(t + dur);
  }

  private noise(dur: number, cutoff: number, gain: number): void {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    src.connect(f);
    f.connect(this.env(gain, dur));
    src.start();
  }

  /** 120 BPM lookahead scheduler: bass + arp + rotor thump. */
  private schedule(): void {
    const ctx = this.ctx!;
    const SIXTEENTH = 60 / 120 / 4;
    const BASS = [55, 55, 65.4, 49];             // A1 A1 C2 G1 per bar
    const ARP = [220, 330, 440, 330, 220, 262, 392, 262];
    while (this.nextNote < ctx.currentTime + 0.12) {
      const t = this.nextNote;
      const s = this.musicStep;
      if (s % 4 === 0) this.note(BASS[(s / 4) % 4 | 0], t, SIXTEENTH * 3.5, 'square', 0.06);
      this.note(ARP[s % 8], t, SIXTEENTH * 0.9, 'triangle', 0.03);
      if (s % 2 === 0) this.thump(t);
      this.nextNote += SIXTEENTH;
      this.musicStep++;
    }
  }

  private note(freq: number, at: number, dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(this.musicBus!);
    o.start(at);
    o.stop(at + dur);
  }

  /** rotor thump: tiny low noise burst */
  private thump(at: number): void {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus!);
    src.start(at);
  }

  private persistAndApply(): void {
    saveAudioPreferences(this.storage, this.settings);
    this.applyLevels();
  }

  private applyLevels(): void {
    this.buses?.setMaster(this.settings.muted ? 0 : 1);
    this.buses?.setMusic(this.settings.music);
    this.buses?.setSfx(this.settings.sfx);
  }

  private nodeBusControls(): AudioBusControls {
    return {
      setMaster: value => this.ramp(this.master!, value * 0.35),
      setMusic: value => this.ramp(this.musicBus!, value),
      setSfx: value => this.ramp(this.sfxBus!, value),
    };
  }

  private ramp(node: GainNode, value: number): void {
    const now = this.ctx!.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setTargetAtTime(value, now, 0.015);
  }
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function browserStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
