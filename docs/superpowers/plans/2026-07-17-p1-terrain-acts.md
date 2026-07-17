# Terrain & Biome Acts Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Runs progress through biome acts (sea → coast for now) with solid terrain: heightfield collision, safe LZ landings, contact bombs on land, biome palettes, and act title cards.

**Architecture:** New pure modules `game/terrain.ts` (seeded heightfield, surface/water/LZ queries) and `game/biomes.ts` (biome data + act mapping). World gains act state and delegates all surface interaction to terrain queries. Renderer paints terrain silhouettes and per-biome palettes. Finale slot (4th wave of each act) is a bigger stub wave until Plan 3.

**Tech Stack:** Existing TS + Vite + Vitest + Canvas 2D. No new deps.

## Global Constraints (from spec)

- Act 1 stays exactly current difficulty: same seed → same wave 1–3 composition as today.
- Inland biome exists in terrain/biomes code but is NOT in the act rotation until Plan 2 (its enemy roster doesn't exist yet). `BIOME_ORDER = ['sea','coast']` for now.
- Terrain collision = 10 damage + bounce (same feel as waterline) except gentle LZ landings (|vy| < 40, |vx| < 30) which are safe.
- Depth charges: unchanged in water; detonate on contact with land surface.
- Between acts: heal 25% of max HP, regenerate terrain, 2s non-interactive title card.
- Upgrade pick after every cleared wave (v1 behavior preserved), finale slot included.

**Spec:** `docs/superpowers/specs/2026-07-17-acts-missions-design.md`
**Baseline:** main @ 935fd4b, 54 tests green. Branch: `acts-terrain`.

## File map

```
src/game/biomes.ts        — NEW: Biome type, BIOME_ORDER, biomeForAct, actTitle, PALETTES [tested]
src/game/terrain.ts       — NEW: generateTerrain, surfaceAt, isWater, onLZ, COL_W/COLS   [tested]
src/game/state.ts         — + 'actIntro' phase, toActIntro(), introDone()                [tested]
src/game/entities/physics.ts — stepDepthCharge gains `wet` param
src/game/world.ts         — act state, terrain collision, LZ landing, land bombs,
                            water-gated spawns, startAct                                  [tested]
src/render/renderer.ts    — terrain silhouettes, palettes, act title card, ACT HUD
src/main.ts               — act flow (intro timer, act transition on card pick)
```

---

### Task 0: Branch

- [ ] **Step 1:**
```bash
cd /Users/paulcooke/Documents/Projects/Bomber
git checkout -b acts-terrain
npx vitest run   # 54 passing baseline
```

---

### Task 1: Biomes module

**Files:**
- Create: `src/game/biomes.ts`
- Test: `src/game/biomes.test.ts`

**Interfaces:**
- Produces: `type Biome = 'sea'|'coast'|'inland'`; `BIOME_ORDER: Biome[]`; `biomeForAct(act: number): Biome`; `actTitle(act: number): string`; `interface BiomePalette { skyTop; skyBottom; seaTop; seaDeep; ground; groundDark: string }`; `PALETTES: Record<Biome, BiomePalette>`.

- [ ] **Step 1: Write the failing test**

`src/game/biomes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { biomeForAct, actTitle, PALETTES, BIOME_ORDER } from './biomes';

describe('biomeForAct', () => {
  it('cycles through BIOME_ORDER starting at act 1', () => {
    expect(biomeForAct(1)).toBe('sea');
    expect(biomeForAct(2)).toBe('coast');
    expect(biomeForAct(1 + BIOME_ORDER.length)).toBe('sea');
  });
});

describe('actTitle', () => {
  it('names the act and biome', () => {
    expect(actTitle(1)).toBe('ACT 1 — OPEN SEA');
    expect(actTitle(2)).toBe('ACT 2 — COASTAL STRIKE');
  });
});

describe('PALETTES', () => {
  it('has a full palette for every biome', () => {
    for (const b of ['sea', 'coast', 'inland'] as const) {
      const p = PALETTES[b];
      for (const k of ['skyTop', 'skyBottom', 'seaTop', 'seaDeep', 'ground', 'groundDark'] as const) {
        expect(p[k]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/biomes.test.ts` — Expected: FAIL, cannot resolve `./biomes`.

- [ ] **Step 3: Implement**

`src/game/biomes.ts`:
```ts
export type Biome = 'sea' | 'coast' | 'inland';

/** inland joins the rotation in Plan 2 when its ground/air roster exists */
export const BIOME_ORDER: Biome[] = ['sea', 'coast'];

export function biomeForAct(act: number): Biome {
  return BIOME_ORDER[(act - 1) % BIOME_ORDER.length];
}

const BIOME_NAMES: Record<Biome, string> = {
  sea: 'OPEN SEA',
  coast: 'COASTAL STRIKE',
  inland: 'INLAND ASSAULT',
};

export function actTitle(act: number): string {
  return `ACT ${act} — ${BIOME_NAMES[biomeForAct(act)]}`;
}

export interface BiomePalette {
  skyTop: string;
  skyBottom: string;
  seaTop: string;
  seaDeep: string;
  ground: string;
  groundDark: string;
}

export const PALETTES: Record<Biome, BiomePalette> = {
  sea:    { skyTop: '#2a4a9e', skyBottom: '#7ba6e0', seaTop: '#0e4a8a', seaDeep: '#03101f', ground: '#c8b078', groundDark: '#8a7550' },
  coast:  { skyTop: '#3a5aae', skyBottom: '#9ab8e8', seaTop: '#0e5a8a', seaDeep: '#052030', ground: '#c8b078', groundDark: '#8a7550' },
  inland: { skyTop: '#4a6a9e', skyBottom: '#a8c0d8', seaTop: '#0e4a8a', seaDeep: '#03101f', ground: '#5a7a4a', groundDark: '#3a5230' },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/biomes.test.ts` — PASS (3 tests). `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/biomes.ts src/game/biomes.test.ts
git commit -m "feat: biome definitions, act mapping, palettes"
```

---

### Task 2: Terrain module

**Files:**
- Create: `src/game/terrain.ts`
- Test: `src/game/terrain.test.ts`

**Interfaces:**
- Consumes: `Biome` from `./biomes`; `Rng` from `../core/rng`; consts.
- Produces: `COL_W = 8`; `COLS = ARENA_W / COL_W`; `interface LzSpan { x0: number; x1: number }`; `interface Terrain { biome: Biome; surface: number[]; water: boolean[]; lz: LzSpan[] }`; `generateTerrain(biome, rng): Terrain`; `surfaceAt(t, x): number`; `isWater(t, x): boolean`; `onLZ(t, x): boolean`.
- Contract: `surface[i]` is the collision surface y for column i — `WATERLINE` for water columns, ground height (smaller y = higher) for land. All surfaces within `[70, SEA_BOTTOM - 8]`.

- [ ] **Step 1: Write the failing test**

`src/game/terrain.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateTerrain, surfaceAt, isWater, onLZ, COLS, COL_W } from './terrain';
import { WATERLINE, SEA_BOTTOM, ARENA_W } from './consts';
import { mulberry32 } from '../core/rng';

describe('generateTerrain', () => {
  it('is deterministic for the same seed', () => {
    expect(generateTerrain('coast', mulberry32(7))).toEqual(generateTerrain('coast', mulberry32(7)));
  });
  it('sea is all water at the waterline', () => {
    const t = generateTerrain('sea', mulberry32(1));
    expect(t.water.every(w => w)).toBe(true);
    expect(t.surface.every(s => s === WATERLINE)).toBe(true);
    expect(t.lz).toHaveLength(0);
  });
  it('coast has water on the left, land with an LZ on the right', () => {
    const t = generateTerrain('coast', mulberry32(2));
    expect(t.water[0]).toBe(true);
    expect(t.water[COLS - 1]).toBe(false);
    expect(t.lz.length).toBeGreaterThanOrEqual(1);
  });
  it('LZ spans are flat', () => {
    const t = generateTerrain('coast', mulberry32(3));
    for (const s of t.lz) {
      const ys = [];
      for (let x = s.x0; x < s.x1; x += COL_W) ys.push(surfaceAt(t, x));
      expect(new Set(ys).size).toBe(1);
    }
  });
  it('inland has no water, two LZs, bounded heights', () => {
    const t = generateTerrain('inland', mulberry32(4));
    expect(t.water.some(w => w)).toBe(false);
    expect(t.lz).toHaveLength(2);
    for (const s of t.surface) {
      expect(s).toBeGreaterThanOrEqual(70);
      expect(s).toBeLessThanOrEqual(SEA_BOTTOM - 8);
    }
  });
  it('coast buildings rise well above the beach', () => {
    const t = generateTerrain('coast', mulberry32(5));
    expect(Math.min(...t.surface)).toBeLessThan(WATERLINE - 40);
  });
});

describe('queries', () => {
  it('clamp out-of-range x', () => {
    const t = generateTerrain('sea', mulberry32(1));
    expect(surfaceAt(t, -50)).toBe(WATERLINE);
    expect(surfaceAt(t, ARENA_W + 50)).toBe(WATERLINE);
    expect(isWater(t, -50)).toBe(true);
  });
  it('onLZ true inside a span, false outside', () => {
    const t = generateTerrain('coast', mulberry32(2));
    const s = t.lz[0];
    expect(onLZ(t, (s.x0 + s.x1) / 2)).toBe(true);
    expect(onLZ(t, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/terrain.test.ts` — FAIL, cannot resolve `./terrain`.

- [ ] **Step 3: Implement**

`src/game/terrain.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/terrain.test.ts` — PASS (8 tests). `npm run typecheck` clean.
Note: the "LZ spans are flat" test can catch the clamp un-flattening a pad — clamping is pointwise monotonic so equal heights stay equal; if the test fails, check pad flattening happens before clamp and uses a single rounded value.

- [ ] **Step 5: Commit**

```bash
git add src/game/terrain.ts src/game/terrain.test.ts
git commit -m "feat: seeded biome terrain with surface, water, and LZ queries"
```

---

### Task 3: actIntro phase

**Files:**
- Modify: `src/game/state.ts`
- Test: `src/game/state.test.ts` (append)

**Interfaces:**
- Produces: `Phase` union gains `'actIntro'`; `StateMachine.toActIntro(): void` (upgrade → actIntro); `StateMachine.introDone(): void` (actIntro → playing).

- [ ] **Step 1: Write the failing test** — append to `src/game/state.test.ts`:
```ts
  it('act intro flows upgrade → actIntro → playing', () => {
    const m = new StateMachine();
    m.start();
    m.waveCleared();
    m.toActIntro();
    expect(m.phase).toBe('actIntro');
    m.introDone();
    expect(m.phase).toBe('playing');
  });
  it('actIntro transitions are guarded', () => {
    const m = new StateMachine();
    m.toActIntro();
    expect(m.phase).toBe('menu');
    m.introDone();
    expect(m.phase).toBe('menu');
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/game/state.test.ts` — FAIL (toActIntro not a function).

- [ ] **Step 3: Implement** — in `src/game/state.ts`:

Change the Phase type:
```ts
export type Phase = 'menu' | 'playing' | 'upgrade' | 'actIntro' | 'gameover';
```
Add two methods to `StateMachine`:
```ts
  toActIntro(): void {
    if (this.phase === 'upgrade') this.phase = 'actIntro';
  }
  introDone(): void {
    if (this.phase === 'actIntro') this.phase = 'playing';
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/game/state.test.ts` — PASS (5 tests). `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/state.ts src/game/state.test.ts
git commit -m "feat: actIntro phase for act title cards"
```

---

### Task 4: World acts + terrain integration

**Files:**
- Modify: `src/game/entities/physics.ts` (stepDepthCharge wet param) + `src/game/entities/physics.test.ts`
- Modify: `src/game/world.ts`
- Test: `src/game/world.test.ts` (append)

**Interfaces:**
- Consumes: `generateTerrain/surfaceAt/isWater/onLZ/Terrain` from `./terrain`; `biomeForAct` from `./biomes`.
- Produces on `World`: `act: number` (starts 1); `waveInAct: number` (0 before first wave; finale slot = 4); `terrain: Terrain` (public, test-writable); `startAct(): void`; `get actComplete(): boolean` (waveInAct >= 4 && cleared). `stepDepthCharge(c, sinkSpeed, dt, wet: boolean)` — water drag only when `wet`.

- [ ] **Step 1: physics wet param (mechanical, do first)**

In `src/game/entities/physics.ts` change:
```ts
export function stepDepthCharge(c: DepthCharge, sinkSpeed: number, dt: number, wet = true): void {
  if (!wet || c.y < WATERLINE) {
    c.vy += AIR_GRAVITY * dt;
  } else {
    c.vy += (sinkSpeed - c.vy) * 4 * dt;
    c.vx *= Math.exp(-2 * dt);
  }
  c.x += c.vx * dt;
  c.y += c.vy * dt;
}
```
Existing physics tests keep passing (default wet=true). Add one test to `src/game/entities/physics.test.ts`:
```ts
  it('keeps falling under gravity over land (wet=false)', () => {
    const c = charge(WATERLINE + 10, 50);
    stepDepthCharge(c, 34, 1 / 60, false);
    expect(c.vy).toBeGreaterThan(50);
  });
```

- [ ] **Step 2: Write the failing world tests** — append inside `describe('World', ...)` in `src/game/world.test.ts` (add imports at top: `import { generateTerrain } from './terrain';` and extend the consts import with `SEA_BOTTOM` if not present):
```ts
  it('starts in act 1 sea with terrain and counts waves in act', () => {
    const w = new World(mulberry32(1));
    expect(w.act).toBe(1);
    expect(w.terrain.biome).toBe('sea');
    w.startWave();
    expect(w.waveInAct).toBe(1);
  });

  it('startAct advances biome, heals 25%, resets wave counter', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.hp = 40;
    w.startAct();
    expect(w.act).toBe(2);
    expect(w.terrain.biome).toBe('coast');
    expect(w.waveInAct).toBe(0);
    expect(w.player.hp).toBe(40 + 25);
    expect(w.charges.length).toBe(0);
  });

  it('actComplete after finale slot cleared', () => {
    const w = new World(mulberry32(1));
    for (let i = 0; i < 4; i++) { w.startWave(); w.subs.length = 0; }
    expect(w.waveInAct).toBe(4);
    expect(w.actComplete).toBe(true);
  });

  it('gentle touchdown on an LZ does no damage', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.terrain = generateTerrain('coast', mulberry32(2));
    const s = w.terrain.lz[0];
    const x = (s.x0 + s.x1) / 2;
    w.player.x = x;
    w.player.y = w.terrain.surface[Math.floor(x / 8)] - 7;
    w.player.vx = 0;
    w.player.vy = 20; // gentle descent
    const hp = w.player.hp;
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    expect(w.player.hp).toBe(hp);
    expect(w.player.vy).toBe(0);
  });

  it('crashing into a building damages the player', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.terrain = generateTerrain('coast', mulberry32(2));
    // find the tallest building column
    const iTall = w.terrain.surface.indexOf(Math.min(...w.terrain.surface));
    w.player.x = iTall * 8 + 4;
    w.player.y = w.terrain.surface[iTall] - 2;
    w.player.vy = 100; // fast
    const hp = w.player.hp;
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('bombs detonate on contact with land', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.terrain = generateTerrain('coast', mulberry32(2));
    const iLand = w.terrain.water.findIndex(v => !v) + 5;
    w.charges.push({ id: 991, x: iLand * 8 + 4, y: w.terrain.surface[iLand] - 4, vx: 0, vy: 60 });
    for (let i = 0; i < 20 && w.charges.length > 0; i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    }
    expect(w.charges.length).toBe(0);
    expect(w.rings.length).toBeGreaterThan(0); // blast happened
  });

  it('water enemies only spawn over water on the coast', () => {
    const w = new World(mulberry32(1));
    w.act = 2 as never; // silence readonly warnings if any — act is public number
    w.terrain = generateTerrain('coast', mulberry32(3));
    w.startWave();
    for (const s of w.subs) {
      if (s.kind !== 'gunboat') continue; // gunboat sits on surface — must be wet too
    }
    for (const s of w.subs) {
      expect(w.terrain.water[Math.max(0, Math.min(119, Math.floor(s.x / 8)))]).toBe(true);
    }
  });
```
(Note: `w.act = 2 as never` — `act` is a plain public number; write it directly as `w.act = 2` and drop the cast. The cast note exists only in case of lint complaints; prefer the plain assignment.)

- [ ] **Step 3: Run to verify failures**

Run: `npx vitest run src/game/world.test.ts` — FAIL (act/terrain/startAct missing).

- [ ] **Step 4: Implement world changes**

In `src/game/world.ts`:

a) Imports:
```ts
import { generateTerrain, surfaceAt, isWater, onLZ, type Terrain } from './terrain';
import { biomeForAct } from './biomes';
```

