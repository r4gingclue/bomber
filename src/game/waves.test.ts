import { describe, it, expect } from 'vitest';
import { composeWave, waveBudget, COST, UNLOCK, type SpawnKind } from './waves';
import { mulberry32 } from '../core/rng';

describe('waveBudget', () => {
  it('scales with wave number', () => {
    expect(waveBudget(1)).toBe(12);
    expect(waveBudget(5)).toBeGreaterThan(waveBudget(4));
  });
});

describe('composeWave', () => {
  it('is deterministic for the same seed', () => {
    expect(composeWave(6, mulberry32(9))).toEqual(composeWave(6, mulberry32(9)));
  });
  it('never exceeds the budget', () => {
    for (let w = 1; w <= 10; w++) {
      const spent = composeWave(w, mulberry32(w))
        .reduce((sum, k) => sum + COST[k], 0);
      expect(spent).toBeLessThanOrEqual(waveBudget(w));
    }
  });
  it('only spawns unlocked kinds', () => {
    for (let w = 1; w <= 10; w++) {
      for (const k of composeWave(w, mulberry32(100 + w)) as SpawnKind[]) {
        expect(UNLOCK[k]).toBeLessThanOrEqual(w);
      }
    }
  });
  it('wave 1 is patrol subs only', () => {
    expect(new Set(composeWave(1, mulberry32(5)))).toEqual(new Set(['patrol']));
  });
  it('spawns at least one enemy every wave', () => {
    for (let w = 1; w <= 10; w++) {
      expect(composeWave(w, mulberry32(w)).length).toBeGreaterThan(0);
    }
  });
});
