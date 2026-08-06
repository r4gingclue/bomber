export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasFrame extends FrameRect {
  url: string;
  drawW: number;
  drawH: number;
}

export interface PlayerAtlas {
  url: string;
  frames: FrameRect[];
}

export interface AssetManifest {
  player: Record<string, PlayerAtlas>;
  enemy: Record<string, AtlasFrame>;
  vehicle: Record<string, AtlasFrame>;
  weapon: Record<string, AtlasFrame>;
  scenery: Record<string, string>;
}

export interface LoadedPlayerAsset {
  image: CanvasImageSource;
  frames: FrameRect[];
}

export interface LoadedFrameAsset {
  image: CanvasImageSource;
  frame: Omit<AtlasFrame, 'url'>;
}

export interface LoadedAssets {
  player: Record<string, LoadedPlayerAsset>;
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
  player: {
    heli: {
      url: 'assets/graphics/player-heli.png',
      frames: Array.from({ length: 5 }, (_, index) => ({
        x: index * 192,
        y: 0,
        w: 192,
        h: 96,
      })),
    },
  },
  enemy: {
    scout: { url: 'assets/graphics/enemies.png', x: 8, y: 32, w: 160, h: 80, drawW: 34, drawH: 17 },
    gunship: { url: 'assets/graphics/enemies.png', x: 176, y: 8, w: 256, h: 128, drawW: 46, drawH: 23 },
    mchopper: { url: 'assets/graphics/enemies.png', x: 440, y: 8, w: 256, h: 128, drawW: 44, drawH: 22 },
    patrol: { url: 'assets/graphics/enemies.png', x: 704, y: 24, w: 192, h: 96, drawW: 36, drawH: 18 },
    hunter: { url: 'assets/graphics/enemies.png', x: 904, y: 24, w: 192, h: 96, drawW: 36, drawH: 18 },
    missile: { url: 'assets/graphics/enemies.png', x: 1104, y: 24, w: 192, h: 96, drawW: 38, drawH: 19 },
  },
  vehicle: {
    tank: { url: 'assets/graphics/vehicles.png', x: 8, y: 8, w: 256, h: 128, drawW: 36, drawH: 18 },
    aagun: { url: 'assets/graphics/vehicles.png', x: 272, y: 8, w: 224, h: 128, drawW: 28, drawH: 18 },
    gunboat: { url: 'assets/graphics/vehicles.png', x: 504, y: 8, w: 288, h: 128, drawW: 42, drawH: 18 },
    mine: { url: 'assets/graphics/vehicles.png', x: 800, y: 8, w: 128, h: 128, drawW: 16, drawH: 16 },
  },
  weapon: {
    bullet: { url: 'assets/graphics/weapons.png', x: 8, y: 60, w: 112, h: 56, drawW: 12, drawH: 6 },
    shot: { url: 'assets/graphics/weapons.png', x: 128, y: 56, w: 128, h: 64, drawW: 16, drawH: 8 },
    flak: { url: 'assets/graphics/weapons.png', x: 264, y: 56, w: 128, h: 64, drawW: 18, drawH: 9 },
    torpedo: { url: 'assets/graphics/weapons.png', x: 400, y: 52, w: 192, h: 72, drawW: 24, drawH: 9 },
    sam: { url: 'assets/graphics/weapons.png', x: 600, y: 8, w: 80, h: 160, drawW: 10, drawH: 20 },
    pmissile: { url: 'assets/graphics/weapons.png', x: 688, y: 52, w: 192, h: 72, drawW: 24, drawH: 9 },
    charge: { url: 'assets/graphics/weapons.png', x: 888, y: 16, w: 80, h: 144, drawW: 10, drawH: 14 },
  },
  scenery: {
    militaryConcrete: 'assets/graphics/scenery/military-concrete.png',
    ruralWall: 'assets/graphics/scenery/rural-wall.png',
    desertStone: 'assets/graphics/scenery/desert-stone.png',
  },
};

type ImageLoader = (url: string) => Promise<CanvasImageSource>;
type FrameVisibilityInspector = (
  image: CanvasImageSource,
  frame: FrameRect,
) => Promise<boolean>;

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
  frame: FrameRect,
  image: CanvasImageSource,
): void {
  const size = decodedImageSize(image);
  if (!size) throw new Error('Decoded image has no valid dimensions');
  if (
    !Number.isInteger(frame.x)
    || !Number.isInteger(frame.y)
    || !Number.isInteger(frame.w)
    || !Number.isInteger(frame.h)
    || frame.x < 0
    || frame.y < 0
    || frame.w <= 0
    || frame.h <= 0
    || frame.x + frame.w > size.width
    || frame.y + frame.h > size.height
  ) {
    throw new Error('Atlas frame exceeds decoded image bounds');
  }
}

function validateDrawSize(frame: AtlasFrame): void {
  if (
    !Number.isFinite(frame.drawW)
    || !Number.isFinite(frame.drawH)
    || frame.drawW <= 0
    || frame.drawH <= 0
  ) {
    throw new Error('Atlas frame has an invalid display size');
  }
}

async function browserFrameHasVisiblePixels(
  image: CanvasImageSource,
  frame: FrameRect,
): Promise<boolean> {
  if (typeof document === 'undefined') {
    throw new Error('Pixel validation requires a browser canvas');
  }
  const canvas = document.createElement('canvas');
  canvas.width = frame.w;
  canvas.height = frame.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Pixel validation canvas is unavailable');
  ctx.clearRect(0, 0, frame.w, frame.h);
  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  const pixels = ctx.getImageData(0, 0, frame.w, frame.h).data;
  for (let alpha = 3; alpha < pixels.length; alpha += 4) {
    if (pixels[alpha] > 0) return true;
  }
  return false;
}

export async function loadAssets(
  m: AssetManifest,
  loader: ImageLoader = browserImageLoader,
  hasVisiblePixels: FrameVisibilityInspector = browserFrameHasVisiblePixels,
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

  for (const [name, spec] of Object.entries(m.player)) {
    try {
      if (spec.frames.length !== 5) {
        throw new Error(`expected 5 frames, received ${spec.frames.length}`);
      }
      const image = await loadShared(spec.url);
      for (let index = 0; index < spec.frames.length; index++) {
        const frame = spec.frames[index];
        if (frame.w < 192 || frame.h < 96) {
          throw new Error(`frame ${index} is undersized`);
        }
        validateFrameBounds(frame, image);
        if (!await hasVisiblePixels(image, frame)) {
          throw new Error(`frame ${index} is fully transparent`);
        }
      }
      out.player[name] = { image, frames: spec.frames.map(frame => ({ ...frame })) };
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : '';
      throw new Error(`Critical asset failed: player.${name}${detail}`);
    }
  }

  for (const group of ['enemy', 'vehicle', 'weapon'] as const) {
    for (const [name, spec] of Object.entries(m[group])) {
      try {
        const image = await loadShared(spec.url);
        validateFrameBounds(spec, image);
        validateDrawSize(spec);
        if (!await hasVisiblePixels(image, spec)) {
          throw new Error('frame is fully transparent');
        }
        out[group][name] = {
          image,
          frame: {
            x: spec.x,
            y: spec.y,
            w: spec.w,
            h: spec.h,
            drawW: spec.drawW,
            drawH: spec.drawH,
          },
        };
      } catch (error) {
        const detail = error instanceof Error ? `: ${error.message}` : '';
        throw new Error(`Critical asset failed: ${group}.${name}${detail}`);
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