b) New fields + constructor init (constructor keeps `private rng: Rng` param):
```ts
  act = 1;
  waveInAct = 0;
  terrain: Terrain;
```
```ts
  constructor(private rng: Rng) {
    this.terrain = generateTerrain(biomeForAct(1), rng);
  }
```

c) `startWave()`: first line becomes
```ts
    this.wave++;
    this.waveInAct++;
    const budgetWave = this.waveInAct === 4 ? this.wave + 2 : this.wave; // finale stub: bigger wave
    for (const kind of composeWave(budgetWave, this.rng)) this.spawn(kind);
```
(replacing the old `this.wave++; for (...composeWave(this.wave...))` lines; sonar block unchanged.)

d) New members:
```ts
  get actComplete(): boolean {
    return this.waveInAct >= 4 && this.cleared;
  }

  startAct(): void {
    this.act++;
    this.waveInAct = 0;
    this.terrain = generateTerrain(biomeForAct(this.act), this.rng);
    this.player.hp = Math.min(this.stats.maxHp, this.player.hp + this.stats.maxHp * 0.25);
    this.player.x = VIEW_W / 2;
    this.player.y = 60;
    this.player.vx = 0;
    this.player.vy = 0;
    this.charges.length = 0;
    this.shots.length = 0;
    this.particles.length = 0;
    this.rings.length = 0;
    this.events.push('ping');
  }
```

