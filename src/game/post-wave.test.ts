import { describe, expect, it } from 'vitest';
import { buildPostWaveView } from './post-wave';
import { RunProgression } from './run-progression';
import type { WaveRating } from './wave-rating';

describe('buildPostWaveView', () => {
  it('returns display-ready rating components, award, and resulting point balance', () => {
    const progression = new RunProgression({ points: 3 });
    const rating: WaveRating = {
      score: 40,
      accuracy: 20,
      survival: 30,
      total: 90,
      bonusPoint: true,
    };

    expect(buildPostWaveView(rating, progression)).toEqual({
      rating,
      award: { base: 1, bonus: 1, total: 2 },
      balance: 5,
    });
  });

  it('awards only the base point below the performance-bonus threshold', () => {
    const progression = new RunProgression();
    const rating: WaveRating = {
      score: 30,
      accuracy: 20,
      survival: 20,
      total: 70,
      bonusPoint: false,
    };

    expect(buildPostWaveView(rating, progression)).toMatchObject({
      award: { base: 1, bonus: 0, total: 1 },
      balance: 1,
    });
  });
});
