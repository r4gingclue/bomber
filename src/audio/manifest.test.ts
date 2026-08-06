import { describe, expect, it } from 'vitest';
import { validateAudioManifest, type AudioManifest } from './manifest';

const cue = (url: string) => ({
  variants: [url], bus: 'sfx' as const, gain: 0.8, pitch: [0.95, 1.05] as [number, number],
  cooldownMs: 20, concurrency: 3, priority: 1, loop: false, fallback: 'fire' as const,
});

it('accepts explicit fallbacks for every required event', () => {
  const cues = Object.fromEntries([
    'cannon-fire', 'player-missile-launch', 'enemy-sam-launch', 'depth-charge-drop',
    'water-entry', 'underwater-explosion', 'aircraft-explosion', 'armor-hit',
    'player-damaged', 'sonar-ping', 'ui-confirm', 'upgrade-selected', 'wave-start',
    'wave-clear', 'game-over',
  ].map(name => [name, cue(`/audio/${name}.ogg`)]));
  expect(() => validateAudioManifest({ cues, music: {} } as AudioManifest)).not.toThrow();
});

describe('validateAudioManifest', () => {
  it('rejects missing event coverage', () => {
    expect(() => validateAudioManifest({ cues: {}, music: {} })).toThrow('missing cue: cannon-fire');
  });

  it('rejects duplicate URLs and invalid playback metadata', () => {
    const invalid = cue('/audio/shared.ogg');
    invalid.gain = -1;
    expect(() => validateAudioManifest({
      cues: { 'cannon-fire': invalid, 'player-missile-launch': cue('/audio/shared.ogg') },
      music: {},
    })).toThrow();
  });
});
