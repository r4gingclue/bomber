import type { MusicState } from './music-state';

export interface MusicLane {
  ramp(value: number, at: number, duration: number): void;
  stop(): void;
}

export interface MusicScheduler {
  now(): number;
  startLoop(name: string, buffer: AudioBuffer, at: number, loopDuration: number): MusicLane;
  playStinger(name: 'wave-clear' | 'game-over'): void;
}

export class MusicDirector {
  private readonly lanes = new Map<string, MusicLane>();

  constructor(private readonly scheduler: MusicScheduler) {}

  start(stems: Record<string, AudioBuffer | undefined>, loopDuration: number): void {
    if (this.lanes.size > 0) return;
    const at = this.scheduler.now() + 0.05;
    for (const [name, buffer] of Object.entries(stems)) {
      if (buffer) this.lanes.set(name, this.scheduler.startLoop(name, buffer, at, loopDuration));
    }
  }

  setState(state: MusicState): void {
    const at = this.scheduler.now();
    for (const [name, lane] of this.lanes) lane.ramp(targetGain(name, state), at, 2);
  }

  stinger(name: 'wave-clear' | 'game-over'): void {
    this.scheduler.playStinger(name);
  }

  stop(): void {
    for (const lane of this.lanes.values()) lane.stop();
    this.lanes.clear();
  }
}

export function nextBarBoundary(now: number, bpm: number, beatsPerBar: number): number {
  const bar = (60 / bpm) * beatsPerBar;
  return Math.ceil(now / bar) * bar;
}

function targetGain(name: string, state: MusicState): number {
  if (state === 'silent') return 0;
  if (state === 'menu') return name === 'menu' ? 1 : 0;
  if (name === 'bed') return state === 'low-health' ? 0.8 : 1;
  if (name === 'tension') return state === 'combat-high' || state === 'low-health' ? 1 : 0;
  if (name === 'action') return state === 'combat-high' ? 1 : state === 'low-health' ? 0.8 : 0;
  if (name === 'danger') return state === 'low-health' ? 1 : 0;
  return 0;
}
