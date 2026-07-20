# Enemy Choppers, Ground Enemies & Player Missiles Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three enemy helicopter types and two ground enemies join the biome rosters (inland enters the act rotation), countered by a new player homing-missile weapon unlocked via upgrade card from Act 2.

**Architecture:** Enemy AI lives in pure steppers (`game/entities/ai.ts`, unit-tested) that mutate an enemy and return fire intents; world spawns projectiles and applies category rules (air = bullet/missile-vulnerable, ground = bomb-vulnerable with 50% bullet chip). Player missiles are a stock-based secondary tracked on World, capped by a new `missileCap` stat.

**Tech Stack:** Existing TS + Vite + Vitest + Canvas 2D. No new deps.

## Global Constraints (from spec)

- Enemy stats exactly: scout cost 3 hp 8 · gunship cost 7 hp 24 · mchopper cost 8 hp 16 · aagun cost 5 hp 1 · tank cost 6 hp 20.
- Player missile: 200 px/s, homing turn 3.0 rad/s, damage 24, 4 s life, air targets only. Card "AA Missiles": repeatable, +2 per pick, cap 6, available from Act 2 only. Stock +1 after each cleared wave (cap 6). Fire: `E` key; touch long-press FIRE ≥350 ms.
- Balance guardrails (must be tests): mchopper flee speed 90 < player max speed (~113); scout death blast cannot chain mines (air blast never touches underwater targets).
- Act-1 regression: sea-biome wave composition for a given seed must be IDENTICAL to current main (same RNG draw order — sea pool must keep the exact kind order patrol, mine, hunter, gunboat, missile).
- `BIOME_ORDER` becomes `['sea', 'coast', 'inland']` in this plan.
- Air enemies ignore water/terrain-depth logic (they fly in the sky zone); ground enemies sit on terrain and never move off flat land.

**Spec:** `docs/superpowers/specs/2026-07-17-acts-missions-design.md`
**Baseline:** main @ c87d53f, 76 tests green. Branch: `enemies-missiles`.

## File map

```
src/game/waves.ts          — SpawnKind ×5 new, COST/UNLOCK entries, POOLS per biome,
                             composeWave(wave, rng, biome='sea'), AIR/GROUND sets    [tested]
src/game/biomes.ts         — BIOME_ORDER += 'inland'                                 [tested]
src/game/entities/ai.ts    — NEW: stepScout/stepGunship/stepMchopper/stepAagun/
                             stepTank pure steppers                                  [tested]
src/game/entities/types.ts — Projectile ptype += 'shot' | 'pmissile'
src/game/upgrades.ts       — PlayerStats.missileCap, "AA Missiles" card, act-gated
                             drawCards(rng, owned, n, act)                           [tested]
src/core/input.ts          — Intent.missile edge; E key; FIRE long-press ≥350ms
src/game/world.ts          — spawns per category, AI delegation, scout blasts,
                             bullet/bomb category rules, player missile weapon,
                             stock refill on startWave                               [tested]
src/render/sprites.ts      — scout/gunship/mchopper/aagun/tank/pmissile frames
src/render/renderer.ts     — draw new kinds, missile pips
src/main.ts                — pass act to drawCards
```

---

### Task 0: Branch

- [ ] **Step 1:**
```bash
cd /Users/paulcooke/Documents/Projects/Bomber
git checkout -b enemies-missiles
npx vitest run   # 76 passing baseline
```

---

### Task 1: Biome enemy pools + inland rotation

**Files:**
- Modify: `src/game/waves.ts`, `src/game/biomes.ts`
- Test: `src/game/waves.test.ts` (append + adjust), `src/game/biomes.test.ts` (adjust)

**Interfaces:**
- Produces: `SpawnKind` gains `'scout' | 'gunship' | 'mchopper' | 'aagun' | 'tank'`; `AIR: ReadonlySet<SpawnKind>` (scout/gunship/mchopper); `GROUND: ReadonlySet<SpawnKind>` (aagun/tank); `POOLS: Record<Biome, SpawnKind[]>`; `composeWave(wave, rng, biome?: Biome)` (default `'sea'`). `BIOME_ORDER = ['sea','coast','inland']`.

- [ ] **Step 1: Write the failing tests**

