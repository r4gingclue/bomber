import { expect, it, vi } from 'vitest';
import {
  GRAPHICS_MANIFEST,
  loadAssets,
  type AssetManifest,
  validateManifestCoverage,
} from './assets';

const manifest: AssetManifest = {
  player: { heli: '/assets/graphics/player-heli.png' },
  enemy: {
    scout: { url: '/assets/graphics/enemies.png', x: 0, y: 0, w: 1, h: 1 },
    gunship: { url: '/assets/graphics/enemies.png', x: 1, y: 0, w: 1, h: 1 },
    mchopper: { url: '/assets/graphics/enemies.png', x: 2, y: 0, w: 1, h: 1 },
    patrol: { url: '/assets/graphics/enemies.png', x: 3, y: 0, w: 1, h: 1 },
    hunter: { url: '/assets/graphics/enemies.png', x: 4, y: 0, w: 1, h: 1 },
    missile: { url: '/assets/graphics/enemies.png', x: 5, y: 0, w: 1, h: 1 },
  },
  vehicle: {
    tank: { url: '/assets/graphics/vehicles.png', x: 0, y: 0, w: 1, h: 1 },
    aagun: { url: '/assets/graphics/vehicles.png', x: 1, y: 0, w: 1, h: 1 },
    gunboat: { url: '/assets/graphics/vehicles.png', x: 2, y: 0, w: 1, h: 1 },
    mine: { url: '/assets/graphics/vehicles.png', x: 3, y: 0, w: 1, h: 1 },
  },
  weapon: {
    bullet: { url: '/assets/graphics/weapons.png', x: 0, y: 0, w: 1, h: 1 },
    shot: { url: '/assets/graphics/weapons.png', x: 1, y: 0, w: 1, h: 1 },
    flak: { url: '/assets/graphics/weapons.png', x: 2, y: 0, w: 1, h: 1 },
    torpedo: { url: '/assets/graphics/weapons.png', x: 3, y: 0, w: 1, h: 1 },
    sam: { url: '/assets/graphics/weapons.png', x: 4, y: 0, w: 1, h: 1 },
    pmissile: { url: '/assets/graphics/weapons.png', x: 5, y: 0, w: 1, h: 1 },
    charge: { url: '/assets/graphics/weapons.png', x: 6, y: 0, w: 1, h: 1 },
  },
  scenery: { militaryConcrete: '/assets/graphics/bunker.png', ruralWall: '/assets/graphics/wall.png', desertStone: '/assets/graphics/stone.png' },
};

it('rejects when a critical image fails', async () => {
  await expect(loadAssets(manifest, async url => {
    if (url.includes('player-heli')) throw new Error('404');
    return {} as CanvasImageSource;
  })).rejects.toThrow('Critical asset failed: player.heli');
});

it('records an optional failure without rejecting', async () => {
  const load = vi.fn(async (url: string) => {
    if (url.includes('stone')) throw new Error('404');
    return {} as CanvasImageSource;
  });
  const result = await loadAssets(manifest, load);
  expect(result.scenery.desertStone).toBeUndefined();
  expect(result.warnings).toEqual(['Optional asset failed: scenery.desertStone']);
});

it('fails fast when a runtime render key is missing from the manifest', () => {
  const invalid: AssetManifest = {
    ...manifest,
    weapon: { ...manifest.weapon },
  };
  delete invalid.weapon.charge;
  expect(() => validateManifestCoverage(invalid)).toThrow('Graphics manifest missing weapon: charge');
});

it('covers every Task 8 runtime key in the production manifest', () => {
  expect(() => validateManifestCoverage(GRAPHICS_MANIFEST)).not.toThrow();
});
