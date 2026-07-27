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

describe('AA Missiles card', () => {
  it('is act-gated: absent before act 2, present from act 2', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const c of drawCards(mulberry32(seed), new Set(), 3, 1)) {
        expect(c.id).not.toBe('missiles');
      }
    }
    const everSeen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      for (const c of drawCards(mulberry32(seed), new Set(), 3, 2)) everSeen.add(c.id);
    }
    expect(everSeen.has('missiles')).toBe(true);
  });

  it('stacks +2 up to cap 6', () => {
    const s = defaultStats();
    const card = CARD_POOL.find(c => c.id === 'missiles')!;
    card.apply(s); card.apply(s); card.apply(s); card.apply(s);
    expect(s.missileCap).toBe(6);
  });
});