Append to `src/game/waves.test.ts` (extend imports with `POOLS, AIR, GROUND`; add `import type { Biome } from './biomes';` if needed):
```ts
describe('biome pools', () => {
  it('sea pool preserves the exact v1 kind order for RNG parity', () => {
    expect(POOLS.sea).toEqual(['patrol', 'mine', 'hunter', 'gunboat', 'missile']);
  });
  it('sea composition is identical to the biome-less call (act-1 regression)', () => {
    expect(composeWave(3, mulberry32(11))).toEqual(composeWave(3, mulberry32(11), 'sea'));
  });
  it('coast pool adds air enemies and aagun, inland drops subs', () => {
    expect(POOLS.coast).toContain('scout');
    expect(POOLS.coast).toContain('aagun');
    expect(POOLS.inland).not.toContain('patrol');
    expect(POOLS.inland).toContain('tank');
  });
  it('only pool kinds ever spawn for a biome', () => {
    for (let w = 5; w <= 14; w++) {
      for (const k of composeWave(w, mulberry32(w), 'inland')) {
        expect(POOLS.inland).toContain(k);
      }
    }
  });
  it('AIR and GROUND categorize the new kinds', () => {
    expect([...AIR]).toEqual(expect.arrayContaining(['scout', 'gunship', 'mchopper']));
    expect([...GROUND]).toEqual(expect.arrayContaining(['aagun', 'tank']));
  });
  it('new kinds respect their unlock waves', () => {
    for (const k of composeWave(5, mulberry32(1), 'coast')) {
      expect(['patrol', 'mine', 'hunter', 'gunboat', 'missile', 'scout', 'aagun']).toContain(k);
    }
  });
});
```
In `src/game/biomes.test.ts`, change the cycle test to:
```ts
  it('cycles through BIOME_ORDER starting at act 1', () => {
    expect(biomeForAct(1)).toBe('sea');
    expect(biomeForAct(2)).toBe('coast');
    expect(biomeForAct(3)).toBe('inland');
    expect(biomeForAct(4)).toBe('sea');
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/game/waves.test.ts src/game/biomes.test.ts` — FAIL (POOLS/AIR/GROUND missing; biome cycle 2-long).

- [ ] **Step 3: Implement**

`src/game/biomes.ts`: change `BIOME_ORDER` to
```ts
export const BIOME_ORDER: Biome[] = ['sea', 'coast', 'inland'];
```
(drop the stale "Plan 2" comment).

`src/game/waves.ts` — replace content with:
```ts
import type { Rng } from '../core/rng';
import type { Biome } from './biomes';

export type SpawnKind =
  | 'patrol' | 'hunter' | 'missile' | 'gunboat' | 'mine'
  | 'scout' | 'gunship' | 'mchopper' | 'aagun' | 'tank';

export const COST: Record<SpawnKind, number> = {
  patrol: 2, mine: 2, hunter: 4, gunboat: 5, missile: 6,
  scout: 3, gunship: 7, mchopper: 8, aagun: 5, tank: 6,
};

export const UNLOCK: Record<SpawnKind, number> = {
  patrol: 1, mine: 2, hunter: 2, gunboat: 3, missile: 4,
  scout: 5, aagun: 5, gunship: 6, mchopper: 7, tank: 9,
};

export const AIR: ReadonlySet<SpawnKind> = new Set(['scout', 'gunship', 'mchopper']);
export const GROUND: ReadonlySet<SpawnKind> = new Set(['aagun', 'tank']);

/** sea order MUST stay exactly v1 (patrol,mine,hunter,gunboat,missile) for RNG parity */
export const POOLS: Record<Biome, SpawnKind[]> = {
  sea: ['patrol', 'mine', 'hunter', 'gunboat', 'missile'],
  coast: ['patrol', 'mine', 'hunter', 'gunboat', 'missile', 'scout', 'gunship', 'mchopper', 'aagun'],
  inland: ['scout', 'gunship', 'mchopper', 'aagun', 'tank'],
};

export function waveBudget(wave: number): number {
  return 8 + wave * 4;
}

export function composeWave(wave: number, rng: Rng, biome: Biome = 'sea'): SpawnKind[] {
  const kinds = POOLS[biome].filter(k => UNLOCK[k] <= wave);
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

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run` — all green (76 baseline adjusted + 6 new = 82; confirm actual). `npm run typecheck` clean.
IMPORTANT: `src/game/world.ts` passes no biome yet (defaults 'sea') — still compiles; world wiring is Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/game/waves.ts src/game/waves.test.ts src/game/biomes.ts src/game/biomes.test.ts
git commit -m "feat: per-biome enemy pools, air/ground categories, inland in rotation"
```

---

### Task 2: Enemy AI steppers

**Files:**
- Create: `src/game/entities/ai.ts`
- Modify: `src/game/entities/types.ts` (Projectile ptype union)
- Test: `src/game/entities/ai.test.ts`

**Interfaces:**
- Consumes: `Sub` type (reused for all enemies: air choppers use `fireTimer` for shot cadence and `surfaceTimer` for burst bookkeeping), `surfaceAt`/`Terrain`.
- Produces (all mutate `s`, return whether to fire this frame):
```ts
stepScout(s: Sub, px: number, py: number, dt: number): void            // no fire — contact weapon
stepGunship(s: Sub, px: number, py: number, dt: number): boolean       // true → spawn straight 'shot'
stepMchopper(s: Sub, px: number, py: number, dt: number): boolean      // true → spawn homing 'sam'
stepAagun(s: Sub, px: number, py: number, dt: number): boolean         // true → spawn 'flak'
stepTank(s: Sub, t: Terrain, px: number, dt: number): boolean          // true → spawn 'flak'; patrols flat span
```
- Modify `src/game/entities/types.ts`:
```ts
export type ProjectileType = 'torpedo' | 'sam' | 'flak' | 'bullet' | 'shot' | 'pmissile';
```

- [ ] **Step 1: Write the failing tests**

`src/game/entities/ai.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { stepScout, stepGunship, stepMchopper, stepAagun, stepTank } from './ai';
import { generateTerrain, surfaceAt } from '../terrain';
import { mulberry32 } from '../../core/rng';
import type { Sub } from './types';

