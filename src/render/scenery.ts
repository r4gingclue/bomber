import { mulberry32 } from '../core/rng';
import { COL_W, type Terrain } from '../game/terrain';

export interface SceneryProp {
  kind: 'military' | 'rural' | 'desert' | 'rock' | 'scrub';
  x: number;
  scale: number;
}

export function sceneryForTerrain(t: Terrain, seed: number): SceneryProp[] {
  const rng = mulberry32(seed ^ 0x5ce9);
  const out: SceneryProp[] = [];
  for (let col = 3; col < t.surface.length - 3; col += 4 + Math.floor(rng() * 5)) {
    if (t.water[col]) continue;
    const kind = t.biome === 'inland' ? (rng() < 0.3 ? 'desert' : 'scrub')
      : t.biome === 'coast' ? (rng() < 0.25 ? 'rural' : 'rock') : 'rock';
    out.push({ kind, x: col * COL_W, scale: 0.75 + rng() * 0.5 });
  }
  return out;
}
