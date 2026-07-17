import { describe, it, expect } from 'vitest';
import { generateTerrain, surfaceAt, isWater, onLZ, COLS, COL_W } from './terrain';
import { WATERLINE, SEA_BOTTOM, ARENA_W } from './consts';
import { mulberry32 } from '../core/rng';

describe('generateTerrain', () => {
  it('is deterministic for the same seed', () => {
    expect(generateTerrain('coast', mulberry32(7))).toEqual(generateTerrain('coast', mulberry32(7)));
  });
  it('sea is all water at the waterline', () => {
    const t = generateTerrain('sea', mulberry32(1));
    expect(t.water.every(w => w)).toBe(true);
    expect(t.surface.every(s => s === WATERLINE)).toBe(true);
    expect(t.lz).toHaveLength(0);
  });
  it('coast has water on the left, land with an LZ on the right', () => {
    const t = generateTerrain('coast', mulberry32(2));
    expect(t.water[0]).toBe(true);
    expect(t.water[COLS - 1]).toBe(false);
    expect(t.lz.length).toBeGreaterThanOrEqual(1);
  });
  it('LZ spans are flat', () => {
    const t = generateTerrain('coast', mulberry32(3));
    for (const s of t.lz) {
      const ys = [];
      for (let x = s.x0; x < s.x1; x += COL_W) ys.push(surfaceAt(t, x));
      expect(new Set(ys).size).toBe(1);
    }
  });
  it('inland has no water, two LZs, bounded heights', () => {
    const t = generateTerrain('inland', mulberry32(4));
    expect(t.water.some(w => w)).toBe(false);
    expect(t.lz).toHaveLength(2);
    for (const s of t.surface) {
      expect(s).toBeGreaterThanOrEqual(70);
      expect(s).toBeLessThanOrEqual(SEA_BOTTOM - 8);
    }
  });
  it('coast buildings rise well above the beach', () => {
    const t = generateTerrain('coast', mulberry32(5));
    expect(Math.min(...t.surface)).toBeLessThan(WATERLINE - 40);
  });
});

describe('queries', () => {
  it('clamp out-of-range x', () => {
    const t = generateTerrain('sea', mulberry32(1));
    expect(surfaceAt(t, -50)).toBe(WATERLINE);
    expect(surfaceAt(t, ARENA_W + 50)).toBe(WATERLINE);
    expect(isWater(t, -50)).toBe(true);
  });
  it('onLZ true inside a span, false outside', () => {
    const t = generateTerrain('coast', mulberry32(2));
    const s = t.lz[0];
    expect(onLZ(t, (s.x0 + s.x1) / 2)).toBe(true);
    expect(onLZ(t, 0)).toBe(false);
  });
});
