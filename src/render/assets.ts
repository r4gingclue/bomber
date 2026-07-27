export interface AssetManifest {
  player: Record<string, string>;
  enemy: Record<string, string>;
  weapon: Record<string, string>;
  scenery: Record<string, string>;
}

export interface LoadedAssets {
  player: Record<string, CanvasImageSource>;
  enemy: Record<string, CanvasImageSource>;
  weapon: Record<string, CanvasImageSource>;
  scenery: Record<string, CanvasImageSource | undefined>;
  warnings: string[];
}

export const GRAPHICS_MANIFEST: AssetManifest = {
  player: { heli: '/assets/graphics/player-heli.png' },
  enemy: {},
  weapon: {},
  scenery: {},
};

type ImageLoader = (url: string) => Promise<CanvasImageSource>;

export async function browserImageLoader(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

export async function loadAssets(
  m: AssetManifest,
  loader: ImageLoader = browserImageLoader,
): Promise<LoadedAssets> {
  const out: LoadedAssets = { player: {}, enemy: {}, weapon: {}, scenery: {}, warnings: [] };
  for (const group of ['player', 'enemy', 'weapon'] as const) {
    for (const [name, url] of Object.entries(m[group])) {
      try { out[group][name] = await loader(url); }
      catch { throw new Error(`Critical asset failed: ${group}.${name}`); }
    }
  }
  for (const [name, url] of Object.entries(m.scenery)) {
    try { out.scenery[name] = await loader(url); }
    catch { out.warnings.push(`Optional asset failed: scenery.${name}`); }
  }
  return out;
}
