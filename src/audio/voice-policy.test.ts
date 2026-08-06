import { expect, it } from 'vitest';
import { VoicePolicy } from './voice-policy';
import type { AudioCueSpec } from './manifest';

const cue: AudioCueSpec = {
  variants: ['/a', '/b', '/c'], bus: 'sfx', gain: 0.8, pitch: [0.9, 1.1],
  cooldownMs: 100, concurrency: 2, priority: 1, loop: false,
};

it('selects bounded deterministic variation', () => {
  const values = [0.8, 0, 1];
  const policy = new VoicePolicy(32, () => 0, () => values.shift() ?? 0);
  const decision = policy.request('fire', cue)!;
  expect(decision).toMatchObject({ variant: 2, pitch: 0.9 });
  expect(decision.gain).toBeCloseTo(0.88);
});

it('suppresses a cue during its cooldown', () => {
  let now = 0;
  const policy = new VoicePolicy(32, () => now, () => 0);
  expect(policy.request('fire', cue)).not.toBeNull();
  now = 99;
  expect(policy.request('fire', cue)).toBeNull();
  now = 100;
  expect(policy.request('fire', cue)).not.toBeNull();
});

it('replaces the oldest cosmetic voice at cue capacity', () => {
  let now = 0;
  const policy = new VoicePolicy(32, () => now, () => 0);
  policy.start('old', 'fire', 1, false); now = 1;
  policy.start('new', 'fire', 1, false); now = 100;

  expect(policy.request('fire', cue)?.replaceId).toBe('old');
});

it('does not displace critical feedback with cosmetic voices', () => {
  let now = 0;
  const policy = new VoicePolicy(1, () => now, () => 0);
  policy.start('critical', 'player-damaged', 10, true); now = 100;

  expect(policy.request('fire', cue)).toBeNull();
  policy.end('critical');
  expect(policy.request('fire', cue)).not.toBeNull();
});
