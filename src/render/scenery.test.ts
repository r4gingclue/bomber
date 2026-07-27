import { expect, it } from 'vitest';
import { sceneryForTerrain } from './scenery';
import { generateTerrain } from '../game/terrain';
import { mulberry32 } from '../core/rng';

it('places identical scenery for the same biome and seed', () => {
  const a = generateTerrain('coast', mulberry32(9));
  const b = generateTerrain('coast', mulberry32(9));
  expect(sceneryForTerrain(a, 99)).toEqual(sceneryForTerrain(b, 99));
});

it('never places land scenery in water columns', () => {
  const t = generateTerrain('coast', mulberry32(4));
  const props = sceneryForTerrain(t, 4);
  expect(props.length).toBeGreaterThan(0);
  for (const p of props) {
    expect(t.water[Math.floor(p.x / 8)]).toBe(false);
  }
});
