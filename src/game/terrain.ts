import type { Rng } from '../core/rng';
import type { Biome } from './biomes';
import { ARENA_W, WATERLINE, SEA_BOTTOM } from './consts';

export const COL_W = 8;
export const COLS = ARENA_W / COL_W;

export interface LzSpan { x0: number; x1: number }

export interface Terrain {
  biome: Biome;
  /** collision surface y per column: WATERLINE for water, ground height for land */
  surface: number[];
  water: boolean[];
  lz: LzSpan[];
}

export function generateTerrain(biome: Biome, rng: Rng): Terrain {
  const surface = new Array<number>(COLS).fill(WATERLINE);
  const water = new Array<boolean>(COLS).fill(true);
  const lz: LzSpan[] = [];

  if (biome === 'coast') {
    const shore = Math.floor(COLS * 0.5);
    for (let i = shore; i < COLS; i++) {
      water[i] = false;
      const inland = (i - shore) / (COLS - shore);
      surface[i] = WATERLINE - 10 - inland * 20 + Math.sin(i * 0.7) * 3;
    }
    // town: 5 flat-top buildings on the right 35%
    const townStart = Math.floor(COLS * 0.65);
    for (let b = 0; b < 5; b++) {
      const w = 3 + Math.floor(rng() * 3);
      const x = townStart + Math.floor(rng() * (COLS - townStart - w));
      const h = WATERLINE - 45 - Math.floor(rng() * 30);
      for (let i = x; i < x + w; i++) surface[i] = h;
    }
    // helipad LZ just inland of the shore
    const padStart = shore + 4;
    const padY = Math.round(surface[padStart]);
    for (let i = padStart; i < padStart + 6; i++) surface[i] = padY;
    lz.push({ x0: padStart * COL_W, x1: (padStart + 6) * COL_W });
  } else if (biome === 'inland') {
    for (let i = 0; i < COLS; i++) {
      water[i] = false;
      surface[i] = WATERLINE - 20 + Math.sin(i * 0.15 + 2) * 25 + Math.sin(i * 0.05) * 15;
    }
    // friendly LZ at the left edge
    const leftY = Math.round(surface[4]);
    for (let i = 2; i < 8; i++) surface[i] = leftY;
    lz.push({ x0: 2 * COL_W, x1: 8 * COL_W });
    // base plateau on the right
    const plateauY = Math.round(Math.min(...surface.slice(100, 114)) - 4);
    for (let i = 100; i < 114; i++) surface[i] = plateauY;
    lz.push({ x0: 100 * COL_W, x1: 114 * COL_W });
  }

  for (let i = 0; i < COLS; i++) {
    surface[i] = Math.max(70, Math.min(SEA_BOTTOM - 8, surface[i]));
  }
  return { biome, surface, water, lz };
}

const colAt = (x: number) => Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_W)));

export function surfaceAt(t: Terrain, x: number): number {
  return t.surface[colAt(x)];
}

export function isWater(t: Terrain, x: number): boolean {
  return t.water[colAt(x)];
}

export function onLZ(t: Terrain, x: number): boolean {
  return t.lz.some(s => x >= s.x0 && x <= s.x1);
}
