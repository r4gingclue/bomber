import { describe, it, expect } from 'vitest';
import { circlesOverlap, resolveBlasts } from './collision';

describe('circlesOverlap', () => {
  it('detects overlap', () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 })).toBe(true);
  });
  it('detects touch as overlap', () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 10, y: 0, r: 5 })).toBe(true);
  });
  it('rejects separation', () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 11, y: 0, r: 5 })).toBe(false);
  });
});

describe('resolveBlasts', () => {
  it('hits targets inside radius, misses outside', () => {
    const hit = resolveBlasts([{ x: 0, y: 0, r: 20 }], [
      { id: 1, x: 10, y: 0, r: 5 },
      { id: 2, x: 40, y: 0, r: 5 },
    ]);
    expect(hit).toEqual(new Set([1]));
  });
  it('chains through mines', () => {
    // blast reaches mine 1 only; mine 1 chain reaches mine 2; mine 2 chain reaches sub 3
    const hit = resolveBlasts([{ x: 0, y: 0, r: 15 }], [
      { id: 1, x: 12, y: 0, r: 3, chainRadius: 30 },
      { id: 2, x: 40, y: 0, r: 3, chainRadius: 30 },
      { id: 3, x: 65, y: 0, r: 5 },
    ]);
    expect(hit).toEqual(new Set([1, 2, 3]));
  });
  it('terminates on mutually-in-range mines (each detonates once)', () => {
    const mines = [0, 10, 20].map((x, i) => ({ id: i, x, y: 0, r: 3, chainRadius: 50 }));
    const hit = resolveBlasts([{ x: 0, y: 0, r: 5 }], mines);
    expect(hit.size).toBe(3);
  });
});