const foe = (kind: Sub['kind'], x: number, y: number): Sub => ({
  id: 1, kind, hp: 10, x, y, vx: 0, vy: 0, dir: 1,
  fireTimer: 0.01, surfaceTimer: 0, surfaced: false, hitFlash: 0,
});

describe('stepScout', () => {
  it('accelerates toward the player and caps speed at 130', () => {
    const s = foe('scout', 0, 100);
    for (let i = 0; i < 300; i++) stepScout(s, 400, 100, 1 / 60);
    expect(s.x).toBeGreaterThan(50);
    expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(130 + 1e-6);
  });
});

describe('stepGunship', () => {
  it('holds a standoff band around 140px', () => {
    const s = foe('gunship', 500, 100);
    for (let i = 0; i < 600; i++) stepGunship(s, 400, 100, 1 / 60);
    const d = Math.abs(s.x - 400);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(200);
  });
  it('fires 3-round bursts on a cooldown', () => {
    const s = foe('gunship', 540, 100);
    let shots = 0;
    for (let i = 0; i < 60 * 6; i++) if (stepGunship(s, 400, 100, 1 / 60)) shots++;
    expect(shots).toBeGreaterThanOrEqual(3);
    expect(shots).toBeLessThanOrEqual(9); // ≤ 2 bursts + margin in 6s
  });
});

describe('stepMchopper', () => {
  it('flees when the player closes within 100px, at speed ≤ 90', () => {
    const s = foe('mchopper', 450, 100);
    for (let i = 0; i < 120; i++) stepMchopper(s, 400, 100, 1 / 60);
    expect(Math.abs(s.x - 400)).toBeGreaterThan(50); // moved away
    expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(90 + 1e-6);
  });
});

describe('stepAagun', () => {
  it('is static and fires on cadence', () => {
    const s = foe('aagun', 300, 140);
    let fires = 0;
    for (let i = 0; i < 60 * 5; i++) if (stepAagun(s, 400, 60, 1 / 60)) fires++;
    expect(s.x).toBe(300);
    expect(fires).toBeGreaterThanOrEqual(2);
  });
});

