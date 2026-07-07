# Sea Bomber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browser arcade roguelite: helicopter over open sea depth-charges submarines through escalating waves with upgrade-card picks between waves.

**Architecture:** TypeScript + Vite + Canvas 2D + Web Audio, zero runtime deps. Fixed-timestep 60 Hz update fully separated from rendering; internal 480×270 canvas integer-scaled with smoothing off. Pure-logic modules (collision, waves, upgrades, physics, scoring, state machine) are unit-tested with Vitest; input/render/audio are thin and verified by play.

**Tech Stack:** TypeScript 5, Vite 6, Vitest 2, Canvas 2D, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-07-07-sea-bomber-remake-design.md`

## File structure

```
index.html                     — canvas + css, entry script
package.json / tsconfig.json   — toolchain
src/
  main.ts                      — boot, resize/visibility, phase orchestration, UI taps
  core/rng.ts                  — mulberry32 seeded RNG helpers          [tested]
  core/loop.ts                 — FixedStepper + rAF Loop                [tested]
  core/input.ts                — keyboard+touch → Intent
  core/audio.ts                — procedural SFX + music scheduler
  game/consts.ts               — VIEW_W/H, ARENA_W, WATERLINE
  game/collision.ts            — circle overlap, chain blast resolve    [tested]
  game/upgrades.ts             — PlayerStats, card pool, drawCards      [tested]
  game/waves.ts                — budget + composition                   [tested]
  game/state.ts                — phase machine                          [tested]
  game/world.ts                — entities, AI, scoring, events          [scoring tested]
  game/entities/types.ts       — entity interfaces
  game/entities/physics.ts     — charge sink, homing steer, depth clamp [tested]
  render/sprites.ts            — generated pixel-art sheet
  render/renderer.ts           — layered draw + HUD + overlays
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/game/consts.ts`

- [ ] **Step 1: Write config + entry files**

`package.json`:
```json
{
  "name": "sea-bomber",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
  <title>Sea Bomber</title>
  <style>
    html, body { margin: 0; height: 100%; background: #06101e; overflow: hidden; }
    body { display: flex; align-items: center; justify-content: center; }
    canvas { image-rendering: pixelated; touch-action: none; }
  </style>
</head>
<body>
  <canvas id="game"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/game/consts.ts`:
```ts
export const VIEW_W = 480;
export const VIEW_H = 270;
export const ARENA_W = 960;
export const WATERLINE = 148;
export const SEA_BOTTOM = VIEW_H;
```

`src/main.ts` (placeholder boot, replaced in Task 12):
```ts
import { VIEW_W, VIEW_H, WATERLINE } from './game/consts';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#3d6fd6';
ctx.fillRect(0, 0, VIEW_W, WATERLINE);
ctx.fillStyle = '#0b2a52';
ctx.fillRect(0, WATERLINE, VIEW_W, VIEW_H - WATERLINE);
```

- [ ] **Step 2: Install and verify**

Run: `npm install && npm run typecheck && npx vitest run --passWithNoTests`
Expected: install succeeds, typecheck clean, vitest reports "no test files found" and exits 0.

- [ ] **Step 3: Verify dev server**

Run: `npm run dev` briefly (or via preview tool). Expected: page shows blue sky over dark sea split at waterline.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.json index.html src/
git commit -m "chore: scaffold Vite + TS + Vitest project with canvas boot"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `src/core/rng.ts`
- Test: `src/core/rng.test.ts`

- [ ] **Step 1: Write the failing test**

`src/core/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mulberry32, pick } from './rng';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('produces values in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('pick', () => {
  it('returns an element of the array', () => {
    const r = mulberry32(3);
    for (let i = 0; i < 50; i++) expect([1, 2, 3]).toContain(pick(r, [1, 2, 3]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/rng.test.ts`
Expected: FAIL — cannot resolve `./rng`.

- [ ] **Step 3: Implement**

`src/core/rng.ts`:
```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/rng.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/rng.ts src/core/rng.test.ts
git commit -m "feat: seeded mulberry32 RNG"
```

---

### Task 3: Fixed-timestep loop

**Files:**
- Create: `src/core/loop.ts`
- Test: `src/core/loop.test.ts`

- [ ] **Step 1: Write the failing test**

`src/core/loop.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { FixedStepper, STEP } from './loop';

describe('FixedStepper', () => {
  it('runs one step per 1/60s of elapsed time', () => {
    const s = new FixedStepper();
    expect(s.advance(STEP * 3)).toBe(3);
  });
  it('accumulates fractional remainders', () => {
    const s = new FixedStepper();
    expect(s.advance(STEP * 0.6)).toBe(0);
    expect(s.advance(STEP * 0.6)).toBe(1);
  });
  it('clamps huge gaps (tab hidden) to maxFrame', () => {
    const s = new FixedStepper();
    expect(s.advance(10)).toBeLessThanOrEqual(Math.ceil(0.25 / STEP));
  });
  it('exposes interpolation alpha in [0,1)', () => {
    const s = new FixedStepper();
    s.advance(STEP * 1.5);
    expect(s.alpha).toBeGreaterThanOrEqual(0);
    expect(s.alpha).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/loop.test.ts` — Expected: FAIL, cannot resolve `./loop`.

- [ ] **Step 3: Implement**

`src/core/loop.ts`:
```ts
export const STEP = 1 / 60;
const MAX_FRAME = 0.25;

export class FixedStepper {
  private acc = 0;
  constructor(private step = STEP, private maxFrame = MAX_FRAME) {}

  advance(dt: number): number {
    this.acc += Math.min(dt, this.maxFrame);
    let n = 0;
    while (this.acc >= this.step) {
      this.acc -= this.step;
      n++;
    }
    return n;
  }

  get alpha(): number {
    return this.acc / this.step;
  }
}

export class Loop {
  private stepper = new FixedStepper();
  private last = 0;
  private raf = 0;
  running = false;

  constructor(
    private update: (dt: number) => void,
    private render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = (now - this.last) / 1000;
      this.last = now;
      const n = this.stepper.advance(dt);
      for (let i = 0; i < n; i++) this.update(STEP);
      this.render(this.stepper.alpha);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/loop.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/loop.ts src/core/loop.test.ts
git commit -m "feat: fixed-timestep stepper and rAF loop with dt clamp"
```

---

### Task 4: Collision + chain blasts

**Files:**
- Create: `src/game/collision.ts`
- Test: `src/game/collision.test.ts`

- [ ] **Step 1: Write the failing test**

`src/game/collision.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { circlesOverlap, resolveBlasts } from './collision';

describe('circlesOverlap', () => {
  it('detects overlap', () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 })).toBe(true);
  });
  it('detects touch as overlap', () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 10, y: 0, r: 5 })).toBe(true);
  });
  it('rejects separation', () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 11, y: 0, r: 5 })).toBe(false);
  });
});

