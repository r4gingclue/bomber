import { expect, it, vi } from 'vitest';
import {
  GRAPHICS_MANIFEST,
  loadAssets,
  type AssetManifest,
  type AtlasFrame,
  type FrameRect,
  validateManifestCoverage,
} from './assets';

const frame = (url: string, x: number): AtlasFrame => ({
  url,
  x,
  y: 0,
  w: 1,
  h: 1,
  drawW: 1,
  drawH: 1,
});

const playerFrames = (): FrameRect[] => Array.from({ length: 5 }, (_, index) => ({
  x: index * 192,
  y: 0,
  w: 192,
  h: 96,
}));

const manifest: AssetManifest = {
  player: {
    heli: {
      url: '/assets/graphics/player-heli.png',
      frames: playerFrames(),
    },
  },
  enemy: {
    scout: frame('/assets/graphics/enemies.png', 0),
    gunship: frame('/assets/graphics/enemies.png', 1),
    mchopper: frame('/assets/graphics/enemies.png', 2),
    patrol: frame('/assets/graphics/enemies.png', 3),
    hunter: frame('/assets/graphics/enemies.png', 4),
    missile: frame('/assets/graphics/enemies.png', 5),
  },
  vehicle: {
    tank: frame('/assets/graphics/vehicles.png', 0),
    aagun: frame('/assets/graphics/vehicles.png', 1),
    gunboat: frame('/assets/graphics/vehicles.png', 2),
    mine: frame('/assets/graphics/vehicles.png', 3),
  },
  weapon: {
    bullet: frame('/assets/graphics/weapons.png', 0),
    shot: frame('/assets/graphics/weapons.png', 1),
    flak: frame('/assets/graphics/weapons.png', 2),
    torpedo: frame('/assets/graphics/weapons.png', 3),
    sam: frame('/assets/graphics/weapons.png', 4),
    pmissile: frame('/assets/graphics/weapons.png', 5),
    charge: frame('/assets/graphics/weapons.png', 6),
  },
  scenery: {
    militaryConcrete: '/assets/graphics/bunker.png',
    ruralWall: '/assets/graphics/wall.png',
    desertStone: '/assets/graphics/stone.png',
  },
};

const decoded = { width: 960, height: 192 } as CanvasImageSource;
const visible = vi.fn(async () => true);

it('rejects when a critical image fails', async () => {
  await expect(loadAssets(manifest, async url => {
    if (url.includes('player-heli')) throw new Error('404');
    return decoded;
  }, visible)).rejects.toThrow('Critical asset failed: player.heli');
});

it('records an optional failure without rejecting', async () => {
  const load = vi.fn(async (url: string) => {
    if (url.includes('stone')) throw new Error('404');
    return decoded;
  });
  const result = await loadAssets(manifest, load, visible);
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

it('covers every runtime key in the production manifest', () => {
  expect(() => validateManifestCoverage(GRAPHICS_MANIFEST)).not.toThrow();
});

it('rejects an atlas frame that exceeds the decoded image bounds', async () => {
  const invalid: AssetManifest = {
    ...manifest,
    weapon: {
      ...manifest.weapon,
      charge: { ...manifest.weapon.charge, x: 960 },
    },
  };
  await expect(loadAssets(invalid, async () => decoded, visible))
    .rejects.toThrow('Critical asset failed: weapon.charge: Atlas frame exceeds decoded image bounds');
});

it('rejects a player atlas whose decoded dimensions are unavailable', async () => {
  await expect(loadAssets(
    manifest,
    async () => ({} as CanvasImageSource),
    visible,
  )).rejects.toThrow('Critical asset failed: player.heli: Decoded image has no valid dimensions');
});

it('rejects an undersized player frame even when it is in bounds', async () => {
  const invalid: AssetManifest = {
    ...manifest,
    player: {
      heli: {
        ...manifest.player.heli,
        frames: playerFrames().map((item, index) => (
          index === 2 ? { ...item, w: 191 } : item
        )),
      },
    },
  };

  await expect(loadAssets(invalid, async () => decoded, visible))
    .rejects.toThrow('Critical asset failed: player.heli: frame 2 is undersized');
});

it('rejects a player frame outside the decoded atlas', async () => {
  const invalid: AssetManifest = {
    ...manifest,
    player: {
      heli: {
        ...manifest.player.heli,
        frames: playerFrames().map((item, index) => (
          index === 4 ? { ...item, x: 800 } : item
        )),
      },
    },
  };

  await expect(loadAssets(invalid, async () => decoded, visible))
    .rejects.toThrow('Critical asset failed: player.heli: Atlas frame exceeds decoded image bounds');
});

it('rejects a fully transparent player frame', async () => {
  const inspect = vi.fn(async (_image: CanvasImageSource, candidate: FrameRect) =>
    candidate.x !== 384);

  await expect(loadAssets(manifest, async () => decoded, inspect))
    .rejects.toThrow('Critical asset failed: player.heli: frame 2 is fully transparent');
});

it('validates visible pixels for every critical runtime frame', async () => {
  const inspect = vi.fn(async () => true);

  await loadAssets(manifest, async () => decoded, inspect);

  expect(inspect).toHaveBeenCalledTimes(5 + 6 + 4 + 7);
});
