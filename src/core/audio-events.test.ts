import { describe, expect, it } from 'vitest';
import { isAudioEvent, proceduralAudioKind } from './audio-events';

describe('isAudioEvent', () => {
  it.each([
    'cannon-fire',
    'player-missile-launch',
    'enemy-sam-launch',
    'depth-charge-drop',
    'water-entry',
    'underwater-explosion',
    'aircraft-explosion',
    'armor-hit',
    'player-damaged',
    'sonar-ping',
    'ui-confirm',
    'upgrade-selected',
    'wave-start',
    'wave-clear',
    'game-over',
  ])('accepts the specific %s event', event => {
    expect(isAudioEvent(event)).toBe(true);
  });

  it.each(['fire', 'boom', 'hit', 'splash', 'ping', 'drop', 'die', 'ui'])
    ('rejects legacy generic event %s', event => {
      expect(isAudioEvent(event)).toBe(false);
    });
});

it('preserves distinct procedural fallbacks for specific events', () => {
  expect(proceduralAudioKind('cannon-fire')).toBe('fire');
  expect(proceduralAudioKind('underwater-explosion')).toBe('boom');
  expect(proceduralAudioKind('player-damaged')).toBe('hit');
  expect(proceduralAudioKind('wave-clear')).toBe('ui');
});
