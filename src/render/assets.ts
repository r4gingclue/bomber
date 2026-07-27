export interface AtlasFrame {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AssetManifest {
  player: Record<string, string>;
  enemy: Record<string, AtlasFrame>;
  vehicle: Record<string, AtlasFrame>;
  weapon: Record<string, AtlasFrame>;
  scenery: Record<string, string>;
}

export interface LoadedFrameAsset {
  image: CanvasImageSource;
  frame: Omit<AtlasFrame, 'url'>;
}

export interface LoadedAssets {
  player: Record<string, CanvasImageSource>;
  enemy: Record<string, LoadedFrameAsset>;
  vehicle: Record<string, LoadedFrameAsset>;
  weapon: Record<string, LoadedFrameAsset>;
  scenery: Record<string, CanvasImageSource | undefined>;
  warnings: string[];
}

export const REQUIRED_RUNTIME_KEYS = {
  player: ['heli'],
  enemy: ['scout', 'gunship', 'mchopper', 'patrol', 'hunter', 'missile'],
  vehicle: ['tank', 'aagun', 'gunboat', 'mine'],
  weapon: ['bullet', 'shot', 'flak', 'torpedo', 'sam', 'pmissile', 'charge'],
  scenery: ['militaryConcrete', 'ruralWall', 'desertStone'],
} as const;

export function validateManifestCoverage(m: AssetManifest): void {
  for (const group of Object.keys(REQUIRED_RUNTIME_KEYS) as Array<keyof AssetManifest>) {
    const expected = new Set(REQUIRED_RUNTIME_KEYS[group]);
    const actual = new Set(Object.keys(m[group]));
    const missing = [...expected].filter(key => !actual.has(key));
    if (missing.length > 0) throw new Error(`Graphics manifest missing ${group}: ${missing.join(', ')}`);
  }
}

export const GRAPHICS_MANIFEST: AssetManifest = {
  player: { heli: '/assets/graphics/player-heli.png' },
  enemy: {
    scout: { url: '/assets/graphics/enemies.png', x: 8, y: 8, w: 56, h: 32 },
    gunship: { url: '/assets/graphics/enemies.png', x: 72, y: 4, w: 80, h: 40 },
    mchopper: { url: '/assets/graphics/enemies.png', x: 160, y: 4, w: 80, h: 40 },
    patrol: { url: '/assets/graphics/enemies.png', x: 248, y: 8, w: 72, h: 32 },
    hunter: { url: '/assets/graphics/enemies.png', x: 328, y: 8, w: 72, h: 32 },
    missile: { url: '/assets/graphics/enemies.png', x: 408, y: 8, w: 72, h: 32 },
  },
  vehicle: {
    tank: { url: '/assets/graphics/vehicles.png', x: 8, y: 6, w: 72, h: 36 },
    aagun: { url: '/assets/graphics/vehicles.png', x: 88, y: 8, w: 56, h: 32 },
    gunboat: { url: '/assets/graphics/vehicles.png', x: 152, y: 6, w: 84, h: 36 },
    mine: { url: '/assets/graphics/vehicles.png', x: 244, y: 8, w: 32, h: 32 },
  },
  weapon: {
    bullet: { url: '/assets/graphics/weapons.png', x: 8, y: 12, w: 24, h: 16 },
    shot: { url: '/assets/graphics/weapons.png', x: 40, y: 10, w: 32, h: 20 },
    flak: { url: '/assets/graphics/weapons.png', x: 80, y: 8, w: 40, h: 24 },
    torpedo: { url: '/assets/graphics/weapons.png', x: 128, y: 10, w: 48, h: 20 },
    sam: { url: '/assets/graphics/weapons.png', x: 184, y: 4, w: 32, h: 48 },
    pmissile: { url: '/assets/graphics/weapons.png', x: 224, y: 10, w: 48, h: 20 },
    charge: { url: '/assets/graphics/weapons.png', x: 280, y: 6, w: 24, h: 28 },
  },
  scenery: {
    militaryConcrete: '/assets/graphics/scenery/military-concrete.png',
    ruralWall: '/assets/graphics/scenery/rural-wall.png',
    desertStone: '/assets/graphics/scenery/desert-stone.png',
  },
};

type ImageLoader = (url: string) => Promise<CanvasImageSource>;

export async function browserImageLoader(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

function decodedImageSize(
  image: CanvasImageSource,
): { width: number; height: number } | undefined {
  const source = image as {
    naturalWidth?: unknown;
    naturalHeight?: unknown;
    width?: unknown;
    height?: unknown;
  };
  const width = typeof source.naturalWidth === 'number' && source.naturalWidth > 0
    ? source.naturalWidth
    : source.width;
  const height = typeof source.naturalHeight === 'number' && source.naturalHeight > 0
    ? source.naturalHeight
    : source.height;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
    return undefined;
  }
  return { width, height };
}

function validateFrameBounds(
  frame: AtlasFrame,
  image: CanvasImageSource,
): void {
  const size = decodedImageSize(image);
  if (!size) return;
  if (
    frame.x < 0
    || frame.y < 0
    || frame.w <= 0
    || frame.h <= 0
    || frame.x + frame.w > size.width
    || frame.y + frame.h > size.height
  ) {
    throw new Error('Atlas frame exceeds decoded image bounds');
  }
}

export async function loadAssets(
  m: AssetManifest,
  loader: ImageLoader = browserImageLoader,
): Promise<LoadedAssets> {
  validateManifestCoverage(m);
  const out: LoadedAssets = {
    player: {},
    enemy: {},
    vehicle: {},
    weapon: {},
    scenery: {},
    warnings: [],
  };
  const cache = new Map<string, CanvasImageSource>();
  const loadShared = async (url: string): Promise<CanvasImageSource> => {
    const cached = cache.get(url);
    if (cached) return cached;
    const image = await loader(url);
    cache.set(url, image);
    return image;
  };

  for (const [name, url] of Object.entries(m.player)) {
    try {
      out.player[name] = await loadShared(url);
    } catch {
      throw new Error(`Critical asset failed: player.${name}`);
    }
  }

  for (const group of ['enemy', 'vehicle', 'weapon'] as const) {
    for (const [name, spec] of Object.entries(m[group])) {
      try {
        const image = await loadShared(spec.url);
        validateFrameBounds(spec, image);
        out[group][name] = {
          image,
          frame: { x: spec.x, y: spec.y, w: spec.w, h: spec.h },
        };
      } catch {
        throw new Error(`Critical asset failed: ${group}.${name}`);
      }
    }
  }

  for (const [name, url] of Object.entries(m.scenery)) {
    try {
      out.scenery[name] = await loadShared(url);
    } catch {
      out.warnings.push(`Optional asset failed: scenery.${name}`);
    }
  }
  return out;
}
