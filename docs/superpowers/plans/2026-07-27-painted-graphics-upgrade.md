# Painted Graphics Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Sea Bomber as a responsive 960×540 painted military arcade game while preserving its 480×270 side-view simulation and all gameplay behavior.

**Architecture:** Keep simulation coordinates unchanged and introduce a pure viewport transform that maps them into a 2× render space. Split rendering into focused background, terrain, shadow, entity, effects, grading, and UI passes; load curated scenery through a typed asset manifest with procedural fallbacks. Add measured quality tiers that only reduce cosmetic work.

**Tech Stack:** TypeScript, Vite, Canvas 2D, Vitest, browser Image/Canvas APIs, PNG atlases.

## Global Constraints

- Preserve side-view and side-scrolling gameplay.
- Preserve the current 480×270 simulation coordinate system.
- Preserve physics, collision, aiming, weapons, AI, wave composition, and balance.
- Render at a 960×540 logical canvas resolution.
- Preserve the complete 16:9 battlefield on every device; never crop gameplay.
- Use responsive letterboxing and safe-area-aware controls.
- Use original side-view art for all aircraft, vehicles, boats, submarines, and weapons.
- Use PVGames Military Base, Rural, and Sands packs only for transformed environmental scenery and textures.
- Never commit source archives or redistributable raw asset sheets.
- Keep all existing gameplay tests green without weakened assertions.
- Missing optional scenery must fall back safely; missing critical entity frames must fail visibly in development.
- Quality reductions may remove cosmetic work only, never gameplay entities, projectiles, objectives, aiming cues, or hit feedback.

---

### Task 1: Pure responsive viewport transform

**Files:**
- Create: `src/render/viewport.ts`
- Create: `src/render/viewport.test.ts`
- Modify: `src/game/consts.ts`

**Interfaces:**
- Consumes: `VIEW_W = 480`, `VIEW_H = 270`.
- Produces: `RENDER_W = 960`, `RENDER_H = 540`, `fitViewport()`, `clientToWorld()`, and `worldToRender()`.

- [ ] **Step 1: Add failing viewport tests**

```ts
import { describe, expect, it } from 'vitest';
import { clientToWorld, fitViewport, worldToRender } from './viewport';

describe('fitViewport', () => {
  it('contains 16:9 without cropping a wide viewport', () => {
    expect(fitViewport(1200, 600, { top: 0, right: 0, bottom: 0, left: 0 }))
      .toEqual({ x: 67, y: 0, width: 1067, height: 600, scale: 600 / 540 });
  });
  it('contains 16:9 inside safe-area insets', () => {
    const v = fitViewport(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    expect(v.x).toBe(0);
    expect(v.width).toBe(390);
    expect(v.height).toBe(219);
    expect(v.y).toBe(319);
  });
});

it('round-trips world coordinates through render and client space', () => {
  const v = fitViewport(1280, 720, { top: 0, right: 0, bottom: 0, left: 0 });
  expect(worldToRender(240, 135)).toEqual({ x: 480, y: 270 });
  expect(clientToWorld(640, 360, v))
    .toEqual({ x: 240, y: 135 });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run src/render/viewport.test.ts`  
Expected: FAIL because `viewport.ts` and render constants do not exist.

- [ ] **Step 3: Add render constants**

Append to `src/game/consts.ts`:

```ts
export const RENDER_SCALE = 2;
export const RENDER_W = VIEW_W * RENDER_SCALE;
export const RENDER_H = VIEW_H * RENDER_SCALE;
```

- [ ] **Step 4: Implement the transform**