e) `spawn()` — water gating. Replace the `x:` initializer with a resampled position; full new spawn:
```ts
  private spawn(kind: SpawnKind): void {
    let x = this.rng() * ARENA_W;
    for (let tries = 0; tries < 20 && !isWater(this.terrain, x); tries++) x = this.rng() * ARENA_W;
    const s: Sub = {
      id: this.nextId++, kind, hp: kind === 'gunboat' ? 24 : 1,
      x,
      y: kind === 'gunboat' ? WATERLINE - 3
        : WATERLINE + 20 + this.rng() * (SEA_BOTTOM - WATERLINE - 34),
      vx: 0, vy: 0,
      dir: this.rng() < 0.5 ? -1 : 1,
      fireTimer: 2 + this.rng() * 3,
      surfaceTimer: 3 + this.rng() * 4,
      surfaced: false,
      hitFlash: 0,
    };
    s.vx = SUB_SPEED[kind] * s.dir;
    if (kind === 'mine') s.vy = (this.rng() - 0.5) * 8;
    this.subs.push(s);
  }
```

f) `updatePlayer()` — replace the water-contact block:
```ts
    if (p.y > WATERLINE - 6) {
      p.y = WATERLINE - 6;
      p.vy = -140;
      this.damagePlayer(DAMAGE.water);
      this.events.push('splash');
      this.splashParticles(p.x);
    }
```
with terrain-aware contact:
```ts
    const surf = surfaceAt(this.terrain, p.x);
    if (p.y > surf - 6) {
      const gentle = onLZ(this.terrain, p.x) && Math.abs(p.vy) < 40 && Math.abs(p.vx) < 30;
      p.y = surf - 6;
      if (gentle) {
        p.vy = 0;
        p.vx *= 0.8;
      } else {
        p.vy = -140;
        this.damagePlayer(DAMAGE.water);
        if (isWater(this.terrain, p.x)) {
          this.events.push('splash');
          this.splashParticles(p.x);
        } else {
          this.events.push('hit');
          this.boomParticles(p.x, surf, 4);
        }
      }
    }
```

