import { describe, it, expect } from 'vitest';
import { composeWave, scoreTargetForWave, waveBudget, COST, UNLOCK, POOLS, AIR, GROUND, type SpawnKind } from './waves';
import { mulberry32 } from '../core/rng';

describe('waveBudget', () => {
  it('scales with wave number', () => {
    expect(waveBudget(1)).toBe(12);
    expect(waveBudget(5)).toBeGreaterThan(waveBudget(4));
  });
});

describe('scoreTargetForWave', () => {
  it('is repeatable for a wave and act', () => {
    expect(scoreTargetForWave(6, 2)).toBe(scoreTargetForWave(6, 2));
  });

  it('is positive and nondecreasing across the waves in each act', () => {
    for (let act = 1; act <= 3; act++) {
      const firstWave = (act - 1) * 4 + 1;
      const targets = Array.from({ length: 4 }, (_, index) => scoreTargetForWave(firstWave + index, act));
      expect(targets.every(target => target > 0)).toBe(true);
      expect(targets.every((target, index) => index === 0 || target >= targets[index - 1])).toBe(true);
    }
  });

  it('sets each finale target above the preceding wave', () => {
    for (let act = 1; act <= 3; act++) {
      const finaleWave = act * 4;
      expect(scoreTargetForWave(finaleWave, act)).toBeGreaterThan(scoreTargetForWave(finaleWave - 1, act));
    }
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
  it('keeps Act 1 wave 1-3 compositions equal to golden v1 outputs', () => {
    const golden: Record<number, SpawnKind[][]> = {
      1: [
        ['patrol', 'patrol', 'patrol', 'patrol', 'patrol', 'patrol'],
        ['mine', 'patrol', 'mine', 'hunter', 'hunter', 'patrol'],
        ['hunter', 'patrol', 'hunter', 'gunboat', 'gunboat'],
      ],
      11: [
        ['patrol', 'patrol', 'patrol', 'patrol', 'patrol', 'patrol'],
        ['mine', 'mine', 'mine', 'mine', 'hunter', 'mine', 'patrol'],
        ['hunter', 'hunter', 'hunter', 'hunter', 'hunter'],
      ],
      42: [
        ['patrol', 'patrol', 'patrol', 'patrol', 'patrol', 'patrol'],
        ['mine', 'mine', 'hunter', 'hunter', 'patrol', 'mine'],
        ['hunter', 'mine', 'gunboat', 'hunter', 'patrol', 'mine'],
      ],
    };
    for (const [seed, expected] of Object.entries(golden)) {
      expect([1, 2, 3].map(w => composeWave(w, mulberry32(Number(seed))))).toEqual(expected);
    }
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