```ts
import { RENDER_H, RENDER_SCALE, RENDER_W } from '../game/consts';

export interface Insets { top: number; right: number; bottom: number; left: number }
export interface ViewportRect { x: number; y: number; width: number; height: number; scale: number }

export function fitViewport(w: number, h: number, inset: Insets): ViewportRect {
  const aw = Math.max(1, w - inset.left - inset.right);
  const ah = Math.max(1, h - inset.top - inset.bottom);
  const scale = Math.min(aw / RENDER_W, ah / RENDER_H);
  const width = Math.round(RENDER_W * scale);
  const height = Math.round(RENDER_H * scale);
  return {
    x: Math.round(inset.left + (aw - width) / 2),
    y: Math.round(inset.top + (ah - height) / 2),
    width, height, scale,
  };
}

export const worldToRender = (x: number, y: number) =>
  ({ x: x * RENDER_SCALE, y: y * RENDER_SCALE });

export function clientToWorld(x: number, y: number, v: ViewportRect) {
  return {
    x: (x - v.x) / v.scale / RENDER_SCALE,
    y: (y - v.y) / v.scale / RENDER_SCALE,
  };
}
```

- [ ] **Step 5: Run focused and full verification**

Run: `npx vitest run src/render/viewport.test.ts && npm run typecheck && npx vitest run`  
Expected: viewport tests and the full suite PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/consts.ts src/render/viewport.ts src/render/viewport.test.ts
git commit -m "feat: add responsive 960x540 viewport transform"
```

---

### Task 2: Asset manifest, preload, and fallback contract

**Files:**
- Create: `src/render/assets.ts`
- Create: `src/render/assets.test.ts`
- Create: `public/assets/graphics/.gitkeep`

**Interfaces:**
- Produces: `AssetManifest`, `LoadedAssets`, and `loadAssets()`.
- Critical groups: `player`, `enemy`, `weapon`; optional group: `scenery`.

- [ ] **Step 1: Write failing manifest tests**

```ts
import { describe, expect, it, vi } from 'vitest';
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
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run src/render/assets.test.ts`  
Expected: FAIL because `assets.ts` does not exist.

- [ ] **Step 3: Implement the typed loader**

```ts
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

type ImageLoader = (url: string) => Promise<CanvasImageSource>;