g) `updateCharges()` — make splash/sink/detonation terrain-aware. The loop body's first half becomes:
```ts
      const c = this.charges[i];
      const wet = isWater(this.terrain, c.x);
      const surf = surfaceAt(this.terrain, c.x);
      if (wet && c.y >= WATERLINE && c.y - c.vy * dt < WATERLINE) {
        this.events.push('splash');
        this.splashParticles(c.x);
      }
      stepDepthCharge(c, this.stats.sinkSpeed, dt, wet);
```
and the detonation condition becomes:
```ts
      if ((wet && c.y > WATERLINE && nearTarget) || (wet && c.y >= SEA_BOTTOM - 4) || (!wet && c.y >= surf - 2)) {
```
(magnetic-homing block unchanged; it just sits between these.)

h) `updateShot()` — terrain kills projectiles. In the bullet branch replace:
```ts
      if (p.y > WATERLINE) { p.age = p.life; return; }
```
with:
```ts
      const wetB = isWater(this.terrain, p.x);
      if ((wetB && p.y > WATERLINE) || (!wetB && p.y >= surfaceAt(this.terrain, p.x))) { p.age = p.life; return; }
```
And for enemy projectiles, immediately before the player-collision check add:
```ts
    if (!isWater(this.terrain, p.x) && p.y >= surfaceAt(this.terrain, p.x)) {
      p.age = p.life;
      this.boomParticles(p.x, p.y, 3);
      return;
    }
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run` — Expected: all pass (54 baseline + 1 physics + 7 world = 62; confirm actual count and report). `npm run typecheck` clean.
Existing-behavior guard: sea-act terrain is all-water at WATERLINE, so every changed path reduces to the old logic in act 1 — if any pre-existing test fails, the terrain defaulting is wrong.

