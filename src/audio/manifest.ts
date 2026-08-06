import { AUDIO_EVENTS, type AudioEvent, type ProceduralAudioKind } from '../core/audio-events';

export interface AudioCueSpec {
  variants: string[];
  bus: 'sfx' | 'music';
  gain: number;
  pitch: [number, number];
  cooldownMs: number;
  concurrency: number;
  priority: number;
  loop: boolean;
  fallback?: ProceduralAudioKind;
}

export interface AudioManifest {
  cues: Partial<Record<AudioEvent, AudioCueSpec>>;
  music: Record<string, AudioCueSpec>;
}

export function validateAudioManifest(manifest: AudioManifest): void {
  for (const event of AUDIO_EVENTS) {
    const cue = manifest.cues[event];
    if (!cue) throw new Error(`Audio manifest missing cue: ${event}`);
    if (cue.variants.length === 0 && !cue.fallback) throw new Error(`Audio cue has no source or fallback: ${event}`);
  }
  const urls = new Set<string>();
  for (const [name, cue] of [
    ...Object.entries(manifest.cues),
    ...Object.entries(manifest.music),
  ] as [string, AudioCueSpec][]) {
    if (cue.gain < 0 || cue.gain > 1 || cue.pitch[0] <= 0 || cue.pitch[1] < cue.pitch[0]
      || cue.cooldownMs < 0 || !Number.isInteger(cue.concurrency) || cue.concurrency < 1
      || !Number.isFinite(cue.priority)) {
      throw new Error(`Audio cue has invalid metadata: ${name}`);
    }
    for (const url of cue.variants) {
      if (urls.has(url)) throw new Error(`Audio manifest contains duplicate URL: ${url}`);
      urls.add(url);
    }
  }
}
