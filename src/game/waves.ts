import type { Rng } from '../core/rng';

export type SpawnKind = 'patrol' | 'hunter' | 'missile' | 'gunboat' | 'mine';

export const COST: Record<SpawnKind, number> = {
  patrol: 2, mine: 2, hunter: 4, gunboat: 5, missile: 6,
};

export const UNLOCK: Record<SpawnKind, number> = {
  patrol: 1, mine: 2, hunter: 2, gunboat: 3, missile: 4,
};

export function waveBudget(wave: number): number {
  return 8 + wave * 4;
}

export function composeWave(wave: number, rng: Rng): SpawnKind[] {
  const kinds = (Object.keys(COST) as SpawnKind[]).filter(k => UNLOCK[k] <= wave);
  let budget = waveBudget(wave);
  const out: SpawnKind[] = [];
  for (;;) {
    const afford = kinds.filter(k => COST[k] <= budget);
    if (afford.length === 0) break;
    const k = afford[Math.floor(rng() * afford.length)];
    out.push(k);
    budget -= COST[k];
  }
  return out;
}