describe('stepTank', () => {
  it('patrols along the terrain surface', () => {
    const t = generateTerrain('inland', mulberry32(4));
    const span = t.lz[1]; // plateau
    const s = foe('tank', (span.x0 + span.x1) / 2, 0);
    for (let i = 0; i < 240; i++) stepTank(s, t, 100, 1 / 60);
    expect(Math.abs(s.y - (surfaceAt(t, s.x) - 4))).toBeLessThan(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/game/entities/ai.test.ts` — FAIL, cannot resolve `./ai`.

- [ ] **Step 3: Implement**

`src/game/entities/types.ts`: extend ProjectileType as shown in Interfaces.

`src/game/entities/ai.ts`:
```ts
import type { Sub } from './types';
import { surfaceAt, type Terrain } from '../terrain';

const cap = (s: Sub, max: number) => {
  const v = Math.hypot(s.vx, s.vy);
  if (v > max) {
    s.vx = (s.vx / v) * max;
    s.vy = (s.vy / v) * max;
  }
};

/** kamikaze: accelerate straight at the player, speed cap 130 */
export function stepScout(s: Sub, px: number, py: number, dt: number): void {
  const d = Math.hypot(px - s.x, py - s.y) || 1;
  s.vx += ((px - s.x) / d) * 260 * dt;
  s.vy += ((py - s.y) / d) * 260 * dt;
  cap(s, 130);
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.dir = s.vx >= 0 ? 1 : -1;
}

/** hover-strafe: hold ~140px horizontal standoff, match altitude, 3-round bursts.
 * surfaceTimer counts remaining shots in the current burst. */
export function stepGunship(s: Sub, px: number, py: number, dt: number): boolean {
  const dx = px - s.x;
  const want = Math.abs(dx) > 140 ? Math.sign(dx) : -Math.sign(dx);
  s.vx += want * 180 * dt;
  s.vy += Math.sign(py - s.y) * 120 * dt;
  cap(s, 100);
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.dir = dx >= 0 ? 1 : -1;
  s.fireTimer -= dt;
  if (s.fireTimer <= 0) {
    if (s.surfaceTimer <= 0) s.surfaceTimer = 3;      // start a burst
    s.surfaceTimer -= 1;
    s.fireTimer = s.surfaceTimer > 0 ? 0.12 : 2.5;    // in-burst gap vs cooldown
    return true;
  }
  return false;
}

/** missile chopper: keep ~220px range, flee at 90 when closer than 100, lob homing shots */
export function stepMchopper(s: Sub, px: number, py: number, dt: number): boolean {
  const dx = px - s.x;
  const dist = Math.hypot(dx, py - s.y);
  if (dist < 100) {
    s.vx += -Math.sign(dx) * 240 * dt;
    cap(s, 90); // MUST stay below player max (~113): guardrail
  } else {
    const want = dist > 220 ? Math.sign(dx) : dist < 180 ? -Math.sign(dx) : 0;
    s.vx += want * 140 * dt;
    s.vy += Math.sign(py - s.y) * 80 * dt;
    cap(s, 80);
  }
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.dir = dx >= 0 ? 1 : -1;
  s.fireTimer -= dt;
  if (s.fireTimer <= 0 && dist >= 100) {
    s.fireTimer = 4;
    return true;
  }
  return false;
}

/** fixed AA emplacement */
export function stepAagun(s: Sub, _px: number, _py: number, dt: number): boolean {
  s.fireTimer -= dt;
  if (s.fireTimer <= 0) {
    s.fireTimer = 2.2;
    return true;
  }
  return false;
}

/** tank: patrol horizontally, glued to the terrain surface, reverse on slope > 6px */
export function stepTank(s: Sub, t: Terrain, _px: number, dt: number): boolean {
  const nx = s.x + s.dir * 20 * dt;
  const drop = Math.abs(surfaceAt(t, nx + s.dir * 10) - surfaceAt(t, s.x));
  if (drop > 6) s.dir = s.dir === 1 ? -1 : 1;
  else s.x = nx;
  s.y = surfaceAt(t, s.x) - 4;
  s.vx = s.dir * 20;
  s.fireTimer -= dt;
  if (s.fireTimer <= 0) {
    s.fireTimer = 3;
    return true;
  }
  return false;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/game/entities/ai.test.ts` — PASS (6 tests). Full run + typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/entities/ai.ts src/game/entities/ai.test.ts src/game/entities/types.ts
git commit -m "feat: enemy AI steppers for choppers, AA gun, and tank"
```

---

### Task 3: World integration of new enemies

**Files:**
- Modify: `src/game/world.ts`
- Test: `src/game/world.test.ts` (append)

**Interfaces:**
- Consumes: steppers from `./entities/ai`, `AIR`/`GROUND`/`POOLS` from `./waves`.
- Produces: enemy category behavior in world — spawning (air in sky, ground on flat land), scout contact/death blasts (`scoutBlast(s)` private), bullet rules (air full damage, ground 50%), `'shot'` projectile handling.

- [ ] **Step 1: Write the failing tests** — append inside `describe('World', ...)`:
```ts
  it('air enemies spawn in the sky, ground enemies on land', () => {
    const w = new World(mulberry32(1));
    w.act = 3;
    w.terrain = generateTerrain('inland', mulberry32(4));
    w.wave = 8; // next startWave → 9, all inland kinds unlocked
    w.startWave();
    expect(w.subs.length).toBeGreaterThan(0);
    for (const s of w.subs) {
      if (s.kind === 'scout' || s.kind === 'gunship' || s.kind === 'mchopper') {
        expect(s.y).toBeLessThan(120);
      }
      if (s.kind === 'aagun' || s.kind === 'tank') {
        expect(Math.abs(s.y - (w.terrain.surface[Math.floor(s.x / 8)] - 4))).toBeLessThan(3);
      }
    }
  });

  it('scout death blast does not chain mines', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.subs.push(
      { id: 601, kind: 'scout', hp: 1, x: 300, y: 140, vx: 0, vy: 0, dir: 1, fireTimer: 9, surfaceTimer: 0, surfaced: false, hitFlash: 0 },
      { id: 602, kind: 'mine', hp: 1, x: 300, y: 160, vx: 0, vy: 0, dir: 1, fireTimer: 9, surfaceTimer: 9, surfaced: false, hitFlash: 0 },
    );
    // kill the scout with a bullet
    w.player.x = 260; w.player.y = 140; w.player.turretAngle = 0;
    w.shots.push({ id: 603, ptype: 'bullet', x: 295, y: 140, vx: 300, vy: 0, age: 0, life: 0.7, damage: 8 });
    for (let i = 0; i < 10 && w.subs.some(s => s.id === 601); i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    }
    expect(w.subs.some(s => s.id === 601)).toBe(false); // scout dead
    expect(w.subs.some(s => s.id === 602)).toBe(true);  // mine untouched
  });

  it('bullets chip ground enemies at half damage', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.terrain = generateTerrain('inland', mulberry32(4));
    const tank = { id: 604, kind: 'tank' as const, hp: 20, x: 500, y: 140, vx: 0, vy: 0, dir: 1 as const, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 };
    w.subs.push(tank);
    w.shots.push({ id: 605, ptype: 'bullet', x: 490, y: tank.y, vx: 300, vy: 0, age: 0, life: 0.7, damage: 8 });
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    expect(tank.hp).toBe(16); // 8 * 0.5 = 4 chip
  });

  it('gunship shots travel straight at the player', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.subs.push({ id: 606, kind: 'gunship', hp: 24, x: w.player.x + 140, y: w.player.y, vx: 0, vy: 0, dir: -1, fireTimer: 0.01, surfaceTimer: 0, surfaced: false, hitFlash: 0 });
    for (let i = 0; i < 30 && !w.shots.some(p => p.ptype === 'shot'); i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    }
    const shot = w.shots.find(p => p.ptype === 'shot')!;
    expect(shot).toBeDefined();
    expect(shot.vx).toBeLessThan(0); // toward player on the left
  });
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/world.test.ts` — FAIL.

- [ ] **Step 3: Implement** — in `src/game/world.ts`:

a) Imports:
```ts
import { composeWave, AIR, GROUND, type SpawnKind } from './waves';
import { stepScout, stepGunship, stepMchopper, stepAagun, stepTank } from './entities/ai';
import { biomeForAct } from './biomes';
```
(biomeForAct already imported; merge.)

b) `startWave()` — pass biome:
```ts
    for (const kind of composeWave(budgetWave, this.rng, biomeForAct(this.act))) this.spawn(kind);
```

c) `spawn()` — category positions. Insert at the top of spawn():
```ts
    if (AIR.has(kind)) {
      this.subs.push({
        id: this.nextId++, kind, hp: kind === 'gunship' ? 24 : kind === 'mchopper' ? 16 : 8,
        x: this.rng() * ARENA_W, y: 30 + this.rng() * 80,
        vx: 0, vy: 0, dir: this.rng() < 0.5 ? -1 : 1,
        fireTimer: 1 + this.rng() * 2, surfaceTimer: 0, surfaced: false, hitFlash: 0,
      });
      return;
    }
    if (GROUND.has(kind)) {
      let x = this.rng() * ARENA_W;
      for (let tries = 0; tries < 30 && isWater(this.terrain, x); tries++) x = this.rng() * ARENA_W;
      this.subs.push({
        id: this.nextId++, kind, hp: kind === 'tank' ? 20 : 1,
        x, y: surfaceAt(this.terrain, x) - 4,
        vx: 0, vy: 0, dir: this.rng() < 0.5 ? -1 : 1,
        fireTimer: 1.5 + this.rng() * 2, surfaceTimer: 0, surfaced: false, hitFlash: 0,
      });
      return;
    }
```
(existing water-enemy body stays below unchanged.)

d) `updateSub()` — delegate at the top (before the gunboat branch):
```ts
    if (s.hitFlash > 0) s.hitFlash -= dt;   // (move existing decay up here; remove duplicate below)
    const p = this.player;
    if (AIR.has(s.kind)) {
      if (s.kind === 'scout') {
        stepScout(s, p.x, p.y, dt);
        if (circlesOverlap({ x: s.x, y: s.y, r: 8 }, { x: p.x, y: p.y, r: PLAYER_R })) {
          this.scoutBlast(s);
        }
        return;
      }
      if (s.kind === 'gunship') {
        if (stepGunship(s, p.x, p.y, dt)) {
          const d = Math.hypot(p.x - s.x, p.y - s.y) || 1;
          this.shots.push({
            id: this.nextId++, ptype: 'shot',
            x: s.x, y: s.y,
            vx: ((p.x - s.x) / d) * 160, vy: ((p.y - s.y) / d) * 160,
            age: 0, life: 2.5, damage: 10,
          });
          this.events.push('fire');
        }
        return;
      }
      // mchopper
      if (stepMchopper(s, p.x, p.y, dt)) {
        this.shots.push({
          id: this.nextId++, ptype: 'sam',
          x: s.x, y: s.y, vx: 0, vy: -60,
          age: 0, life: 4, damage: DAMAGE.sam,
        });
        this.events.push('fire');
      }
      return;
    }
    if (GROUND.has(s.kind)) {
      const fired = s.kind === 'tank'
        ? stepTank(s, this.terrain, p.x, dt)
        : stepAagun(s, p.x, p.y, dt);
      if (fired) {
        const dx = p.x - s.x;
        this.shots.push({
          id: this.nextId++, ptype: 'flak',
          x: s.x, y: s.y - 4,
          vx: Math.max(-140, Math.min(140, dx * 0.8)), vy: -200,
          age: 0, life: 3, damage: DAMAGE.flak,
        });
        this.events.push('fire');
      }
      return;
    }
```
(the old duplicate hitFlash-decay + bubble-emission lines that follow keep working for water kinds; delete the now-duplicated `if (s.hitFlash > 0) s.hitFlash -= dt;` from its old position.)

e) New private method (air-only blast — never touches underwater targets):
```ts
  private scoutBlast(s: Sub): void {
    this.subs = this.subs.filter(o => o.id !== s.id);
    this.damagePlayer(20);
    this.boomParticles(s.x, s.y, 10);
    this.rings.push({ x: s.x, y: s.y, age: 0 });
    this.shake = Math.min(6, this.shake + 2);
    this.events.push('boom');
  }
```

f) Bullet rules — extend `isBulletTarget` and damage application in the bullet branch of `updateShot`:
```ts
      const isBulletTarget = (t: Sub): boolean =>
        AIR.has(t.kind) || GROUND.has(t.kind) ||
        t.kind === 'gunboat' || (t.kind === 'mine' && t.y < WATERLINE + 16);
```
and where damage lands (`s.hp -= p.damage;`) replace with:
```ts
          s.hp -= GROUND.has(s.kind) ? p.damage * 0.5 : p.damage;
```
In the kill branch, special-case the scout so death = blast (no mine chain):
```ts
          if (s.hp <= 0) {
            if (s.kind === 'scout') {
              this.scoutBlast(s);
              this.score += BASE_SCORE_AIRGROUND(s.kind);
              this.kills++;
            } else {
              ...existing kill code...
            }
          }
```
Simplest scoring extension — add to the score table:
```ts
export const BASE_SCORE: Record<SpawnKind, number> = {
  patrol: 100, hunter: 200, missile: 250, gunboat: 150, mine: 50,
  scout: 120, gunship: 300, mchopper: 350, aagun: 180, tank: 250,
};
```
(then the scout branch is just `this.score += BASE_SCORE.scout; this.kills++;` after `scoutBlast` — no helper needed; write it that way.)

