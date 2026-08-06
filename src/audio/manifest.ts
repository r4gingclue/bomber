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
  musicFamily?: MusicFamilyMetadata;
}

export interface MusicFamilyMetadata {
  bpm: number;
  beatsPerBar: number;
  bars: number;
  loopDuration: number;
  stems: string[];
}

const cue = (
  variants: string[],
  fallback: ProceduralAudioKind,
  options: Partial<AudioCueSpec> = {},
): AudioCueSpec => ({
  variants,
  bus: 'sfx',
  gain: 0.7,
  pitch: [0.96, 1.04],
  cooldownMs: 40,
  concurrency: 4,
  priority: 2,
  loop: false,
  fallback,
  ...options,
});

const music = (name: string, gain: number): AudioCueSpec => ({
  variants: [`assets/audio/music/${name}.ogg`],
  bus: 'music',
  gain,
  pitch: [1, 1],
  cooldownMs: 0,
  concurrency: 1,
  priority: 1,
  loop: true,
});

const ambience = (name: string, gain: number): AudioCueSpec => ({
  ...music(name, gain),
  variants: [`assets/audio/ambience/${name}.ogg`],
});

export const AUDIO_MANIFEST: AudioManifest = {
  cues: {
    'cannon-fire': cue(['assets/audio/sfx/cannon-1.ogg', 'assets/audio/sfx/cannon-2.ogg', 'assets/audio/sfx/cannon-3.ogg'], 'fire', { cooldownMs: 55, concurrency: 5 }),
    'player-missile-launch': cue(['assets/audio/sfx/player-missile-1.ogg', 'assets/audio/sfx/player-missile-2.ogg'], 'fire', { gain: 0.8 }),
    'enemy-sam-launch': cue(['assets/audio/sfx/enemy-sam-1.ogg', 'assets/audio/sfx/enemy-sam-2.ogg'], 'fire', { gain: 0.72 }),
    'depth-charge-drop': cue(['assets/audio/sfx/charge-drop-1.ogg', 'assets/audio/sfx/charge-drop-2.ogg'], 'drop', { gain: 0.55 }),
    'water-entry': cue(['assets/audio/sfx/water-entry.ogg'], 'splash', { gain: 0.6 }),
    'underwater-explosion': cue(['assets/audio/sfx/underwater-explosion-1.ogg', 'assets/audio/sfx/underwater-explosion-2.ogg', 'assets/audio/sfx/underwater-explosion-3.ogg'], 'boom', { gain: 0.9, concurrency: 3, priority: 4 }),
    'aircraft-explosion': cue(['assets/audio/sfx/aircraft-explosion-1.ogg', 'assets/audio/sfx/aircraft-explosion-2.ogg', 'assets/audio/sfx/aircraft-explosion-3.ogg'], 'boom', { gain: 0.85, concurrency: 3, priority: 4 }),
    'armor-hit': cue(['assets/audio/sfx/armor-hit-1.ogg', 'assets/audio/sfx/armor-hit-2.ogg'], 'hit', { gain: 0.55 }),
    'player-damaged': cue(['assets/audio/sfx/player-damaged-1.ogg', 'assets/audio/sfx/player-damaged-2.ogg'], 'hit', { gain: 0.8, priority: 6 }),
    'sonar-ping': cue(['assets/audio/sfx/sonar-ping.ogg'], 'ping', { gain: 0.65, cooldownMs: 250, concurrency: 1, priority: 6 }),
    'ui-confirm': cue(['assets/audio/sfx/ui-confirm.ogg'], 'ui', { gain: 0.45 }),
    'upgrade-selected': cue(['assets/audio/sfx/upgrade-selected.ogg'], 'ui', { gain: 0.55 }),
    'wave-start': cue(['assets/audio/sfx/wave-start.ogg'], 'ui', { gain: 0.6 }),
    'wave-clear': cue(['assets/audio/sfx/wave-clear.ogg'], 'ui', { gain: 0.7, priority: 5 }),
    'game-over': cue(['assets/audio/sfx/game-over.ogg'], 'die', { gain: 0.75, priority: 7 }),
  },
  music: {
    menu: music('menu', 0.65),
    intro: music('intro', 0.7),
    bed: music('bed', 0.8),
    tension: music('tension', 0.75),
    action: music('action', 0.8),
    danger: music('danger', 0.65),
    'combat-fallback': music('combat-fallback', 0.7),
    rotor: ambience('rotor', 0.18),
    'ocean-wind': ambience('ocean-wind', 0.12),
  },
  musicFamily: {
    bpm: 128,
    beatsPerBar: 4,
    bars: 32,
    loopDuration: 60,
    stems: ['bed', 'tension', 'action', 'danger'],
  },
};

export function validateAudioManifest(manifest: AudioManifest): void {
  if (manifest.musicFamily) {
    const expectedDuration = manifest.musicFamily.bars * manifest.musicFamily.beatsPerBar * 60 / manifest.musicFamily.bpm;
    if (Math.abs(expectedDuration - manifest.musicFamily.loopDuration) > 0.001) {
      throw new Error('Audio manifest music loop duration does not match its bar metadata');
    }
    for (const stem of manifest.musicFamily.stems) {
      if (!manifest.music[stem]) throw new Error(`Audio manifest missing music stem: ${stem}`);
    }
  }
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
