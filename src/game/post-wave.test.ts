import { describe, expect, it } from 'vitest';
import { buildPostWaveView } from './post-wave';
import { RunProgression } from './run-progression';
import type { WaveRating } from './wave-rating';

describe('buildPostWaveView', () => {
  it('returns supplied display data without mutating progression when called repeatedly', () => {
    const progression = new RunProgression({ points: 5 });
    const rating: WaveRating = {
      score: 40,
      accuracy: 20,
      survival: 30,
      total: 90,
      bonusPoint: true,
    };
    const award = { base: 1, bonus: 1, total: 2 } as const;

    const expected = {
      rating,
      award,
      balance: 5,
    };

    expect(buildPostWaveView(rating, award, 5)).toEqual(expected);
    expect(buildPostWaveView(rating, award, 5)).toEqual(expected);
    expect(progression.points).toBe(5);
  });

  it('preserves a supplied base-only award and balance', () => {
    const rating: WaveRating = {
      score: 30,
      accuracy: 20,
      survival: 20,
      total: 70,
      bonusPoint: false,
    };

    expect(buildPostWaveView(rating, { base: 1, bonus: 0, total: 1 }, 7)).toEqual({
      rating,
      award: { base: 1, bonus: 0, total: 1 },
      balance: 7,
    });
  });
});