g) `'shot'` projectile: straight-line — needs no steering; ensure `updateShot` treats it like an enemy projectile (falls through homing branches untouched, hits terrain, hits player). No code needed beyond the ptype existing — verify the enemy-projectile player-collision path is ptype-agnostic (it is: everything non-bullet).

h) Air enemies must be excluded from the water-enemy movement/shoreline logic — the delegation in (d) returns before it. Also exclude them from `clampSubDepth` etc. (handled by early return).

- [ ] **Step 4: Run to verify pass** — `npx vitest run` all green + typecheck. Report count.

- [ ] **Step 5: Commit**

```bash
git add src/game/world.ts src/game/world.test.ts
git commit -m "feat: air and ground enemies live in world - spawns, AI, category damage rules"
```

---

### Task 4: Player homing missiles

**Files:**
- Modify: `src/game/upgrades.ts`, `src/core/input.ts`, `src/game/world.ts`, `src/main.ts`
- Test: `src/game/upgrades.test.ts`, `src/game/world.test.ts` (append)

**Interfaces:**
- `PlayerStats.missileCap: number` (default 0, max 6). Card `id: 'missiles'`, name "AA Missiles", repeatable, `apply: s => { s.missileCap = Math.min(6, s.missileCap + 2); }`.
- `drawCards(rng, owned, n = 3, act = 1)` — the missiles card only enters the pool when `act >= 2`.
- `Intent.missile: boolean` (edge). Input: `KeyE` keydown queues it; touch FIRE button hold ≥350 ms queues one missile (once per hold).
- World: `missileStock: number` (0 init); `startWave()` grants +1 up to `stats.missileCap`; firing spawns ptype `'pmissile'` homing at nearest AIR enemy (200 px/s, turn 3.0, damage 24, life 4); pmissile collides with air enemies only.

