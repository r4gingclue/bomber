import { describe, it, expect } from 'vitest';
import { defaultStats, CARD_POOL, drawCards } from './upgrades';
import { mulberry32 } from '../core/rng';

describe('drawCards', () => {
  it('returns 3 cards with distinct ids', () => {
    const cards = drawCards(mulberry32(1), new Set());
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map(c => c.id)).size).toBe(3);
  });
  it('never offers an owned non-repeatable card', () => {
    const owned = new Set(CARD_POOL.filter(c => !c.repeatable).map(c => c.id));
    for (let seed = 0; seed < 20; seed++) {
      for (const c of drawCards(mulberry32(seed), owned)) {
        expect(c.repeatable).toBe(true);
      }
    }
  });
});

describe('stat application', () => {
  it('repeatable cards stack', () => {
    const s = defaultStats();
    const blast = CARD_POOL.find(c => c.id === 'blast')!;
    const r0 = s.blastRadius;
    blast.apply(s);
    blast.apply(s);
    expect(s.blastRadius).toBeCloseTo(r0 * 1.3 * 1.3);
  });
  it('flag cards set their flag', () => {
    const s = defaultStats();
    CARD_POOL.find(c => c.id === 'magnet')!.apply(s);
    expect(s.magnetic).toBe(true);
  });
});
