import { describe, expect, it } from 'vitest';
import { rateWave } from './wave-rating';

describe('rateWave', () => {
  it('weights score, accuracy, and damage avoided into 100 points', () => {
    expect(rateWave({ scoreEarned: 500, scoreTarget: 500, drops: 4, hitDrops: 3, hpStart: 100, hpEnd: 90, maxHpStart: 100 })).toEqual({
      score: 40, accuracy: 23, survival: 27, total: 90, bonusPoint: true,
    });
  });

  it('awards the bonus at 75 but not 74', () => {
    expect(rateWave({ scoreEarned: 300, scoreTarget: 400, drops: 2, hitDrops: 1, hpStart: 100, hpEnd: 97, maxHpStart: 100 }).total).toBe(74);
    expect(rateWave({ scoreEarned: 300, scoreTarget: 400, drops: 2, hitDrops: 1, hpStart: 100, hpEnd: 100, maxHpStart: 100 }).bonusPoint).toBe(true);
  });

  it('clamps malformed counters and gives zero accuracy when valid targets existed but no charge was dropped', () => {
    expect(rateWave({ scoreEarned: 999, scoreTarget: 100, drops: 0, hitDrops: 9, hpStart: 100, hpEnd: 120, maxHpStart: 100, hadChargeTargets: true })).toEqual({
      score: 40, accuracy: 0, survival: 30, total: 70, bonusPoint: false,
    });
  });
});