- [ ] **Step 1: Write the failing tests**

Append to `src/game/upgrades.test.ts`:
```ts
describe('AA Missiles card', () => {
  it('is act-gated: absent before act 2, present from act 2', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const c of drawCards(mulberry32(seed), new Set(), 3, 1)) {
        expect(c.id).not.toBe('missiles');
      }
    }
    const everSeen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      for (const c of drawCards(mulberry32(seed), new Set(), 3, 2)) everSeen.add(c.id);
    }
    expect(everSeen.has('missiles')).toBe(true);
  });
  it('stacks +2 up to cap 6', () => {
    const s = defaultStats();
    const card = CARD_POOL.find(c => c.id === 'missiles')!;
    card.apply(s); card.apply(s); card.apply(s); card.apply(s);
    expect(s.missileCap).toBe(6);
  });
});
```
Append to `src/game/world.test.ts` (World describe):
```ts
  it('missile stock refills +1 per wave up to cap', () => {
    const w = new World(mulberry32(1));
    w.stats.missileCap = 4;
    w.startWave();
    expect(w.missileStock).toBe(1);
    for (let i = 0; i < 9; i++) w.startWave();
    expect(w.missileStock).toBe(4);
  });
  it('fires a homing missile at the nearest air enemy and kills a scout in one hit', () => {
    const w = new World(mulberry32(1));
    w.stats.missileCap = 2;
    w.startWave();
    w.missileStock = 2;
    w.subs.length = 0;
    w.subs.push({ id: 701, kind: 'scout', hp: 8, x: w.player.x + 120, y: w.player.y, vx: 0, vy: 0, dir: -1, fireTimer: 9, surfaceTimer: 0, surfaced: false, hitFlash: 0 });
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: true });
    expect(w.missileStock).toBe(1);
    expect(w.shots.some(p => p.ptype === 'pmissile')).toBe(true);
    for (let i = 0; i < 180 && w.subs.length > 0; i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    }
    expect(w.subs.length).toBe(0);
  });
  it('missile input is ignored with zero stock', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: true });
    expect(w.shots.some(p => p.ptype === 'pmissile')).toBe(false);
  });
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

`src/game/upgrades.ts`:
- `PlayerStats` += `missileCap: number;`, `defaultStats()` += `missileCap: 0,`.
- CARD_POOL += (after 'armor'):
```ts
  { id: 'missiles', name: 'AA Missiles', desc: '+2 homing missiles (max 6)', repeatable: true, apply: s => { s.missileCap = Math.min(6, s.missileCap + 2); } },
