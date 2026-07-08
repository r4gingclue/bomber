import { describe, it, expect } from 'vitest';
import { mulberry32, pick } from './rng';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('produces values in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('pick', () => {
  it('returns an element of the array', () => {
    const r = mulberry32(3);
    for (let i = 0; i < 50; i++) expect([1, 2, 3]).toContain(pick(r, [1, 2, 3]));
  });
});