describe('resolveBlasts', () => {
  it('hits targets inside radius, misses outside', () => {
    const hit = resolveBlasts([{ x: 0, y: 0, r: 20 }], [
      { id: 1, x: 10, y: 0, r: 5 },
      { id: 2, x: 40, y: 0, r: 5 },
    ]);
    expect(hit).toEqual(new Set([1]));
  });
  it('chains through mines', () => {
    // blast reaches mine 1 only; mine 1 chain reaches mine 2; mine 2 chain reaches sub 3
    const hit = resolveBlasts([{ x: 0, y: 0, r: 15 }], [
      { id: 1, x: 12, y: 0, r: 3, chainRadius: 30 },
      { id: 2, x: 40, y: 0, r: 3, chainRadius: 30 },
      { id: 3, x: 65, y: 0, r: 5 },
    ]);
    expect(hit).toEqual(new Set([1, 2, 3]));
  });
  it('terminates on mutually-in-range mines (each detonates once)', () => {
    const mines = [0, 10, 20].map((x, i) => ({ id: i, x, y: 0, r: 3, chainRadius: 50 }));
    const hit = resolveBlasts([{ x: 0, y: 0, r: 5 }], mines);
    expect(hit.size).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/collision.test.ts` — Expected: FAIL, cannot resolve `./collision`.

- [ ] **Step 3: Implement**

`src/game/collision.ts`:
```ts
export interface Circle { x: number; y: number; r: number }

export function circlesOverlap(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x, dy = a.y - b.y, rr = a.r + b.r;
  return dx * dx + dy * dy <= rr * rr;
}

export interface Blast { x: number; y: number; r: number }
export interface BlastTarget extends Circle {
  id: number;
  /** set for mines: detonating them adds a new blast of this radius */
  chainRadius?: number;
}

/** Resolve blasts including mine chain reactions. Each target is hit at most once. */
export function resolveBlasts(initial: Blast[], targets: BlastTarget[]): Set<number> {
  const hit = new Set<number>();
  const queue: Blast[] = [...initial];
  while (queue.length > 0) {
    const b = queue.pop()!;
    for (const t of targets) {
      if (hit.has(t.id)) continue;
      if (!circlesOverlap({ x: b.x, y: b.y, r: b.r }, t)) continue;
      hit.add(t.id);
      if (t.chainRadius) queue.push({ x: t.x, y: t.y, r: t.chainRadius });
    }
  }
  return hit;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/collision.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/collision.ts src/game/collision.test.ts
git commit -m "feat: circle collision and chain-reaction blast resolution"
```

---

### Task 5: PlayerStats + upgrade cards

**Files:**
- Create: `src/game/upgrades.ts`
- Test: `src/game/upgrades.test.ts`

- [ ] **Step 1: Write the failing test**

`src/game/upgrades.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defaultStats, CARD_POOL, drawCards } from './upgrades';
import { mulberry32 } from '../core/rng';

describe('drawCards', () => {
  it('returns 3 cards with distinct ids', () => {
    const cards = drawCards(mulberry32(1), new Set());
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map(c => c.id)).size).toBe(3);
  });
  it('never offers an owned non-repeatable card', () => {
    const owned = new Set(CARD_POOL.filter(c => !c.repeatable).map(c => c.id));
    for (let seed = 0; seed < 20; seed++) {
      for (const c of drawCards(mulberry32(seed), owned)) {
        expect(c.repeatable).toBe(true);
      }
    }
  });
});

describe('stat application', () => {
  it('repeatable cards stack', () => {
    const s = defaultStats();
    const blast = CARD_POOL.find(c => c.id === 'blast')!;
    const r0 = s.blastRadius;
    blast.apply(s);
    blast.apply(s);
    expect(s.blastRadius).toBeCloseTo(r0 * 1.3 * 1.3);
  });
  it('flag cards set their flag', () => {
    const s = defaultStats();
    CARD_POOL.find(c => c.id === 'magnet')!.apply(s);
    expect(s.magnetic).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/upgrades.test.ts` — Expected: FAIL, cannot resolve `./upgrades`.

- [ ] **Step 3: Implement**

`src/game/upgrades.ts`:
```ts
import type { Rng } from '../core/rng';

export interface PlayerStats {
  maxHp: number;
  accel: number;
  blastRadius: number;
  maxCharges: number;
  sinkSpeed: number;
  dualDrop: boolean;
  magnetic: boolean;
  sonar: boolean;
  pointDefense: boolean;
}

export function defaultStats(): PlayerStats {
  return {
    maxHp: 100,
    accel: 340,
    blastRadius: 26,
    maxCharges: 2,
    sinkSpeed: 34,
    dualDrop: false,
    magnetic: false,
    sonar: false,
    pointDefense: false,
  };
}

export interface UpgradeCard {
  id: string;
  name: string;
  desc: string;
  repeatable: boolean;
  apply: (s: PlayerStats) => void;
}

export const CARD_POOL: UpgradeCard[] = [
  { id: 'blast',  name: 'Bigger Boom',      desc: '+30% blast radius',        repeatable: true,  apply: s => { s.blastRadius *= 1.3; } },
  { id: 'charge', name: 'Extra Rack',       desc: '+1 charge in flight',      repeatable: true,  apply: s => { s.maxCharges += 1; } },
  { id: 'sink',   name: 'Lead Casing',      desc: '+40% sink speed',          repeatable: true,  apply: s => { s.sinkSpeed *= 1.4; } },
  { id: 'engine', name: 'Turbo Engine',     desc: '+25% thrust',              repeatable: true,  apply: s => { s.accel *= 1.25; } },
  { id: 'armor',  name: 'Armor Plating',    desc: '+30 max HP',               repeatable: true,  apply: s => { s.maxHp += 30; } },
  { id: 'dual',   name: 'Dual Drop',        desc: 'Two charges per drop',     repeatable: false, apply: s => { s.dualDrop = true; } },
  { id: 'magnet', name: 'Magnetic Charges', desc: 'Charges curve to subs',    repeatable: false, apply: s => { s.magnetic = true; } },
  { id: 'sonar',  name: 'Sonar Ping',       desc: 'Subs outlined regularly',  repeatable: false, apply: s => { s.sonar = true; } },
  { id: 'pd',     name: 'Point Defense',    desc: 'Auto-clips near missiles', repeatable: false, apply: s => { s.pointDefense = true; } },
];

export function drawCards(rng: Rng, owned: ReadonlySet<string>, n = 3): UpgradeCard[] {
  const pool = CARD_POOL.filter(c => c.repeatable || !owned.has(c.id));
  const out: UpgradeCard[] = [];
  while (out.length < n && pool.length > 0) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/upgrades.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/upgrades.ts src/game/upgrades.test.ts
git commit -m "feat: player stats and upgrade card pool"
```

---

### Task 6: Wave composition

**Files:**
- Create: `src/game/waves.ts`
- Test: `src/game/waves.test.ts`

- [ ] **Step 1: Write the failing test**

`src/game/waves.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { composeWave, waveBudget, COST, UNLOCK, type SpawnKind } from './waves';
import { mulberry32 } from '../core/rng';

describe('waveBudget', () => {
  it('scales with wave number', () => {
    expect(waveBudget(1)).toBe(12);
    expect(waveBudget(5)).toBeGreaterThan(waveBudget(4));
  });
});

describe('composeWave', () => {
  it('is deterministic for the same seed', () => {
    expect(composeWave(6, mulberry32(9))).toEqual(composeWave(6, mulberry32(9)));
  });
  it('never exceeds the budget', () => {
    for (let w = 1; w <= 10; w++) {
      const spent = composeWave(w, mulberry32(w))
        .reduce((sum, k) => sum + COST[k], 0);
      expect(spent).toBeLessThanOrEqual(waveBudget(w));
    }
  });
  it('only spawns unlocked kinds', () => {
    for (let w = 1; w <= 10; w++) {
      for (const k of composeWave(w, mulberry32(100 + w)) as SpawnKind[]) {
        expect(UNLOCK[k]).toBeLessThanOrEqual(w);
      }
    }
  });
  it('wave 1 is patrol subs only', () => {
    expect(new Set(composeWave(1, mulberry32(5)))).toEqual(new Set(['patrol']));
  });
  it('spawns at least one enemy every wave', () => {
    for (let w = 1; w <= 10; w++) {
      expect(composeWave(w, mulberry32(w)).length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/waves.test.ts` — Expected: FAIL, cannot resolve `./waves`.

- [ ] **Step 3: Implement**

`src/game/waves.ts`:
```ts
import type { Rng } from '../core/rng';

export type SpawnKind = 'patrol' | 'hunter' | 'missile' | 'gunboat' | 'mine';

export const COST: Record<SpawnKind, number> = {
  patrol: 2, mine: 2, hunter: 4, gunboat: 5, missile: 6,
};

export const UNLOCK: Record<SpawnKind, number> = {
  patrol: 1, mine: 2, hunter: 2, gunboat: 3, missile: 4,
};

export function waveBudget(wave: number): number {
  return 8 + wave * 4;
}

export function composeWave(wave: number, rng: Rng): SpawnKind[] {
  const kinds = (Object.keys(COST) as SpawnKind[]).filter(k => UNLOCK[k] <= wave);
  let budget = waveBudget(wave);
  const out: SpawnKind[] = [];
  for (;;) {
    const afford = kinds.filter(k => COST[k] <= budget);
    if (afford.length === 0) break;
    const k = afford[Math.floor(rng() * afford.length)];
    out.push(k);
    budget -= COST[k];
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/waves.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/waves.ts src/game/waves.test.ts
git commit -m "feat: budget-based wave composition with unlock gating"
```

---

### Task 7: Entity types + physics

**Files:**
- Create: `src/game/entities/types.ts`, `src/game/entities/physics.ts`
- Test: `src/game/entities/physics.test.ts`

- [ ] **Step 1: Write entity types (no test — interfaces only)**

`src/game/entities/types.ts`:
```ts
import type { SpawnKind } from '../waves';

export interface Entity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Sub extends Entity {
  kind: SpawnKind;
  hp: number;
  dir: 1 | -1;
  fireTimer: number;
  surfaceTimer: number;
  surfaced: boolean;
}

export type DepthCharge = Entity;

export type ProjectileType = 'torpedo' | 'sam' | 'flak' | 'bullet';

export interface Projectile extends Entity {
  ptype: ProjectileType;
  age: number;
  life: number;
  damage: number;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  iframes: number;
  facing: 1 | -1;
  fireCd: number;
  pdCd: number;
}
```

- [ ] **Step 2: Write the failing physics test**

`src/game/entities/physics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { stepDepthCharge, steerHoming, clampSubDepth } from './physics';
import { WATERLINE, SEA_BOTTOM } from '../consts';
import type { DepthCharge, Projectile, Sub } from './types';

const charge = (y: number, vy = 0): DepthCharge => ({ id: 1, x: 0, y, vx: 0, vy });

describe('stepDepthCharge', () => {
  it('accelerates downward above water', () => {
    const c = charge(50);
    stepDepthCharge(c, 34, 1 / 60);
    expect(c.vy).toBeGreaterThan(0);
  });
  it('converges to terminal sink speed underwater', () => {
    const c = charge(WATERLINE + 10, 200);
    for (let i = 0; i < 600; i++) stepDepthCharge(c, 34, 1 / 60);
    expect(c.vy).toBeCloseTo(34, 0);
  });
});

describe('steerHoming', () => {
  it('caps turn rate per step', () => {
    const p: Projectile = { id: 1, x: 0, y: 0, vx: 100, vy: 0, ptype: 'torpedo', age: 0, life: 5, damage: 20 };
    steerHoming(p, -100, 0, 100, 2.5, 1 / 60); // target directly behind
    const angle = Math.abs(Math.atan2(p.vy, p.vx));
    expect(angle).toBeLessThanOrEqual(2.5 / 60 + 1e-9);
    expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(100, 5);
  });
});

describe('clampSubDepth', () => {
  const sub = (y: number, vy: number): Sub =>
    ({ id: 1, x: 0, y, vx: 0, vy, kind: 'patrol', hp: 1, dir: 1, fireTimer: 0, surfaceTimer: 0, surfaced: false });
  it('bounces off the waterline ceiling', () => {
    const s = sub(WATERLINE + 2, -10);
    clampSubDepth(s);
    expect(s.y).toBeGreaterThanOrEqual(WATERLINE + 14);
    expect(s.vy).toBeGreaterThan(0);
  });
  it('bounces off the sea floor', () => {
    const s = sub(SEA_BOTTOM - 2, 10);
    clampSubDepth(s);
    expect(s.y).toBeLessThanOrEqual(SEA_BOTTOM - 10);
    expect(s.vy).toBeLessThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/game/entities/physics.test.ts` — Expected: FAIL, cannot resolve `./physics`.

- [ ] **Step 4: Implement**

`src/game/entities/physics.ts`:
```ts
import { WATERLINE, SEA_BOTTOM } from '../consts';
import type { DepthCharge, Projectile, Sub } from './types';

const AIR_GRAVITY = 320;

export function stepDepthCharge(c: DepthCharge, sinkSpeed: number, dt: number): void {
  if (c.y < WATERLINE) {
    c.vy += AIR_GRAVITY * dt;
  } else {
    c.vy += (sinkSpeed - c.vy) * 4 * dt;
    c.vx *= Math.exp(-2 * dt);
  }
  c.x += c.vx * dt;
  c.y += c.vy * dt;
}

export function steerHoming(
  p: Projectile, tx: number, ty: number,
  speed: number, turnRate: number, dt: number,
): void {
  const cur = Math.atan2(p.vy, p.vx);
  const want = Math.atan2(ty - p.y, tx - p.x);
  let d = want - cur;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const max = turnRate * dt;
  const a = cur + Math.max(-max, Math.min(max, d));
  p.vx = Math.cos(a) * speed;
  p.vy = Math.sin(a) * speed;
}

export function clampSubDepth(s: Sub): void {
  const top = WATERLINE + 14;
  const bot = SEA_BOTTOM - 10;
  if (s.y < top) { s.y = top; s.vy = Math.abs(s.vy); }
  if (s.y > bot) { s.y = bot; s.vy = -Math.abs(s.vy); }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/game/entities/physics.test.ts` — Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/game/entities/
git commit -m "feat: entity types and pure physics (sink, homing cap, depth clamp)"
```

---

### Task 8: Phase state machine

**Files:**
- Create: `src/game/state.ts`
- Test: `src/game/state.test.ts`

- [ ] **Step 1: Write the failing test**

`src/game/state.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { StateMachine } from './state';

describe('StateMachine', () => {
  it('follows menu → playing → upgrade → playing', () => {
    const m = new StateMachine();
    expect(m.phase).toBe('menu');
    m.start();
    expect(m.phase).toBe('playing');
    m.waveCleared();
    expect(m.phase).toBe('upgrade');
    m.cardPicked();
    expect(m.phase).toBe('playing');
  });
  it('death only ends a live run, restart returns to menu', () => {
    const m = new StateMachine();
    m.died();
    expect(m.phase).toBe('menu'); // ignored
    m.start();
    m.died();
    expect(m.phase).toBe('gameover');
    m.toMenu();
    expect(m.phase).toBe('menu');
  });
  it('ignores illegal transitions', () => {
    const m = new StateMachine();
    m.waveCleared();
    m.cardPicked();
    expect(m.phase).toBe('menu');
    m.start();
    m.start();
    expect(m.phase).toBe('playing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/state.test.ts` — Expected: FAIL, cannot resolve `./state`.

- [ ] **Step 3: Implement**

`src/game/state.ts`:
```ts
export type Phase = 'menu' | 'playing' | 'upgrade' | 'gameover';

export class StateMachine {
  phase: Phase = 'menu';

  start(): void {
    if (this.phase === 'menu') this.phase = 'playing';
  }
  waveCleared(): void {
    if (this.phase === 'playing') this.phase = 'upgrade';
  }
  cardPicked(): void {
    if (this.phase === 'upgrade') this.phase = 'playing';
  }
  died(): void {
    if (this.phase === 'playing') this.phase = 'gameover';
  }
  toMenu(): void {
    if (this.phase === 'gameover') this.phase = 'menu';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/state.test.ts` — Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/state.ts src/game/state.test.ts
git commit -m "feat: run phase state machine"
```

---

### Task 9: World simulation

**Files:**
- Create: `src/game/world.ts`
- Test: `src/game/world.test.ts`

- [ ] **Step 1: Write the failing test**

`src/game/world.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { World, scoreBlast, BASE_SCORE } from './world';
import { WATERLINE } from './consts';
import { mulberry32 } from '../core/rng';

describe('scoreBlast', () => {
  it('adds depth bonus per kill', () => {
    const pts = scoreBlast([{ kind: 'patrol', y: WATERLINE + 80 }]);
    expect(pts).toBe(BASE_SCORE.patrol + 80);
  });
  it('multiplies by kill count for multi-kills', () => {
    const one = scoreBlast([{ kind: 'patrol', y: WATERLINE + 10 }]);
    const two = scoreBlast([
      { kind: 'patrol', y: WATERLINE + 10 },
      { kind: 'patrol', y: WATERLINE + 10 },
    ]);
    expect(two).toBe(one * 2 * 2); // (sum of 2 kills) × 2 multiplier
  });
});

describe('World', () => {
  it('wave 1 spawns only patrol subs and is not cleared', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    expect(w.wave).toBe(1);
    expect(w.subs.length).toBeGreaterThan(0);
    expect(w.subs.every(s => s.kind === 'patrol')).toBe(true);
    expect(w.cleared).toBe(false);
  });
  it('is cleared when all subs are gone', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    expect(w.cleared).toBe(true);
  });
  it('dropping respects maxCharges in flight', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    const intent = { move: { x: 0, y: 0 }, drop: true, fire: false };
    w.update(1 / 60, intent);
    w.update(1 / 60, intent);
    w.update(1 / 60, intent);
    expect(w.charges.length).toBeLessThanOrEqual(w.stats.maxCharges);
  });
  it('a throwing entity is removed instead of crashing the frame', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    const bad = w.subs[0];
    Object.defineProperty(bad, 'x', { get() { throw new Error('boom'); } });
    expect(() => w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false })).not.toThrow();
    expect(w.subs.includes(bad)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/world.test.ts` — Expected: FAIL, cannot resolve `./world`.

- [ ] **Step 3: Implement**

`src/game/world.ts`:
```ts
import type { Rng } from '../core/rng';
import type { Intent } from '../core/input';
import { ARENA_W, VIEW_W, WATERLINE, SEA_BOTTOM } from './consts';
import { composeWave, type SpawnKind } from './waves';
import { defaultStats, type PlayerStats } from './upgrades';
import { resolveBlasts, circlesOverlap, type Blast, type BlastTarget } from './collision';
import { stepDepthCharge, steerHoming, clampSubDepth } from './entities/physics';
import type { Sub, DepthCharge, Projectile, Particle, Player } from './entities/types';

export const BASE_SCORE: Record<SpawnKind, number> = {
  patrol: 100, hunter: 200, missile: 250, gunboat: 150, mine: 50,
};

const SUB_SPEED: Record<SpawnKind, number> = {
  patrol: 30, hunter: 40, missile: 25, gunboat: 0, mine: 6,
};

const PLAYER_R = 8;
const SUB_R = 9;
const MINE_CHAIN_R = 30;
const FUSE_R = 12;
const DAMAGE = { torpedo: 20, sam: 25, flak: 15, water: 10 } as const;

export function scoreBlast(
  killed: { kind: SpawnKind; y: number }[],
): number {
  let pts = 0;
  for (const k of killed) pts += BASE_SCORE[k.kind] + Math.max(0, Math.round(k.y - WATERLINE));
  return pts * Math.max(1, killed.length);
}

export class World {
  player: Player = { x: VIEW_W / 2, y: 60, vx: 0, vy: 0, hp: 100, iframes: 0, facing: 1, fireCd: 0, pdCd: 0 };
  stats: PlayerStats = defaultStats();
  owned = new Set<string>();
  subs: Sub[] = [];
  charges: DepthCharge[] = [];
  shots: Projectile[] = [];
  particles: Particle[] = [];
  wave = 0;
  score = 0;
  kills = 0;
  drops = 0;
  hitDrops = 0;
  sonarTimer = 0;
  sonarCycle = 0;
  camX = 0;
  events: string[] = [];
  private nextId = 1;

  constructor(private rng: Rng) {}

  get cleared(): boolean {
    return this.subs.length === 0;
  }

  startWave(): void {
    this.wave++;
    for (const kind of composeWave(this.wave, this.rng)) this.spawn(kind);
    if (this.stats.sonar) {
      this.sonarTimer = 3;
      this.sonarCycle = 8;
      this.events.push('ping');
    }
  }

  private spawn(kind: SpawnKind): void {
    const s: Sub = {
      id: this.nextId++, kind, hp: kind === 'gunboat' ? 24 : 1,
      x: this.rng() * ARENA_W,
      y: kind === 'gunboat' ? WATERLINE - 3
        : WATERLINE + 20 + this.rng() * (SEA_BOTTOM - WATERLINE - 34),
      vx: 0, vy: 0,
      dir: this.rng() < 0.5 ? -1 : 1,
      fireTimer: 2 + this.rng() * 3,
      surfaceTimer: 3 + this.rng() * 4,
      surfaced: false,
    };
    s.vx = SUB_SPEED[kind] * s.dir;
    if (kind === 'mine') s.vy = (this.rng() - 0.5) * 8;
    this.subs.push(s);
  }

  update(dt: number, intent: Intent): void {
    this.updatePlayer(dt, intent);
    this.updateCharges(dt);
    this.guardedEach(this.subs, s => this.updateSub(s, dt));
    this.guardedEach(this.shots, p => this.updateShot(p, dt));
    this.shots = this.shots.filter(p => p.age < p.life);
    this.updateParticles(dt);
    if (this.sonarTimer > 0) this.sonarTimer -= dt;
    if (this.stats.sonar) {
      this.sonarCycle -= dt;
      if (this.sonarCycle <= 0) {
        this.sonarCycle = 8;
        this.sonarTimer = 3;
        this.events.push('ping');
      }
    }
    // camera follows player
    const target = Math.max(0, Math.min(ARENA_W - VIEW_W, this.player.x - VIEW_W / 2));
    this.camX += (target - this.camX) * Math.min(1, 5 * dt);
  }

  private guardedEach<T>(list: T[], fn: (e: T) => void): void {
    for (let i = list.length - 1; i >= 0; i--) {
      try {
        fn(list[i]);
      } catch (err) {
        if (import.meta.env?.DEV) console.error('entity removed after error', err);
        list.splice(i, 1);
      }
    }
  }

  private updatePlayer(dt: number, intent: Intent): void {
    const p = this.player;
    p.vx += intent.move.x * this.stats.accel * dt;
    p.vy += intent.move.y * this.stats.accel * dt;
    const drag = Math.exp(-3 * dt);
    p.vx *= drag;
    p.vy *= drag;
    p.x = Math.max(PLAYER_R, Math.min(ARENA_W - PLAYER_R, p.x + p.vx * dt));
    p.y = Math.max(10, p.y + p.vy * dt);
    if (intent.move.x !== 0) p.facing = intent.move.x > 0 ? 1 : -1;
    if (p.iframes > 0) p.iframes -= dt;
    // water contact
    if (p.y > WATERLINE - 6) {
      p.y = WATERLINE - 6;
      p.vy = -140;
      this.damagePlayer(DAMAGE.water);
      this.events.push('splash');
      this.splashParticles(p.x);
    }
    // drop
    if (intent.drop && this.charges.length < this.stats.maxCharges) {
      const n = this.stats.dualDrop ? 2 : 1;
      for (let i = 0; i < n && this.charges.length < this.stats.maxCharges; i++) {
        this.charges.push({
          id: this.nextId++,
          x: p.x + (i === 0 ? -3 : 3), y: p.y + 6,
          vx: p.vx * 0.5 + (i === 0 ? -8 : 8) * (n - 1), vy: Math.max(0, p.vy),
        });
        this.drops++;
      }
      this.events.push('drop');
    }
    // autocannon
    if (p.fireCd > 0) p.fireCd -= dt;
    if (intent.fire && p.fireCd <= 0) {
      p.fireCd = 0.12;
      this.shots.push({
        id: this.nextId++, ptype: 'bullet',
        x: p.x + p.facing * 12, y: p.y + 2,
        vx: p.facing * 300, vy: 0,
        age: 0, life: 0.7, damage: 8,
      });
      this.events.push('fire');
    }
    // point defense
    if (this.stats.pointDefense) {
      if (p.pdCd > 0) p.pdCd -= dt;
      if (p.pdCd <= 0) {
        const near = this.shots.find(s =>
          s.ptype !== 'bullet' && Math.hypot(s.x - p.x, s.y - p.y) < 45);
        if (near) {
          near.age = near.life;
          p.pdCd = 0.4;
          this.events.push('fire');
          this.boomParticles(near.x, near.y, 4);
        }
      }
    }
  }

  private damagePlayer(amount: number): void {
    const p = this.player;
    if (p.iframes > 0) return;
    p.hp -= amount;
    p.iframes = 0.8;
    this.events.push('hit');
    if (p.hp <= 0) this.events.push('die');
  }

  private updateCharges(dt: number): void {
    const blasts: Blast[] = [];
    for (let i = this.charges.length - 1; i >= 0; i--) {
      const c = this.charges[i];
      if (c.y >= WATERLINE && c.y - c.vy * dt < WATERLINE) {
        this.events.push('splash');
        this.splashParticles(c.x);
      }
      stepDepthCharge(c, this.stats.sinkSpeed, dt);
      if (this.stats.magnetic && c.y > WATERLINE) {
        let best: Sub | null = null, bd = 70;
        for (const s of this.subs) {
          if (s.kind === 'gunboat') continue;
          const d = Math.hypot(s.x - c.x, s.y - c.y);
          if (d < bd) { bd = d; best = s; }
        }
        if (best) {
          c.vx += Math.sign(best.x - c.x) * 50 * dt;
          c.vy += Math.sign(best.y - c.y) * 30 * dt;
        }
      }
      const nearTarget = this.subs.some(s =>
        circlesOverlap({ x: c.x, y: c.y, r: FUSE_R }, { x: s.x, y: s.y, r: SUB_R }));
      if ((c.y > WATERLINE && nearTarget) || c.y >= SEA_BOTTOM - 4) {
        blasts.push({ x: c.x, y: c.y, r: this.stats.blastRadius });
        this.charges.splice(i, 1);
      }
    }
    if (blasts.length === 0) return;
    const targets: BlastTarget[] = this.subs.map(s => ({
      id: s.id, x: s.x, y: s.y,
      r: s.kind === 'mine' ? 5 : SUB_R,
      chainRadius: s.kind === 'mine' ? MINE_CHAIN_R : undefined,
    }));
    const hitIds = resolveBlasts(blasts, targets);
    const killed = this.subs.filter(s => hitIds.has(s.id));
    if (killed.length > 0) {
      this.score += scoreBlast(killed.map(k => ({ kind: k.kind, y: k.y })));
      this.kills += killed.length;
      this.hitDrops++;
      for (const k of killed) this.boomParticles(k.x, k.y, 12);
      this.subs = this.subs.filter(s => !hitIds.has(s.id));
    }
    for (const b of blasts) this.boomParticles(b.x, b.y, 10);
    this.events.push('boom');
  }

  private updateSub(s: Sub, dt: number): void {
    const p = this.player;
    if (s.kind === 'gunboat') {
      s.fireTimer -= dt;
      if (s.fireTimer <= 0) {
        s.fireTimer = 2.5;
        const dx = p.x - s.x;
        this.shots.push({
          id: this.nextId++, ptype: 'flak',
          x: s.x, y: s.y - 4,
          vx: Math.max(-120, Math.min(120, dx * 0.8)), vy: -180,
          age: 0, life: 3, damage: DAMAGE.flak,
        });
        this.events.push('fire');
      }
      return;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.x < SUB_R) { s.x = SUB_R; s.dir = 1; s.vx = Math.abs(s.vx); }
    if (s.x > ARENA_W - SUB_R) { s.x = ARENA_W - SUB_R; s.dir = -1; s.vx = -Math.abs(s.vx); }
    if (s.kind !== 'missile' || !s.surfaced) clampSubDepth(s);

    if (s.kind === 'hunter') {
      s.fireTimer -= dt;
      if (s.fireTimer <= 0) {
        s.fireTimer = 3 + this.rng() * 2;
        this.shots.push({
          id: this.nextId++, ptype: 'torpedo',
          x: s.x, y: s.y - 8, vx: 0, vy: -90,
          age: 0, life: 5, damage: DAMAGE.torpedo,
        });
        this.events.push('ping');
      }
    } else if (s.kind === 'missile') {
      s.surfaceTimer -= dt;
      if (!s.surfaced && s.surfaceTimer <= 0) {
        s.surfaced = true;
        s.surfaceTimer = 2.5;
        s.vy = 0;
        s.y = WATERLINE + 6;
        this.shots.push({
          id: this.nextId++, ptype: 'sam',
          x: s.x, y: WATERLINE - 2, vx: 0, vy: -140,
          age: 0, life: 4, damage: DAMAGE.sam,
        });
        this.events.push('fire');
        this.splashParticles(s.x);
      } else if (s.surfaced && s.surfaceTimer <= 0) {
        s.surfaced = false;
        s.surfaceTimer = 5 + this.rng() * 3;
        s.y = WATERLINE + 30;
      }
    }
  }

  private updateShot(p: Projectile, dt: number): void {
    p.age += dt;
    const pl = this.player;
    if (p.ptype === 'torpedo' && p.age < 3.5) {
      steerHoming(p, pl.x, pl.y, 90, 2.5, dt);
    } else if (p.ptype === 'sam') {
      steerHoming(p, pl.x, pl.y, 140, 1.2, dt);
    } else if (p.ptype === 'flak') {
      p.vy += 200 * dt;
    }
    const wasAbove = p.y < WATERLINE;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.ptype === 'torpedo' && wasAbove !== p.y < WATERLINE) this.events.push('splash');
    if (p.ptype === 'bullet') {
      if (p.y > WATERLINE) { p.age = p.life; return; }
      for (const s of this.subs) {
        if (s.kind !== 'gunboat' && !(s.kind === 'mine' && s.y < WATERLINE + 12)) continue;
        if (circlesOverlap({ x: p.x, y: p.y, r: 2 }, { x: s.x, y: s.y, r: SUB_R })) {
          s.hp -= p.damage;
          p.age = p.life;
          if (s.hp <= 0) {
            this.subs = this.subs.filter(o => o.id !== s.id);
            this.score += BASE_SCORE[s.kind];
            this.kills++;
            this.boomParticles(s.x, s.y, 10);
            this.events.push('boom');
          }
          return;
        }
      }
      return;
    }
    // enemy projectile vs player
    if (circlesOverlap({ x: p.x, y: p.y, r: 3 }, { x: pl.x, y: pl.y, r: PLAYER_R })) {
      p.age = p.life;
      this.damagePlayer(p.damage);
      this.boomParticles(pl.x, pl.y, 6);
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.y > WATERLINE) pt.vy -= 30 * dt; // bubbles rise
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  private splashParticles(x: number): void {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        id: this.nextId++, x: x + (this.rng() - 0.5) * 10, y: WATERLINE,
        vx: (this.rng() - 0.5) * 40, vy: -30 - this.rng() * 40,
        life: 0.5, maxLife: 0.5, color: '#cfe8ff', size: 2,
      });
    }
  }

  private boomParticles(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = 20 + this.rng() * 60;
      this.particles.push({
        id: this.nextId++, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + this.rng() * 0.4, maxLife: 0.8,
        color: y > WATERLINE ? '#9fd8ff' : '#ffb347', size: 2,
      });
    }
  }
}
```

Note: `import type { Intent } from '../core/input'` — input.ts does not exist yet. Create a minimal `src/core/input.ts` in this task containing only the interface (fleshed out in Task 10):

```ts
export interface Intent {
  move: { x: number; y: number };
  drop: boolean;
  fire: boolean;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/world.test.ts` — Expected: PASS (6 tests).
Also run: `npm run typecheck` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/world.ts src/game/world.test.ts src/core/input.ts
git commit -m "feat: world simulation - spawning, AI, blasts, scoring, guards"
```

---

### Task 10: Input (keyboard + touch)

**Files:**
- Modify: `src/core/input.ts`

- [ ] **Step 1: Implement full input handler**

Replace `src/core/input.ts`:
```ts
export interface Intent {
  move: { x: number; y: number };
  drop: boolean;
  fire: boolean;
}

export class Input {
  private keys = new Set<string>();
  private dropQueued = false;
  private confirmQueued = false;
  private cardKeyQueued = -1;
  private mouseFire = false;
  private touchFire = false;
  private stick = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
  /** main.ts sets this to receive canvas-space taps for UI hit testing */
  onTap: ((cx: number, cy: number) => void) | null = null;
  /** main.ts sets this to convert client coords → canvas coords */
  toCanvas: ((x: number, y: number) => [number, number]) | null = null;
  /** any user gesture happened (for audio unlock) */
  onGesture: (() => void) | null = null;

  attach(el: HTMLElement): void {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.dropQueued = true; e.preventDefault(); }
      if (e.code === 'Enter') this.confirmQueued = true;
      if (e.code === 'Digit1') this.cardKeyQueued = 0;
      if (e.code === 'Digit2') this.cardKeyQueued = 1;
      if (e.code === 'Digit3') this.cardKeyQueued = 2;
      this.onGesture?.();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));

    el.addEventListener('pointerdown', e => {
      this.onGesture?.();
      if (this.toCanvas && this.onTap) {
        const [cx, cy] = this.toCanvas(e.clientX, e.clientY);
        this.onTap(cx, cy);
      }
      if (e.pointerType === 'mouse') {
        this.mouseFire = true;
        return;
      }
      const half = window.innerWidth / 2;
      if (e.clientX < half) {
        this.stick = { active: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 };
      } else if (e.clientY < window.innerHeight / 2) {
        this.touchFire = true;
      } else {
        this.dropQueued = true;
      }
    });
    el.addEventListener('pointermove', e => {
      if (this.stick.active && e.pointerId === this.stick.id) {
        this.stick.dx = e.clientX - this.stick.sx;
        this.stick.dy = e.clientY - this.stick.sy;
      }
    });
    const release = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.mouseFire = false;
      if (this.stick.active && e.pointerId === this.stick.id) this.stick.active = false;
      else if (e.pointerType !== 'mouse') this.touchFire = false;
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  poll(): Intent {
    let x = 0, y = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) x += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) y -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) y += 1;
    if (this.stick.active) {
      // touch stick overrides keys (last-writer wins per axis when moved)
      const nx = Math.max(-1, Math.min(1, this.stick.dx / 40));
      const ny = Math.max(-1, Math.min(1, this.stick.dy / 40));
      if (Math.abs(nx) > 0.15) x = nx;
      if (Math.abs(ny) > 0.15) y = ny;
    }
    const drop = this.dropQueued;
    this.dropQueued = false;
    return {
      move: { x, y },
      drop,
      fire: this.keys.has('KeyF') || this.mouseFire || this.touchFire,
    };
  }

  consumeConfirm(): boolean {
    const c = this.confirmQueued;
    this.confirmQueued = false;
    return c;
  }

  consumeCardKey(): number {
    const c = this.cardKeyQueued;
    this.cardKeyQueued = -1;
    return c;
  }
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm test` — Expected: clean, all existing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/core/input.ts
git commit -m "feat: unified keyboard + touch input with virtual stick"
```

---

### Task 11: Sprite sheet + renderer

**Files:**
- Create: `src/render/sprites.ts`, `src/render/renderer.ts`

- [ ] **Step 1: Implement generated sprite sheet**

`src/render/sprites.ts`:
```ts
export interface Frame { x: number; y: number; w: number; h: number }

export interface Sheet {
  canvas: HTMLCanvasElement;
  frames: Record<string, Frame>;
}

/** Generate the pixel-art sprite sheet at boot. Palette honors the 2003 original
 * (yellow subs, deep blue sea) without copying its art. */
export function makeSheet(): Sheet {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const c = canvas.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };

  // --- helicopter, 24x12, two rotor frames at (0,0) and (24,0), faces right
  for (let f = 0; f < 2; f++) {
    const ox = f * 24;
    px(ox + 4, 4, 13, 5, '#4a5d3a');        // fuselage
    px(ox + 15, 5, 7, 2, '#3c4b30');        // tail boom
    px(ox + 21, 3, 2, 4, '#3c4b30');        // tail fin
    px(ox + 6, 5, 4, 2, '#9fd8ff');         // canopy
    px(ox + 5, 9, 11, 1, '#2b3622');        // belly
    px(ox + 4, 10, 3, 1, '#222');           // skid
    px(ox + 12, 10, 3, 1, '#222');
    px(ox + 10, 2, 1, 2, '#222');           // rotor mast
    if (f === 0) px(ox + 2, 1, 17, 1, '#cccccc');   // rotor frame A
    else { px(ox + 6, 1, 9, 1, '#cccccc'); }        // rotor frame B (blur)
  }

  // --- subs 22x10 at y=16: patrol(0), hunter(24), missile(48)
  const subBody = (ox: number, hull: string, accent: string) => {
    px(ox + 1, 19, 20, 5, hull);            // hull
    px(ox + 0, 20, 1, 3, accent);           // nose
    px(ox + 21, 20, 1, 3, accent);          // tail
    px(ox + 8, 16, 4, 3, hull);             // conning tower
    px(ox + 9, 17, 2, 1, '#9fd8ff');        // porthole
    px(ox + 2, 21, 18, 1, accent);          // stripe
  };
  subBody(0, '#e8c832', '#a8891a');         // patrol: yellow
  subBody(24, '#e88232', '#a85a1a');        // hunter: orange
  subBody(48, '#b06ee0', '#7a3fa8');        // missile: violet

  // --- gunboat 26x12 at (72,16)
  px(74, 22, 22, 4, '#8a8f98');             // hull
  px(72, 23, 2, 2, '#6a6f78');
  px(80, 18, 8, 4, '#a8adb8');              // superstructure
  px(83, 16, 2, 2, '#6a6f78');              // gun
  px(74, 25, 22, 1, '#5a5f68');

  // --- mine 8x8 at (0,32)
  px(2, 34, 4, 4, '#39424e');
  px(3, 33, 2, 1, '#39424e');
  px(3, 38, 2, 1, '#39424e');
  px(1, 35, 1, 2, '#39424e');
  px(6, 35, 1, 2, '#39424e');
  px(3, 35, 1, 1, '#ff5544');               // detonator glint

  // --- depth charge 4x6 at (16,32)
  px(16, 32, 4, 5, '#5a6470');
  px(17, 37, 2, 1, '#3a424c');

  // --- torpedo 8x3 at (24,32) faces up when rotated by renderer; draw horizontal
  px(24, 33, 7, 2, '#d8dde4');
  px(31, 33, 1, 2, '#ff8844');

  // --- SAM 3x10 at (40,32) pointing up
  px(41, 32, 1, 2, '#ffcc66');
  px(40, 34, 3, 6, '#d8dde4');
  px(40, 40, 1, 2, '#8a8f98');
  px(42, 40, 1, 2, '#8a8f98');

  return {
    canvas,
    frames: {
      heli0:   { x: 0,  y: 0,  w: 24, h: 12 },
      heli1:   { x: 24, y: 0,  w: 24, h: 12 },
      patrol:  { x: 0,  y: 16, w: 22, h: 10 },
      hunter:  { x: 24, y: 16, w: 22, h: 10 },
      missile: { x: 48, y: 16, w: 22, h: 10 },
      gunboat: { x: 72, y: 16, w: 26, h: 12 },
      mine:    { x: 0,  y: 32, w: 8,  h: 8 },
      charge:  { x: 16, y: 32, w: 4,  h: 6 },
      torpedo: { x: 24, y: 32, w: 8,  h: 3 },
      sam:     { x: 40, y: 32, w: 3,  h: 10 },
    },
  };
}
```

- [ ] **Step 2: Implement renderer**

`src/render/renderer.ts`:
```ts
import { VIEW_W, VIEW_H, WATERLINE } from '../game/consts';
import type { World } from '../game/world';
import type { Phase } from '../game/state';
import type { UpgradeCard } from '../game/upgrades';
import type { Sheet } from './sprites';

export function cardRect(i: number): { x: number; y: number; w: number; h: number } {
  return { x: 40 + i * 140, y: 80, w: 120, h: 110 };
}

interface CloudSpec { x: number; y: number; w: number }
const CLOUDS: CloudSpec[] = Array.from({ length: 10 }, (_, i) => ({
  x: (i * 197) % 960, y: 12 + (i * 37) % 90, w: 30 + (i * 53) % 40,
}));

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D, private sheet: Sheet) {
    ctx.imageSmoothingEnabled = false;
  }

  draw(world: World, phase: Phase, cards: UpgradeCard[], t: number): void {
    const { ctx } = this;
    const cam = world.camX;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, WATERLINE);
    sky.addColorStop(0, '#2a4a9e');
    sky.addColorStop(1, '#7ba6e0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, WATERLINE);
    // parallax clouds
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const cl of CLOUDS) {
      const x = ((cl.x - cam * 0.3) % 960 + 960) % 960 - 240;
      ctx.fillRect(x, cl.y, cl.w, 5);
      ctx.fillRect(x + 6, cl.y - 3, cl.w - 12, 3);
    }
    // sea
    const sea = ctx.createLinearGradient(0, WATERLINE, 0, VIEW_H);
    sea.addColorStop(0, '#0e4a8a');
    sea.addColorStop(1, '#051426');
    ctx.fillStyle = sea;
    ctx.fillRect(0, WATERLINE, VIEW_W, VIEW_H - WATERLINE);
    // light rays
    ctx.fillStyle = 'rgba(159,216,255,0.05)';
    for (let i = 0; i < 4; i++) {
      const rx = ((i * 130 - cam * 0.6) % 960 + 960) % 960 - 240 + Math.sin(t * 0.3 + i) * 8;
      ctx.beginPath();
      ctx.moveTo(rx, WATERLINE);
      ctx.lineTo(rx + 26, WATERLINE);
      ctx.lineTo(rx + 60, VIEW_H);
      ctx.lineTo(rx + 10, VIEW_H);
      ctx.fill();
    }
    // animated waterline strip
    ctx.fillStyle = '#bfe3ff';
    for (let x = 0; x < VIEW_W; x += 4) {
      const h = 1 + Math.round(Math.sin((x + cam) * 0.08 + t * 2.5) + 1);
      ctx.fillRect(x, WATERLINE - h, 4, h);
    }

    // entities (world space → screen space via cam)
    const dr = (frame: string, x: number, y: number, flip = false, rot = 0) => {
      const f = this.sheet.frames[frame];
      ctx.save();
      ctx.translate(Math.round(x - cam), Math.round(y));
      if (flip) ctx.scale(-1, 1);
      if (rot) ctx.rotate(rot);
      ctx.drawImage(this.sheet.canvas, f.x, f.y, f.w, f.h, -f.w / 2, -f.h / 2, f.w, f.h);
      ctx.restore();
    };

    for (const s of world.subs) {
      const frame = s.kind === 'gunboat' ? 'gunboat' : s.kind === 'mine' ? 'mine' : s.kind;
      dr(frame, s.x, s.y, s.dir < 0);
      if (world.sonarTimer > 0 && s.kind !== 'gunboat') {
        ctx.strokeStyle = 'rgba(120,255,160,0.8)';
        ctx.strokeRect(Math.round(s.x - cam) - 12, Math.round(s.y) - 7, 24, 14);
      }
    }
    for (const c of world.charges) dr('charge', c.x, c.y);
    for (const p of world.shots) {
      if (p.ptype === 'bullet') {
        ctx.fillStyle = '#ffe9a0';
        ctx.fillRect(Math.round(p.x - cam) - 1, Math.round(p.y), 3, 1);
      } else {
        const rot = Math.atan2(p.vy, p.vx);
        dr(p.ptype === 'sam' ? 'sam' : 'torpedo', p.x, p.y, false,
          p.ptype === 'sam' ? rot + Math.PI / 2 : rot);
      }
    }
    // player (blink during iframes)
    if (world.player.iframes <= 0 || Math.floor(t * 12) % 2 === 0) {
      dr(Math.floor(t * 20) % 2 === 0 ? 'heli0' : 'heli1',
        world.player.x, world.player.y, world.player.facing < 0);
    }
    // particles
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x - cam), Math.round(pt.y), pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    this.hud(world);
    if (phase === 'menu') this.menu();
    if (phase === 'upgrade') this.upgrade(cards);
    if (phase === 'gameover') this.gameover(world);
  }

  private text(s: string, x: number, y: number, size = 8, col = '#e8f2ff', center = false): void {
    const { ctx } = this;
    ctx.fillStyle = col;
    ctx.font = `${size}px monospace`;
    ctx.textAlign = center ? 'center' : 'left';
    ctx.fillText(s, x, y);
  }

  private hud(world: World): void {
    const { ctx } = this;
    ctx.fillStyle = '#000a';
    ctx.fillRect(4, 4, 84, 22);
    ctx.fillStyle = '#42212a';
    ctx.fillRect(8, 8, 60, 5);
    ctx.fillStyle = '#e04848';
    ctx.fillRect(8, 8, Math.max(0, 60 * world.player.hp / world.stats.maxHp), 5);
    for (let i = 0; i < world.stats.maxCharges; i++) {
      ctx.fillStyle = i < world.stats.maxCharges - world.charges.length ? '#ffd866' : '#444';
      ctx.fillRect(8 + i * 7, 17, 5, 6);
    }
    ctx.fillStyle = '#e8f2ff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`WAVE ${world.wave}`, VIEW_W - 8, 12);
    ctx.fillText(`${world.score}`, VIEW_W - 8, 22);
    ctx.textAlign = 'left';
  }

  private overlay(): void {
    this.ctx.fillStyle = 'rgba(4,10,20,0.75)';
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private menu(): void {
    this.overlay();
    this.text('SEA BOMBER', VIEW_W / 2, 100, 24, '#ffd866', true);
    this.text('depth-charge the subs · dodge everything', VIEW_W / 2, 125, 8, '#9fd8ff', true);
    this.text('WASD/arrows move · SPACE drop · F fire', VIEW_W / 2, 150, 8, '#e8f2ff', true);
    this.text('touch: left = stick · right-top = fire · right-bottom = drop', VIEW_W / 2, 162, 8, '#e8f2ff', true);
    this.text('press ENTER or tap to start', VIEW_W / 2, 190, 10, '#ffd866', true);
  }

  private upgrade(cards: UpgradeCard[]): void {
    this.overlay();
    this.text('WAVE CLEARED — choose an upgrade', VIEW_W / 2, 60, 10, '#ffd866', true);
    cards.forEach((card, i) => {
      const r = cardRect(i);
      this.ctx.fillStyle = '#12233d';
      this.ctx.fillRect(r.x, r.y, r.w, r.h);
      this.ctx.strokeStyle = '#9fd8ff';
      this.ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      this.text(`[${i + 1}]`, r.x + r.w / 2, r.y + 20, 10, '#ffd866', true);
      this.text(card.name, r.x + r.w / 2, r.y + 45, 9, '#e8f2ff', true);
      this.text(card.desc, r.x + r.w / 2, r.y + 70, 7, '#9fd8ff', true);
    });
  }

  private gameover(world: World): void {
    this.overlay();
    const acc = world.drops > 0 ? Math.round(100 * world.hitDrops / world.drops) : 0;
    this.text('CHOPPER DOWN', VIEW_W / 2, 90, 20, '#e04848', true);
    this.text(`wave ${world.wave} · score ${world.score}`, VIEW_W / 2, 120, 10, '#e8f2ff', true);
    this.text(`kills ${world.kills} · drop accuracy ${acc}%`, VIEW_W / 2, 138, 8, '#9fd8ff', true);
    this.text('press ENTER or tap for menu', VIEW_W / 2, 175, 10, '#ffd866', true);
  }
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test` — Expected: clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/render/
git commit -m "feat: generated pixel-art sprite sheet and layered renderer"
```

---

### Task 12: Audio

**Files:**
- Create: `src/core/audio.ts`

- [ ] **Step 1: Implement procedural audio**

`src/core/audio.ts`:
```ts
export class AudioSys {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicStep = 0;
  private nextNote = 0;
  private timer = 0;
  muted = false;

  /** Call on first user gesture (browser autoplay policy). Idempotent. */
  resume(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.nextNote = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 30);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
  }

  handle(ev: string): void {
    if (!this.ctx) return;
    switch (ev) {
      case 'boom': this.noise(0.5, 300, 0.5); break;
      case 'splash': this.noise(0.18, 1800, 0.15); break;
      case 'drop': this.blip(220, 0.05, 'square', 0.15); break;
      case 'fire': this.blip(660, 0.03, 'square', 0.08); break;
      case 'hit': this.blip(110, 0.2, 'sawtooth', 0.25); break;
      case 'ping': this.sweep(880, 1760, 0.3); break;
      case 'ui': this.blip(520, 0.05, 'sine', 0.12); break;
      case 'die': this.sweep(440, 55, 0.8); break;
    }
  }

  private env(gain: number, dur: number): GainNode {
    const g = this.ctx!.createGain();
    const t = this.ctx!.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(this.master!);
    return g;
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number): void {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(this.env(gain, dur));
    o.start();
    o.stop(this.ctx!.currentTime + dur);
  }

  private sweep(from: number, to: number, dur: number): void {
    const o = this.ctx!.createOscillator();
    o.type = 'sine';
    const t = this.ctx!.currentTime;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    o.connect(this.env(0.2, dur));
    o.start();
    o.stop(t + dur);
  }

  private noise(dur: number, cutoff: number, gain: number): void {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    src.connect(f);
    f.connect(this.env(gain, dur));
    src.start();
  }

  /** 120 BPM lookahead scheduler: bass + arp + rotor thump. */
  private schedule(): void {
    const ctx = this.ctx!;
    const SIXTEENTH = 60 / 120 / 4;
    const BASS = [55, 55, 65.4, 49];             // A1 A1 C2 G1 per bar
    const ARP = [220, 330, 440, 330, 220, 262, 392, 262];
    while (this.nextNote < ctx.currentTime + 0.12) {
      const t = this.nextNote;
      const s = this.musicStep;
      if (s % 4 === 0) this.note(BASS[(s / 4) % 4 | 0], t, SIXTEENTH * 3.5, 'square', 0.06);
      this.note(ARP[s % 8], t, SIXTEENTH * 0.9, 'triangle', 0.03);
      if (s % 2 === 0) this.thump(t);
      this.nextNote += SIXTEENTH;
      this.musicStep++;
    }
  }

  private note(freq: number, at: number, dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(at);
    o.stop(at + dur);
  }

  /** rotor thump: tiny low noise burst */
  private thump(at: number): void {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(at);
  }
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck` — Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/core/audio.ts
git commit -m "feat: procedural Web Audio SFX and music scheduler"
```

---

### Task 13: Main wiring

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace placeholder main with full orchestration**

`src/main.ts`:
```ts
import { VIEW_W, VIEW_H } from './game/consts';
import { Loop, STEP } from './core/loop';
import { Input } from './core/input';
import { AudioSys } from './core/audio';
import { mulberry32 } from './core/rng';
import { World } from './game/world';
import { StateMachine } from './game/state';
import { drawCards, type UpgradeCard } from './game/upgrades';
import { makeSheet } from './render/sprites';
import { Renderer, cardRect } from './render/renderer';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d')!;

const input = new Input();
const audio = new AudioSys();
const state = new StateMachine();
const renderer = new Renderer(ctx, makeSheet());

let world = new World(mulberry32(Date.now() >>> 0));
let cards: UpgradeCard[] = [];
let elapsed = 0;

// --- scaling: integer scale, letterbox via CSS size
let scale = 1;
function resize(): void {
  scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
}
window.addEventListener('resize', resize);
resize();

input.attach(canvas);
input.onGesture = () => audio.resume();
input.toCanvas = (x, y) => {
  const r = canvas.getBoundingClientRect();
  return [(x - r.left) / scale, (y - r.top) / scale];
};
input.onTap = (cx, cy) => {
  if (state.phase === 'menu') startRun();
  else if (state.phase === 'gameover') {
    state.toMenu();
    audio.handle('ui');
  } else if (state.phase === 'upgrade') {
    cards.forEach((_, i) => {
      const r = cardRect(i);
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) pickCard(i);
    });
  }
};

function startRun(): void {
  world = new World(mulberry32(Date.now() >>> 0));
  world.startWave();
  state.start();
  audio.handle('ui');
}

function pickCard(i: number): void {
  const card = cards[i];
  if (!card) return;
  card.apply(world.stats);
  world.owned.add(card.id);
  world.player.hp = Math.min(world.stats.maxHp, world.player.hp + 15); // small heal per wave
  state.cardPicked();
  world.startWave();
  audio.handle('ui');
}

window.addEventListener('keydown', e => {
  if (e.code === 'KeyM') audio.toggleMute();
});

function update(dt: number): void {
  elapsed += dt;
  if (state.phase === 'menu' || state.phase === 'gameover') {
    if (input.consumeConfirm()) {
      if (state.phase === 'gameover') { state.toMenu(); audio.handle('ui'); }
      else startRun();
    }
    input.poll(); // drain queued edges
    return;
  }
  if (state.phase === 'upgrade') {
    const k = input.consumeCardKey();
    if (k >= 0) pickCard(k);
    input.poll();
    return;
  }
  // playing
  world.update(dt, input.poll());
  for (const ev of world.events) audio.handle(ev);
  world.events.length = 0;
  if (world.player.hp <= 0) {
    state.died();
    return;
  }
  if (world.cleared) {
    state.waveCleared();
    cards = drawCards(mulberry32((Date.now() ^ world.wave * 7919) >>> 0), world.owned);
    audio.handle('ui');
  }
}

const loop = new Loop(
  dt => update(dt),
  () => renderer.draw(world, state.phase, cards, elapsed),
);
loop.start();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});

// keep STEP referenced for clarity of fixed-step contract
void STEP;
```

- [ ] **Step 2: Verify build + tests**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean, all test files pass (rng 4, loop 4, collision 6, upgrades 4, waves 6, physics 5, state 3, world 6 — 38 total), build outputs `dist/`.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire loop, input, audio, world, and renderer in main"
```

---

### Task 14: Playtest verification + launch config

**Files:**
- Create: `.claude/launch.json`

- [ ] **Step 1: Add launch config**

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "sea-bomber",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 2: Manual verification checklist (via preview tools)**

Start the dev server and verify in the browser:

1. Menu renders; Enter or tap starts wave 1.
2. Helicopter flies with inertia, tilts/flips with direction, cannot leave arena, bounces off water with splash + damage.
3. Space drops a charge; it arcs, splashes, sinks, detonates near a patrol sub; sub dies, score increases, boom audible.
4. Charge pips in HUD track in-flight count; max 2 drops until one detonates.
5. Clearing the wave shows 3 distinct upgrade cards; keys 1–3 and clicking both work; effect applies (e.g. Extra Rack → 3 pips).
6. Wave 2+: hunters fire breaching torpedoes that chase; mines chain-explode; later waves show gunboat flak and missile-sub SAMs.
7. Player death → game-over screen with wave/score/kills/accuracy; Enter/tap → menu → new run resets everything.
8. Resize window: canvas rescales at integer factors, stays crisp.
9. Hide tab 5+ seconds, return: no physics jump.
10. M toggles mute; audio only starts after first gesture.

Fix anything broken; commit fixes individually with `fix:` messages.

- [ ] **Step 3: Update README**

Create `README.md`:
```markdown
# Sea Bomber

Modern browser reimagining of the 2003 J2ME game "AH-1 Sea Bomber" (Mr. Goodliving Ltd.).
Arcade roguelite: pilot a helicopter over open sea, depth-charge submarines through
escalating waves, pick upgrade cards between waves.

The original jar is kept in the repo root for design reference only; none of its
assets or code ship in this game.

## Run

    npm install
    npm run dev

## Controls

- Move: WASD / arrows · Drop charge: Space · Cannon: F or mouse · Mute: M
- Touch: left half = virtual stick, right-top = fire, right-bottom = drop

## Develop

    npm test        # vitest unit tests (pure game logic)
    npm run build   # typecheck + production build to dist/
```

- [ ] **Step 4: Final commit**

```bash
git add .claude/launch.json README.md
git commit -m "docs: README and preview launch config"
```

---

## Self-review checklist (run after writing, before execution)

- **Spec coverage:** arena/waterline (T1 consts, T9), run structure + upgrade picks (T8, T13), player movement/water bounce/iframes (T9), depth charges + fuse + magnetic (T9), autocannon + point defense (T9), all 5 enemy kinds (T6, T9), 9 upgrade cards (T5), depth-bonus + multi-kill scoring (T9), pixel rendering at 480×270 integer scale (T1, T11, T13), parallax/rays/waves/particles (T11), touch + keyboard (T10), procedural audio + gesture unlock (T12), dt clamp + visibility pause (T3, T13), resize (T13), per-entity guard (T9), chain termination (T4). No persistence — matches spec out-of-scope. ✓
- **Placeholders:** none — every code step has full code. ✓
- **Type consistency:** `Intent` defined once in input.ts (stub in T9, final in T10 keeps same shape); `SpawnKind` shared by waves/world/entities; `Sheet.frames` keys match renderer usage (`heli0/heli1/patrol/hunter/missile/gunboat/mine/charge/torpedo/sam`); `World` public fields used by renderer (`subs/charges/shots/particles/player/camX/sonarTimer/score/wave/kills/drops/hitDrops/stats/owned/events/cleared`) all declared in T9. ✓