```
- `drawCards`:
```ts
export function drawCards(rng: Rng, owned: ReadonlySet<string>, n = 3, act = 1): UpgradeCard[] {
  const pool = CARD_POOL.filter(c =>
    (c.repeatable || !owned.has(c.id)) &&
    (c.id !== 'missiles' || act >= 2));
  ...
```

`src/core/input.ts`:
- `Intent` += `missile: boolean;` — poll() returns `missile: this.missileQueued` (cleared on read like drop).
- `private missileQueued = false;` — keydown `KeyE` (non-repeat) sets it.
- Long-press: track `private fireHoldStart = 0; private fireHoldSpent = false;` — in pointerdown when adding to `firePointers`: if set was empty, `fireHoldStart = performance.now(); fireHoldSpent = false;`. In `poll()`: if `firePointers.size > 0 && !this.fireHoldSpent && performance.now() - this.fireHoldStart >= 350` → `this.missileQueued = true; this.fireHoldSpent = true;`.

`src/game/world.ts`:
- Field `missileStock = 0;`
- In `startWave()` (after spawns): `this.missileStock = Math.min(this.stats.missileCap, this.missileStock + (this.stats.missileCap > 0 ? 1 : 0));`
- In `updatePlayer` after the autocannon block:
```ts
    if (intent.missile && this.missileStock > 0) {
      const target = this.nearestAir(p.x, p.y);
      if (target) {
        this.missileStock--;
        const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
        this.shots.push({
          id: this.nextId++, ptype: 'pmissile',
          x: p.x, y: p.y - 4,
          vx: ((target.x - p.x) / d) * 200, vy: ((target.y - p.y) / d) * 200,
          age: 0, life: 4, damage: 24,
        });
        this.events.push('fire');
      }
    }
```
- Helper:
```ts
  private nearestAir(x: number, y: number): Sub | null {
    let best: Sub | null = null, bd = Infinity;
    for (const s of this.subs) {
      if (!AIR.has(s.kind)) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
```
- `updateShot` — pmissile branch (before the bullet branch):
```ts
    if (p.ptype === 'pmissile') {
      const t = this.nearestAir(p.x, p.y);
      if (t) steerHoming(p, t.x, t.y, 200, 3.0, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      for (const s of this.subs) {
        if (!AIR.has(s.kind)) continue;
        if (circlesOverlap({ x: p.x, y: p.y, r: 4 }, { x: s.x, y: s.y, r: 10 })) {
          s.hp -= p.damage;
          s.hitFlash = 0.1;
          p.age = p.life;
          if (s.hp <= 0) {
            if (s.kind === 'scout') { this.scoutBlast(s); }
            else {
              this.subs = this.subs.filter(o => o.id !== s.id);
              this.boomParticles(s.x, s.y, 10);
              this.rings.push({ x: s.x, y: s.y, age: 0 });
              this.events.push('boom');
            }
            this.score += BASE_SCORE[s.kind];
            this.kills++;
          }
          return;
        }
      }
      return;
    }
```
(note: pmissile skips terrain/water kill checks — it may fly over land; give it the same terrain check as other projectiles at the start of its branch: if `!isWater && y >= surfaceAt` → expire with puff.)

`src/main.ts`: pass act into card draws — `cards = drawCards(mulberry32(...), world.owned, 3, world.act);`

- [ ] **Step 4: Run to verify pass** — full suite + typecheck; report count.

- [ ] **Step 5: Commit**

```bash
git add src/game/upgrades.ts src/game/upgrades.test.ts src/core/input.ts src/game/world.ts src/game/world.test.ts src/main.ts
git commit -m "feat: AA missile weapon - act-gated card, stock, homing shots, E/long-press"
```

---

### Task 5: Sprites for new units

**Files:**
- Modify: `src/render/sprites.ts`

- [ ] **Step 1: Implement** — add to `makeSheet()` (canvas already 192×96; use free area y=64..96) and the frames map:
```ts
  // --- enemy choppers at y=64: scout 14x8 (0,64), gunship 24x12 (16,64), mchopper 22x12 (44,64)
  // scout: tiny drone, red accent
  px(2, 68, 10, 3, '#7a3f3f');
  px(4, 67, 4, 1, '#9a5a5a');
  px(1, 66, 12, 1, '#cccccc');      // rotor
  px(11, 69, 2, 1, '#ff5544');      // tail light
  // gunship: dark green attack heli, nose right
  px(18, 69, 14, 5, '#3f5138');
  px(28, 70, 4, 3, '#2e3c29');      // nose
  px(26, 69, 4, 2, '#88aacc');      // canopy
  px(16, 70, 4, 2, '#2e3c29');      // tail
  px(17, 66, 12, 1, '#cccccc');     // rotor
  px(20, 74, 8, 1, '#222222');      // skid
  // mchopper: grey with missile pods, nose right
  px(46, 69, 12, 5, '#5a6068');
  px(56, 70, 4, 3, '#464c54');      // nose
  px(54, 69, 3, 2, '#88aacc');      // canopy
  px(44, 70, 4, 2, '#464c54');      // tail
  px(45, 66, 11, 1, '#cccccc');     // rotor
  px(48, 74, 3, 2, '#31363f');      // pod L
  px(53, 74, 3, 2, '#31363f');      // pod R
  // --- ground at y=80: aagun 12x8 (0,80), tank 18x10 (16,80)
  px(2, 84, 8, 3, '#6a6f78');       // aagun base
  px(5, 81, 2, 4, '#464c54');       // mount
  px(6, 80, 5, 1, '#31363f');       // barrel (up-right)
  px(18, 84, 14, 4, '#55603f');     // tank hull
  px(21, 81, 7, 3, '#48522f');      // turret
  px(27, 82, 6, 1, '#31363f');      // barrel
  px(18, 88, 14, 1, '#222222');     // tracks
  // --- player missile 6x2 at (68,64)
  px(68, 64, 5, 2, '#e8eef4');
  px(73, 64, 1, 2, '#ffcc66');
```
frames map additions:
```ts
      scout:    { x: 0,  y: 64, w: 14, h: 8 },
      gunship:  { x: 16, y: 64, w: 24, h: 12 },
      mchopper: { x: 44, y: 64, w: 22, h: 12 },
      aagun:    { x: 0,  y: 80, w: 12, h: 8 },
      tank:     { x: 16, y: 80, w: 18, h: 10 },
      pmissile: { x: 68, y: 64, w: 6,  h: 2 },
```

- [ ] **Step 2: Verify** — typecheck + full suite green.

- [ ] **Step 3: Commit**

```bash
git add src/render/sprites.ts
git commit -m "feat: sprites for choppers, AA gun, tank, player missile"
```

---

### Task 6: Renderer for new units + missile pips

**Files:**
- Modify: `src/render/renderer.ts`

- [ ] **Step 1: Implement**

a) Enemy draw loop: current code keys frames by `s.kind` for water kinds and mine — the new kinds' frame names match their `kind` values exactly (scout/gunship/mchopper/aagun/tank), so the existing `dr(s.kind, s.x, s.y, s.dir < 0)` path in the non-mine branch already works. Verify the sonar-outline condition excludes air/ground kinds:
```ts
      if (world.sonarTimer > 0 && s.kind !== 'gunboat' && !AIR.has(s.kind) && !GROUND.has(s.kind)) {
```
(add `import { AIR, GROUND } from '../game/waves';`).

b) Shots: draw `'shot'` as a 2px red-orange tracer and `'pmissile'` rotated like the sam:
```ts
      } else if (p.ptype === 'shot') {
        ctx.fillStyle = '#ff9a66';
        ctx.fillRect(Math.round(p.x - cam) - 1, Math.round(p.y + oy) - 1, 3, 2);
      } else {
        const rot = Math.atan2(p.vy, p.vx);
        dr(p.ptype === 'sam' ? 'sam' : p.ptype === 'pmissile' ? 'pmissile' : 'torpedo',
          p.x, p.y, false, p.ptype === 'sam' ? rot + Math.PI / 2 : rot);
      }
```

c) HUD missile pips (after charge pips):
```ts
    if (world.stats.missileCap > 0) {
      for (let i = 0; i < world.stats.missileCap; i++) {
        ctx.fillStyle = i < world.missileStock ? '#8ad0ff' : '#444';
        ctx.fillRect(60 + i * 5, 17, 3, 6);
      }
    }
```

- [ ] **Step 2: Verify** — typecheck + suite + build green.

- [ ] **Step 3: Commit**

```bash
git add src/render/renderer.ts
git commit -m "feat: render new enemy units, enemy tracers, missile pips"
```

---

### Task 7: Playtest + final review

- [ ] **Step 1: Manual verification (preview tools, __world dev hook)**

1. Act 1 unchanged (regression).
2. Act 2 coast: scouts dive at player and explode on contact; gunship holds standoff + bursts; mchopper lobs homing missiles, flees when chased (and is catchable); AA gun on the beach fires flak; all die appropriately (bullets vs air, bombs vs AA).
3. Act 3 inland: full ground+air roster, tanks patrol plateau, no subs; rotation continues to Act 4 sea.
4. AA Missiles card appears in act ≥ 2 picks; E fires homing missile with pip decrement; missile chases and kills a chopper; pips refill +1 per wave.
5. Touch: long-press FIRE ≥350 ms launches missile once per hold.
6. Scout death near a mine leaves the mine intact.
7. No console errors, steady FPS with full roster.

Fix findings with `fix:` commits.

- [ ] **Step 2: Final whole-branch review** (requesting-code-review template, review package from merge-base), then finishing-a-development-branch.

---

## Self-review

- **Spec coverage (plan-2 slice):** 3 chopper types + AA + tank with exact costs/hp (T1/T2/T3), per-biome pools + inland rotation (T1), player missiles exact numbers + act-gated card + long-press + stock refill (T4), category damage rules (T3), guardrail tests: flee cap 90 (T2 test), scout-no-mine-chain (T3 test), sea RNG parity (T1 test). Sprites/renderer (T5/T6). ✓
- **Placeholders:** none. ✓
- **Type consistency:** SpawnKind extension single-sourced in waves.ts; AIR/GROUND consumed by world + renderer; ptype 'shot'/'pmissile' in types.ts, produced/consumed in world/renderer; `missileCap`/`missileStock`/`Intent.missile`/`drawCards(...,act)` names consistent across T4 files. ✓
