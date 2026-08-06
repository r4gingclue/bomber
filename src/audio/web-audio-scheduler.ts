import type { MusicLane, MusicScheduler } from './music-director';

export class WebAudioMusicScheduler implements MusicScheduler {
  constructor(private readonly context: AudioContext, private readonly destination: GainNode) {}
  now(): number { return this.context.currentTime; }
  startLoop(_name: string, buffer: AudioBuffer, at: number, loopDuration: number): MusicLane {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopEnd = loopDuration;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.destination);
    source.start(at);
    return {
      ramp: (value, rampAt, duration) => {
        gain.gain.cancelScheduledValues(rampAt);
        gain.gain.setValueAtTime(gain.gain.value, rampAt);
        gain.gain.linearRampToValueAtTime(value, rampAt + duration);
      },
      stop: () => {
        try { source.stop(); } catch { /* source already stopped */ }
      },
    };
  }
  playStinger(): void {}
}