- [ ] **Step 6: Commit**

```bash
git add src/game/world.ts src/game/world.test.ts src/game/entities/physics.ts src/game/entities/physics.test.ts
git commit -m "feat: act progression, terrain collision, LZ landings, land bombs"
```

---

### Task 5: Renderer terrain + palettes + act card

**Files:**
- Modify: `src/render/renderer.ts`

**Interfaces:**
- Consumes: `world.terrain` (surface/water/lz arrays), `world.act`, `world.waveInAct`, `PALETTES`/`actTitle` from `../game/biomes`, `COL_W/COLS` from `../game/terrain`, `Phase` value `'actIntro'`.

- [ ] **Step 1: Implement** (browser-visual; no unit tests, playtest in Task 7)

In `src/render/renderer.ts`:

a) Add imports:
```ts
import { PALETTES, actTitle } from '../game/biomes';
import { COL_W, COLS } from '../game/terrain';
```

b) In `draw()`, at the top after `const oy = shy;` add:
```ts
    const pal = PALETTES[world.terrain.biome];
```

c) Sky gradient: replace the two hardcoded stops with `pal.skyTop` / `pal.skyBottom`. Sea gradient stops: `pal.seaTop` at 0, keep `'#082d58'` mid stop for sea biome feel but bottom becomes `pal.seaDeep`.

