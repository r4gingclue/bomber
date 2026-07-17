import { describe, it, expect } from 'vitest';
import { biomeForAct, actTitle, PALETTES, BIOME_ORDER } from './biomes';

describe('biomeForAct', () => {
  it('cycles through BIOME_ORDER starting at act 1', () => {
    expect(biomeForAct(1)).toBe('sea');
    expect(biomeForAct(2)).toBe('coast');
    expect(biomeForAct(1 + BIOME_ORDER.length)).toBe('sea');
  });
});

describe('actTitle', () => {
  it('names the act and biome', () => {
    expect(actTitle(1)).toBe('ACT 1 — OPEN SEA');
    expect(actTitle(2)).toBe('ACT 2 — COASTAL STRIKE');
  });
});

describe('PALETTES', () => {
  it('has a full palette for every biome', () => {
    for (const b of ['sea', 'coast', 'inland'] as const) {
      const p = PALETTES[b];
      for (const k of ['skyTop', 'skyBottom', 'seaTop', 'seaDeep', 'ground', 'groundDark'] as const) {
        expect(p[k]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
