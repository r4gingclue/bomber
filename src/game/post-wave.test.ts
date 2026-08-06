import { describe, expect, it, vi } from 'vitest';
import { mulberry32 } from '../core/rng';
import { completeWave, createRun, buildPostWaveView } from './post-wave';
import { RunProgression } from './run-progression';
import { World } from './world';
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

describe('completeWave', () => {
  it('rates a strong clear and awards its two points exactly once', () => {
    const world = new World(mulberry32(1));
    const progression = new RunProgression();
    const awardWave = vi.spyOn(progression, 'awardWave');
    world.startWave();
    world.score = 100_000;
    world.drops = 1;
    world.hitDrops = 1;
    world.subs.length = 0;

    const first = completeWave(world, progression);
    const repeated = completeWave(world, progression);

    expect(first.rating.total).toBeGreaterThanOrEqual(75);
    expect(first.award).toEqual({ base: 1, bonus: 1, total: 2 });
    expect(first.balance).toBe(2);
    expect(repeated).toBe(first);
    expect(progression.points).toBe(2);
    expect(awardWave).toHaveBeenCalledOnce();
    expect(awardWave).toHaveBeenCalledWith(first.rating.total);
  });
});

it('creates independent world and progression state for every new run', () => {
  const first = createRun(mulberry32(1));
  first.progression.awardWave(100);
  first.progression.purchase('armor-1');

  const second = createRun(mulberry32(1));

  expect(second.world).not.toBe(first.world);
  expect(second.progression).not.toBe(first.progression);
  expect(second.progression.points).toBe(0);
  expect(second.progression.confirmed.size).toBe(0);
  expect(second.progression.pending.size).toBe(0);
});
