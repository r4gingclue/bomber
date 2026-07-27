import { expect, it, vi } from 'vitest';
import { loadAssets, type AssetManifest } from './assets';

const manifest: AssetManifest = {
  player: { heli: '/assets/graphics/player-heli.png' },
  enemy: { scout: '/assets/graphics/scout.png' },
  weapon: { missile: '/assets/graphics/missile.png' },
  scenery: { bunker: '/assets/graphics/bunker.png' },
};

it('rejects when a critical image fails', async () => {
  await expect(loadAssets(manifest, async url => {
    if (url.includes('player-heli')) throw new Error('404');
    return {} as CanvasImageSource;
  })).rejects.toThrow('Critical asset failed: player.heli');
});

it('records an optional failure without rejecting', async () => {
  const load = vi.fn(async (url: string) => {
    if (url.includes('bunker')) throw new Error('404');
    return {} as CanvasImageSource;
  });
  const result = await loadAssets(manifest, load);
  expect(result.scenery.bunker).toBeUndefined();
  expect(result.warnings).toEqual(['Optional asset failed: scenery.bunker']);
});