export async function browserImageLoader(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

export async function loadAssets(m: AssetManifest, loader: ImageLoader = browserImageLoader): Promise<LoadedAssets> {
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
```

- [ ] **Step 4: Verify loader behavior**

Run: `npx vitest run src/render/assets.test.ts && npm run typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/assets.ts src/render/assets.test.ts public/assets/graphics/.gitkeep
git commit -m "feat: add typed graphics asset loader"
```

---

### Task 3: Measured graphics quality tiers

**Files:**
- Create: `src/render/quality.ts`
- Create: `src/render/quality.test.ts`

**Interfaces:**
- Produces: `QualityTier = 'full' | 'reduced' | 'minimum'` and `QualityMonitor.sample(frameMs)`.

- [ ] **Step 1: Write failing hysteresis tests**

```ts
import { expect, it } from 'vitest';
import { QualityMonitor } from './quality';

it('steps down only after sustained slow frames', () => {
  const q = new QualityMonitor();
  for (let i = 0; i < 89; i++) q.sample(25);
  expect(q.tier).toBe('full');
  q.sample(25);
  expect(q.tier).toBe('reduced');
});

it('does not oscillate after a short recovery', () => {
  const q = new QualityMonitor('reduced');
  for (let i = 0; i < 239; i++) q.sample(12);
  expect(q.tier).toBe('reduced');
  q.sample(12);
  expect(q.tier).toBe('full');
});

it('never drops more than one tier per pressure window', () => {
  const q = new QualityMonitor();
  for (let i = 0; i < 90; i++) q.sample(40);
  expect(q.tier).toBe('reduced');
});
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run src/render/quality.test.ts`  
Expected: FAIL because `quality.ts` does not exist.

- [ ] **Step 3: Implement measured transitions**

```ts
export type QualityTier = 'full' | 'reduced' | 'minimum';

export class QualityMonitor {
  private slow = 0;
  private fast = 0;
  constructor(public tier: QualityTier = 'full') {}

  sample(ms: number): QualityTier {
    if (ms > 21) { this.slow++; this.fast = 0; }
    else if (ms < 15) { this.fast++; this.slow = 0; }
    else { this.slow = 0; this.fast = 0; }
    if (this.slow >= 90) {
      this.tier = this.tier === 'full' ? 'reduced' : 'minimum';
      this.slow = 0;
    } else if (this.fast >= 240) {
      this.tier = this.tier === 'minimum' ? 'reduced' : 'full';
      this.fast = 0;
    }
    return this.tier;
  }
}
```

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/render/quality.test.ts && npm run typecheck`

```bash
git add src/render/quality.ts src/render/quality.test.ts
git commit -m "feat: add measured graphics quality tiers"
```

---

### Task 4: Responsive canvas boot and input alignment

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/core/input.ts`
- Modify: `src/core/input.test.ts`

**Interfaces:**
- Consumes: `fitViewport()`, `clientToWorld()`, `RENDER_W`, `RENDER_H`.
- Produces: a 960×540 canvas styled to the fitted viewport and correctly aligned input.

- [ ] **Step 1: Add a failing coordinate-conversion input test**

Extend `src/core/input.test.ts` with a test that supplies a canvas rectangle
`{ left: 100, top: 50, width: 960, height: 540 }`, sends pointer coordinates
`(580, 320)`, and expects aim `{ x: 240, y: 135 }`.

```ts
it('maps the center of a 960x540 display back to 480x270 simulation space', () => {
  const world = clientToWorld(580, 320, {
    x: 100, y: 50, width: 960, height: 540, scale: 1,
  });
  expect(world).toEqual({ x: 240, y: 135 });
});
```

- [ ] **Step 2: Verify the focused test**

Run: `npx vitest run src/core/input.test.ts`  
Expected: PASS only after importing and using the viewport conversion contract.

- [ ] **Step 3: Replace integer-only canvas sizing**

In `src/main.ts`:

```ts
canvas.width = RENDER_W;
canvas.height = RENDER_H;

function safeInsets(): Insets {
  const css = getComputedStyle(document.documentElement);
  const n = (name: string) => Number.parseFloat(css.getPropertyValue(name)) || 0;
  return { top: n('--sat'), right: n('--sar'), bottom: n('--sab'), left: n('--sal') };
}

let viewport = fitViewport(innerWidth, innerHeight, safeInsets());
function resize(): void {
  viewport = fitViewport(innerWidth, innerHeight, safeInsets());
  Object.assign(canvas.style, {
    position: 'fixed',
    left: `${viewport.x}px`,
    top: `${viewport.y}px`,
    width: `${viewport.width}px`,
    height: `${viewport.height}px`,
  });
}
```

Set `input.toCanvas` to `clientToWorld(clientX, clientY, viewport)`; remove the
old rectangle-to-480 conversion.

- [ ] **Step 4: Add safe-area CSS**

In `index.html`:

```css
:root {
  --sat: env(safe-area-inset-top, 0px);
  --sar: env(safe-area-inset-right, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  background: #101418;
}
canvas { image-rendering: auto; touch-action: none; }
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/render/viewport.test.ts src/core/input.test.ts && npm run build && npx vitest run`  
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.ts src/core/input.ts src/core/input.test.ts
git commit -m "feat: fit high-resolution canvas across device sizes"
```

---

### Task 5: Curate licensed environmental source material

**Files:**
- Create: `docs/assets/PVGAMES-LICENSE.txt`
- Create: `docs/assets/painted-scenery-sources.json`
- Create: `public/assets/graphics/scenery/military-concrete.png`
- Create: `public/assets/graphics/scenery/rural-wall.png`
- Create: `public/assets/graphics/scenery/desert-stone.png`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the three locally owned PVGames source packs named in Global Constraints.
- Produces three transformed 256×256 RGBA texture swatches used only by scenery/terrain painters.

- [ ] **Step 1: Protect source archives**

Add to `.gitignore`:

```gitignore
.superpowers/
assets-source/
*.zip
*.rar
```

- [ ] **Step 2: Record the permitted-use text**

Copy the relevant PVGames readme terms into `docs/assets/PVGAMES-LICENSE.txt`,
including: commercial/non-commercial project use permitted; editing permitted;
raw or edited resource redistribution prohibited; attribution/source pack retained.

- [ ] **Step 3: Create the source ledger**

```json
{
  "license": "docs/assets/PVGAMES-LICENSE.txt",
  "outputs": [
    {
      "output": "public/assets/graphics/scenery/military-concrete.png",
      "pack": "Doomsday Tiles MilitaryBase.zip",
      "source": "Doomsday Tiles MilitaryBase/Building40_1.png",
      "transform": "repainted seamless concrete/roof swatch; no complete building retained"
    },
    {
      "output": "public/assets/graphics/scenery/rural-wall.png",
      "pack": "Doomsday Tiles Rural.zip",
      "source": "Doomsday Tiles Rural/Building10_1.png",
      "transform": "repainted seamless plaster/stone swatch; no complete building retained"
    },
    {
      "output": "public/assets/graphics/scenery/desert-stone.png",
      "pack": "Other Worlds Sands Tiles.zip",
      "source": "Other Worlds Sands Tiles/Arch1_1.png",
      "transform": "repainted seamless desert stone swatch; no complete arch retained"
    }
  ]
}
```

- [ ] **Step 4: Produce the three transformed swatches**

Each output must be 256×256 RGBA, seamless on all edges, free of complete source
objects, and color-corrected to the corresponding biome palette. Inspect each at
100% and tiled 3×3 before accepting it.

- [ ] **Step 5: Verify dimensions and repository contents**

Run:

```bash
file public/assets/graphics/scenery/*.png
git ls-files | rg '\.(zip|rar)$' && exit 1 || true
```

Expected: all outputs report 256×256 RGBA; no archive is tracked.

- [ ] **Step 6: Commit**

```bash
git add .gitignore docs/assets public/assets/graphics/scenery
git commit -m "assets: curate licensed biome texture swatches"
```

---

### Task 6: Painted player-helicopter vertical slice

**Files:**
- Create: `src/render/helicopter.ts`
- Create: `src/render/helicopter.test.ts`
- Create: `public/assets/graphics/player-heli.png`
- Modify: `src/render/assets.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `helicopterPose(vx, vy, facing)`, `shadowStyle(altitude)`, and player atlas frames.

- [ ] **Step 1: Write failing pose and shadow tests**

```ts
import { expect, it } from 'vitest';
import { helicopterPose, shadowStyle } from './helicopter';

it('selects braking separately from accelerating', () => {
  expect(helicopterPose(120, 0, 1)).toBe('accelerate');
  expect(helicopterPose(-120, 0, 1)).toBe('brake');
});
it('prioritizes strong climb and descent attitudes', () => {
  expect(helicopterPose(120, -100, 1)).toBe('climb');
  expect(helicopterPose(120, 100, 1)).toBe('descend');
});
it('makes low-altitude shadows darker and tighter', () => {
  expect(shadowStyle(10).alpha).toBeGreaterThan(shadowStyle(100).alpha);
  expect(shadowStyle(10).scale).toBeLessThan(shadowStyle(100).scale);
});
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run src/render/helicopter.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pose selection**

```ts
export type HelicopterPose = 'level' | 'accelerate' | 'brake' | 'climb' | 'descend';
export function helicopterPose(vx: number, vy: number, facing: 1 | -1): HelicopterPose {
  if (vy < -70) return 'climb';
  if (vy > 70) return 'descend';
  const forward = vx * facing;
  if (forward > 70) return 'accelerate';
  if (forward < -70) return 'brake';
  return 'level';
}
export function shadowStyle(altitude: number) {
  const t = Math.max(0, Math.min(1, altitude / 140));
  return { alpha: 0.34 - t * 0.22, scale: 0.55 + t * 0.65, blur: 2 + t * 8 };
}
```

- [ ] **Step 4: Create original player artwork**

Create `player-heli.png` as a transparent atlas with five 192×96 cells in one
row: `level`, `accelerate`, `brake`, `climb`, `descend`. Nose points right.
Each cell includes highlight, midtone, core shadow, canopy, skids, pods, and rotor
mast. Rotor disc and chin turret remain separate procedural renderer layers.

- [ ] **Step 5: Render the vertical slice**

Change `Renderer` to accept `LoadedAssets` as its third constructor argument and
pass the result of `await loadAssets(manifest)` from `main.ts`:

```ts
constructor(
  private ctx: CanvasRenderingContext2D,
  private sheet: Sheet,
  private assets: LoadedAssets,
) {}
```

Replace the generated player sprite draw with:

```ts
const pose = helicopterPose(pl.vx, pl.vy, pl.facing);
const frameX = ['level', 'accelerate', 'brake', 'climb', 'descend'].indexOf(pose) * 192;
this.drawAircraftShadow(world, pl.x, pl.y, cam, oy);
ctx.save();
ctx.translate((pl.x - cam) * 2, (pl.y + oy) * 2);
ctx.scale(pl.facing, 1);
ctx.drawImage(this.assets.player.heli, frameX, 0, 192, 96, -96, -48, 192, 96);
ctx.restore();
```

Scale all existing world-space drawing through one `ctx.setTransform(2, 0, 0, 2, 0, 0)`
world pass or equivalent helper; do not manually double simulation values in
gameplay code.

- [ ] **Step 6: Verify**

Run: `npx vitest run src/render/helicopter.test.ts && npm run build && npx vitest run`  
Manual: player faces the correct direction, turret aligns, aim is unchanged, and
shadow tightens near terrain/water.

- [ ] **Step 7: Commit**

```bash
git add src/render/helicopter.ts src/render/helicopter.test.ts src/render/assets.ts src/render/renderer.ts src/main.ts public/assets/graphics/player-heli.png
git commit -m "feat: add painted player helicopter vertical slice"
```

---

### Task 7: Smooth terrain painter and deterministic scenery

**Files:**
- Create: `src/render/scenery.ts`
- Create: `src/render/scenery.test.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/render/assets.ts`

**Interfaces:**
- Produces: `sceneryForTerrain(terrain, seed)` and focused terrain/background render passes.

- [ ] **Step 1: Write failing determinism and water-gating tests**

```ts
import { expect, it } from 'vitest';
import { sceneryForTerrain } from './scenery';
import { generateTerrain } from '../game/terrain';
import { mulberry32 } from '../core/rng';

it('places identical scenery for the same biome and seed', () => {
  const a = generateTerrain('coast', mulberry32(9));
  expect(sceneryForTerrain(a, 99)).toEqual(sceneryForTerrain(a, 99));
});
it('never places land scenery in water columns', () => {
  const t = generateTerrain('coast', mulberry32(4));
  for (const p of sceneryForTerrain(t, 4)) {
    expect(t.water[Math.floor(p.x / 8)]).toBe(false);
  }
});
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run src/render/scenery.test.ts`

- [ ] **Step 3: Implement deterministic placement**

```ts
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
```

- [ ] **Step 4: Split renderer passes**

Create private methods:

```ts
private drawBackground(world: World, cam: number, oy: number, t: number): void
private drawTerrain(world: World, cam: number, oy: number, t: number): void
private drawScenery(world: World, cam: number, oy: number): void
private drawWater(world: World, cam: number, oy: number, t: number): void
```

Render terrain as an interpolated path through existing surface samples, then add
a 2-pixel highlight edge and a darker face. Clip transformed texture swatches to
land paths at low alpha. Do not alter `Terrain.surface` or collision queries.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/render/scenery.test.ts && npm run build && npx vitest run`

```bash
git add src/render/scenery.ts src/render/scenery.test.ts src/render/renderer.ts src/render/assets.ts
git commit -m "feat: paint dimensional terrain and deterministic scenery"
```

---

### Task 8: Convert remaining units, weapons, and effects

**Files:**
- Create: `public/assets/graphics/enemies.png`
- Create: `public/assets/graphics/vehicles.png`
- Create: `public/assets/graphics/weapons.png`
- Create: `src/render/effects.ts`
- Create: `src/render/effects.test.ts`
- Modify: `src/render/assets.ts`
- Modify: `src/render/renderer.ts`

**Interfaces:**
- Produces complete original side-view atlases and quality-aware effect budgets.

- [ ] **Step 1: Write failing effect-budget tests**

```ts
import { expect, it } from 'vitest';
import { effectBudget } from './effects';

it('reduces cosmetics while retaining hit feedback', () => {
  expect(effectBudget('full')).toEqual({ particles: 320, debris: 80, haze: true, reflections: true });
  expect(effectBudget('minimum')).toEqual({ particles: 80, debris: 16, haze: false, reflections: false });
});
```

- [ ] **Step 2: Implement fixed tier budgets**

```ts
import type { QualityTier } from './quality';
export function effectBudget(tier: QualityTier) {
  if (tier === 'full') return { particles: 320, debris: 80, haze: true, reflections: true };
  if (tier === 'reduced') return { particles: 180, debris: 40, haze: true, reflections: false };
  return { particles: 80, debris: 16, haze: false, reflections: false };
}
```

- [ ] **Step 3: Create original atlases**

Create transparent side-view atlas frames for every current render key:

- Enemies: `scout`, `gunship`, `mchopper`, `patrol`, `hunter`, `missile`.
- Vehicles: `tank`, `aagun`, `gunboat`, `mine`.
- Weapons: `bullet`, `shot`, `flak`, `torpedo`, `sam`, `pmissile`, `charge`.

Every moving unit points right in source art and is flipped only by renderer
facing. Every frame includes a consistent upper-left highlight and lower-right
core shadow. Validate all keys against the runtime manifest before boot.

- [ ] **Step 4: Add quality-aware effects**

Refactor effect drawing into:

```ts
private drawShadows(world: World, cam: number, oy: number): void
private drawProjectiles(world: World, cam: number, oy: number): void
private drawParticles(world: World, cam: number, oy: number, tier: QualityTier): void
private drawGrading(world: World, tier: QualityTier): void
```

Add altitude shadows, missile trails, tracer streaks, rotor wash, land dust, water
spray, layered explosions, damage smoke, and restrained local flashes. Clamp the
number drawn using `effectBudget(tier)`; iterate newest-first so hit feedback wins.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/render/effects.test.ts && npm run typecheck && npm run build && npx vitest run`  
Manual: inspect every unit facing both directions and every projectile against
sea, coast, and inland backgrounds.

- [ ] **Step 6: Commit**

```bash
git add public/assets/graphics/enemies.png public/assets/graphics/vehicles.png public/assets/graphics/weapons.png src/render/assets.ts src/render/renderer.ts src/render/effects.ts src/render/effects.test.ts
git commit -m "feat: convert units weapons and effects to painted art"
```

---

### Task 9: Responsive HUD, safe-area touch controls, and reduced flash

**Files:**
- Create: `src/render/ui-layout.ts`
- Create: `src/render/ui-layout.test.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/core/input.ts`
- Modify: `index.html`

**Interfaces:**
- Produces `uiLayout(viewport, insets, touch)` in render coordinates.

- [ ] **Step 1: Write failing safe-area tests**

```ts
import { expect, it } from 'vitest';
import { uiLayout } from './ui-layout';

it('keeps phone touch controls inside safe areas', () => {
  const l = uiLayout(960, 540, { top: 0, right: 24, bottom: 34, left: 24 }, true);
  expect(l.move.x - l.move.r).toBeGreaterThanOrEqual(24);
  expect(l.fire.x + l.fire.r).toBeLessThanOrEqual(936);
  expect(l.drop.y + l.drop.r).toBeLessThanOrEqual(506);
});
```

- [ ] **Step 2: Implement layout**

```ts
import type { Insets } from './viewport';
export function uiLayout(w: number, h: number, i: Insets, touch: boolean) {
  const r = touch ? 54 : 38;
  return {
    hud: { x: i.left + 20, y: i.top + 20 },
    move: { x: i.left + r + 28, y: h - i.bottom - r - 24, r },
    fire: { x: w - i.right - r - 28, y: h - i.bottom - r - 94, r },
    drop: { x: w - i.right - r - 108, y: h - i.bottom - r - 18, r },
  };
}
```

- [ ] **Step 3: Render at high resolution**

Use proportional fonts and panels at 2× current HUD dimensions. Keep health,
charges, missiles, score, act/wave, objective text, upgrade cards, and touch
buttons inside `uiLayout`. Add CSS `prefers-reduced-motion` detection and pass a
`reducedFlash` flag that replaces full-screen flash with a short border pulse.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/render/ui-layout.test.ts src/core/input.test.ts && npm run build && npx vitest run`

```bash
git add src/render/ui-layout.ts src/render/ui-layout.test.ts src/render/renderer.ts src/core/input.ts index.html
git commit -m "feat: add responsive high-resolution HUD and touch controls"
```

---

### Task 10: Cross-device regression, performance gate, and documentation

**Files:**
- Create: `docs/testing/painted-graphics-playtest.md`
- Create: `docs/assets/README.md`
- Modify: `README.md`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes all prior tasks.
- Produces an approved vertical/full visual regression record and documented asset workflow.

- [ ] **Step 1: Add frame-time sampling to the render loop**

Instantiate one `QualityMonitor`; pass its tier into `Renderer.draw`. Sample only
render duration:

```ts
const renderStart = performance.now();
renderer.draw(world, state.phase, cards, elapsed, input.touchSeen, quality.tier);
quality.sample(performance.now() - renderStart);
```

- [ ] **Step 2: Document the playtest matrix**

`docs/testing/painted-graphics-playtest.md` must contain checkboxes for:

- Desktop 1920×1080 and 1366×768.
- Tablet landscape 1024×768.
- Landscape phone 844×390 with safe-area insets.
- Portrait phone 390×844 with full-field letterboxing.
- Sea, coast, and inland scenes.
- All player poses and both facing directions.
- Every enemy and projectile type.
- Mouse, keyboard, and touch aim alignment.
- Full, reduced, and minimum tiers.
- Resize, orientation, tab-hide/resume, and fullscreen.
- Reduced-flash behavior.
- Ten-minute heavy-combat frame-time observation.

- [ ] **Step 3: Document asset provenance**

`docs/assets/README.md` explains the ledger format, approved packs, prohibition on
source archives, transformation requirements, and how to add optional scenery.
Update the main README with the 960×540 responsive rendering and graphics quality
behavior.

- [ ] **Step 4: Run all automated gates**

Run:

```bash
npm run typecheck
npx vitest run
npm run build
git diff --check
git ls-files | rg '\.(zip|rar)$' && exit 1 || true
```

Expected: all checks PASS and no source archives are tracked.

- [ ] **Step 5: Complete manual and visual checks**

Run the development server, complete every checkbox in the playtest matrix, and
capture one screenshot for each biome at desktop, landscape phone, and portrait
phone. Reject the release if any gameplay object is obscured, input is offset,
the battlefield is cropped, or sustained combat cannot hold the target tier.

- [ ] **Step 6: Final review and commit**

Review the entire graphics diff for gameplay changes. Any change outside render,
asset-loading, input-coordinate conversion, viewport, documentation, or tests must
be removed or justified in a separate gameplay change.

```bash
git add README.md docs src/main.ts
git commit -m "docs: verify painted graphics across devices"
```
