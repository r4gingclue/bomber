import type { Rng } from '../core/rng';
import type { Biome } from './biomes';

export type SpawnKind =
  | 'patrol' | 'hunter' | 'missile' | 'gunboat' | 'mine'
  | 'scout' | 'gunship' | 'mchopper' | 'aagun' | 'tank';

export const COST: Record<SpawnKind, number> = {
  patrol: 2, mine: 2, hunter: 4, gunboat: 5, missile: 6,
  scout: 3, gunship: 7, mchopper: 8, aagun: 5, tank: 6,
};

export const UNLOCK: Record<SpawnKind, number> = {
  patrol: 1, mine: 2, hunter: 2, gunboat: 3, missile: 4,
  scout: 5, aagun: 5, gunship: 6, mchopper: 7, tank: 9,
};

export const AIR: ReadonlySet<SpawnKind> = new Set(['scout', 'gunship', 'mchopper']);
export const GROUND: ReadonlySet<SpawnKind> = new Set(['aagun', 'tank']);

/** sea order MUST stay exactly v1 (patrol,mine,hunter,gunboat,missile) for RNG parity */
export const POOLS: Record<Biome, SpawnKind[]> = {
  sea: ['patrol', 'mine', 'hunter', 'gunboat', 'missile'],
  coast: ['patrol', 'mine', 'hunter', 'gunboat', 'missile', 'scout', 'gunship', 'mchopper', 'aagun'],
  inland: ['scout', 'gunship', 'mchopper', 'aagun', 'tank'],
};

export function waveBudget(wave: number): number {
  return 8 + wave * 4;
}

export function composeWave(wave: number, rng: Rng, biome: Biome = 'sea'): SpawnKind[] {
  const kinds = POOLS[biome].filter(k => UNLOCK[k] <= wave);
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