d) After the sea gradient fill and BEFORE the light rays, draw terrain silhouettes:
```ts
    // terrain silhouette (land columns cover the sea gradient)
    for (let i = 0; i < COLS; i++) {
      if (world.terrain.water[i]) continue;
      const x = Math.round(i * COL_W - cam);
      if (x < -COL_W || x > VIEW_W) continue;
      const s = Math.round(world.terrain.surface[i] + oy);
      ctx.fillStyle = pal.ground;
      ctx.fillRect(x, s, COL_W, VIEW_H - s);
      ctx.fillStyle = pal.groundDark;
      ctx.fillRect(x, Math.min(VIEW_H, s + 14), COL_W, Math.max(0, VIEW_H - s - 14));
    }
    // LZ pads
    for (const span of world.terrain.lz) {
      const x0 = Math.round(span.x0 - cam);
      const w = span.x1 - span.x0;
      if (x0 + w < 0 || x0 > VIEW_W) continue;
      const y = Math.round(surfaceLike(world, span.x0) + oy);
      ctx.fillStyle = '#d8dde4';
      ctx.fillRect(x0, y - 1, w, 2);
      this.text('H', x0 + w / 2, y - 4, 7, '#12233d', true);
    }
```
where `surfaceLike` is a tiny private helper (terrain surface at world x):
```ts
  private surfaceYAt(world: World, x: number): number {
    return world.terrain.surface[Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_W)))];
  }
```
(use `this.surfaceYAt(world, span.x0)` — the `surfaceLike` name above is illustrative; use `surfaceYAt` consistently.)

