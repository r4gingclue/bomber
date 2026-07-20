import { describe, it, expect } from 'vitest';
import { composeWave, waveBudget, COST, UNLOCK, POOLS, AIR, GROUND, type SpawnKind } from './waves';
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

describe('biome pools', () => {
  it('sea pool preserves the exact v1 kind order for RNG parity', () => {
    expect(POOLS.sea).toEqual(['patrol', 'mine', 'hunter', 'gunboat', 'missile']);
  });
  it('sea composition is identical to the biome-less call (act-1 regression)', () => {
    expect(composeWave(3, mulberry32(11))).toEqual(composeWave(3, mulberry32(11), 'sea'));
  });
  it('coast pool adds air enemies and aagun, inland drops subs', () => {
    expect(POOLS.coast).toContain('scout');
    expect(POOLS.coast).toContain('aagun');
    expect(POOLS.inland).not.toContain('patrol');
    expect(POOLS.inland).toContain('tank');
  });
  it('only pool kinds ever spawn for a biome', () => {
    for (let w = 5; w <= 14; w++) {
      for (const k of composeWave(w, mulberry32(w), 'inland')) {
        expect(POOLS.inland).toContain(k);
      }
    }
  });
  it('AIR and GROUND categorize the new kinds', () => {
    expect([...AIR]).toEqual(expect.arrayContaining(['scout', 'gunship', 'mchopper']));
    expect([...GROUND]).toEqual(expect.arrayContaining(['aagun', 'tank']));
  });
  it('new kinds respect their unlock waves', () => {
    for (const k of composeWave(5, mulberry32(1), 'coast')) {
      expect(['patrol', 'mine', 'hunter', 'gunboat', 'missile', 'scout', 'aagun']).toContain(k);
    }
  });
});