e) Waterline wave strip: wrap the per-x loop body in a water check so waves only draw over water columns:
```ts
    for (let x = 0; x < VIEW_W; x += 4) {
      const col = Math.max(0, Math.min(COLS - 1, Math.floor((x + cam) / COL_W)));
      if (!world.terrain.water[col]) continue;
      ...existing wave drawing...
    }
```
Same water-gate for the light rays and sun glare: skip drawing rays/glare entirely when `world.terrain.biome === 'inland'` (no water anywhere); for coast they remain (they sit over the water half visually — acceptable).

f) HUD wave text: replace `WAVE ${world.wave}` with:
```ts
      ctx.fillText(`ACT ${world.act} · ${world.waveInAct >= 4 ? 'FINALE' : 'WAVE ' + world.waveInAct}`, VIEW_W - 8, 12);
```

g) Act intro overlay — add to the phase overlays at the bottom of `draw()`:
```ts
    if (phase === 'actIntro') this.actIntro(world);
```
and the method:
```ts
  private actIntro(world: World): void {
    this.overlay();
    this.text(actTitle(world.act), VIEW_W / 2, 125, 16, '#ffd866', true);
    this.text('get ready', VIEW_W / 2, 150, 8, '#9fd8ff', true);
  }
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npx vitest run` — clean, all pass.

- [ ] **Step 3: Commit**

```bash
git add src/render/renderer.ts
git commit -m "feat: terrain silhouettes, biome palettes, act HUD and title card"
```

---

### Task 6: Main act flow

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `world.actComplete`, `world.startAct()`, `state.toActIntro()`, `state.introDone()`.

- [ ] **Step 1: Implement**

In `src/main.ts`:

a) Add module state near `let cards`:
```ts
let introT = 0;
```

b) `pickCard(i)` — replace the tail (`state.cardPicked(); world.startWave();`) with:
```ts
  if (world.actComplete) {
    world.startAct();
    state.toActIntro();
    introT = 2;
  } else {
    state.cardPicked();
    world.startWave();
  }
```
(keep the heal line and `audio.handle('ui')` as they are).

c) In `update(dt)` add an actIntro branch before the playing code:
```ts
  if (state.phase === 'actIntro') {
    introT -= dt;
    input.poll();
    if (introT <= 0) {
      state.introDone();
      world.startWave();
    }
    return;
  }
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npx vitest run && npm run build` — all green.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: act transition flow with intro timer"
```

---

### Task 7: Playtest + polish

- [ ] **Step 1: Manual verification (preview tools)**

1. Act 1 plays exactly like current game (sea, same difficulty).
2. Clearing wave 4 (finale slot — noticeably bigger) then picking a card shows `ACT 2 — COASTAL STRIKE` title card for 2s, then coast terrain: water left, beach + buildings right, palette shift.
3. HUD shows `ACT n · WAVE m` and `FINALE` on wave 4.
4. Flying into a building: damage + bounce + thud particles. Gentle descent onto the helipad (H mark): no damage, heli rests.
5. Bombs dropped over land explode on the ground; over water they sink as before.
6. Subs/gunboats/mines only appear over the water half on coast acts.
7. Player healed ~25% between acts.
8. Bullets/flak stop at terrain.
9. No console errors.

Fix findings with `fix:` commits.

- [ ] **Step 2: Suite + build green, then hand off**

Run: `npx vitest run && npm run typecheck && npm run build`.
Plan 2 (enemies & missiles) follows on a fresh branch after this merges.

---

## Self-review

- **Spec coverage (plan-1 slice):** act cycling + scaling stub (T4c budgetWave), heal + regen + title card (T4d, T5g, T6), terrain gen all 3 biomes incl. LZ/plateau (T2), collision + gentle landing (T4f), land bombs (T4g), water-gated spawns (T4e), projectile-terrain (T4h), palettes + silhouettes + HUD (T5), act-1 regression guard (T4 step 5 note + unchanged sea terrain). Inland rotation deferred to Plan 2 per Global Constraints. ✓
- **Placeholders:** none; full code each step. ✓
- **Type consistency:** `Terrain {biome,surface,water,lz}` consistent across T2/T4/T5; `stepDepthCharge(..., wet)` matches T4a/T4g; `actComplete`/`startAct`/`toActIntro`/`introDone` names consistent T4/T6/T3; renderer helper named `surfaceYAt` (single name after inline note). ✓
