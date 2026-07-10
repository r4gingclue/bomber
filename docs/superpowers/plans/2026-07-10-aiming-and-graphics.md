# Pointer Aiming & Graphics Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 360° pointer-controlled autocannon with a rotating chin turret, animated helicopter turn motion, and a full graphics pass (sprites, environment, FX, touch UI).

**Architecture:** New pure-math module `game/aim.ts` (unit tested) feeds both world simulation and renderer. `Intent` gains an optional world-space `aim` point resolved in main.ts (mouse point + camX, or touch aim-stick via `aimFromStick`). World owns all FX state (shake, rings, hit flashes, particle emissions); renderer stays read-only. Sprite sheet regenerated at higher detail.

**Tech Stack:** Existing: TypeScript 5, Vite 6, Vitest 2, Canvas 2D. No new deps.

**Spec:** `docs/superpowers/specs/2026-07-10-aiming-and-graphics-design.md`
**Baseline:** main @ f7c04d8, 39 tests green. Work on branch `aim-graphics`.

## File map

```
src/game/aim.ts            — NEW: angleTo, easeAngle, bankFrame, aimFromStick   [tested]
src/game/aim.test.ts       — NEW
src/game/entities/types.ts — Player += turretAngle, muzzleT; Sub += hitFlash
src/game/world.ts          — turret ease, aimed bullets, facing rule, shake/rings/
                             hitFlash/smoke/bubbles/flame emissions              [tested]
src/core/input.ts          — mouse aim tracking, touch aim stick, canvas-space
                             FIRE/DROP buttons, touchSeen, touchButtons() export
src/render/sprites.ts      — regenerated sheet: 6 heli frames, turret, detailed enemies
src/render/renderer.ts     — turnScale/pitch, turret+muzzle, env layers, FX, touch UI
src/main.ts                — aim resolution, touchSeen pass-through
```

---

### Task 0: Branch

- [ ] **Step 1:**
```bash
cd /Users/paulcooke/Documents/Projects/Bomber
git checkout -b aim-graphics
npx vitest run   # expect 39 passing before starting
```

---

### Task 1: Aim math helpers

**Files:**
- Create: `src/game/aim.ts`
- Test: `src/game/aim.test.ts`

- [ ] **Step 1: Write the failing test**

`src/game/aim.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { angleTo, easeAngle, bankFrame, aimFromStick } from './aim';

describe('angleTo', () => {
  it('points right at 0', () => {
    expect(angleTo(0, 0, 10, 0)).toBeCloseTo(0);
  });
  it('points down at +PI/2 (canvas y grows downward)', () => {
    expect(angleTo(0, 0, 0, 10)).toBeCloseTo(Math.PI / 2);
  });
  it('points left at PI', () => {
    expect(Math.abs(angleTo(5, 5, -10, 5))).toBeCloseTo(Math.PI);
  });
});

describe('easeAngle', () => {
  it('steps toward target without overshooting', () => {
    expect(easeAngle(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(easeAngle(0.9, 1, 0.25)).toBeCloseTo(1);
  });
  it('takes the short way across the ±PI boundary', () => {
    const a = easeAngle(3.0, -3.0, 0.2); // short way is +0.2 (wrapping past PI)
    expect(a).toBeCloseTo(-Math.PI * 2 + 3.2, 5); // 3.2 wrapped into (-PI, PI]
  });
  it('stays within (-PI, PI]', () => {
    let a = 3.1;
    for (let i = 0; i < 20; i++) a = easeAngle(a, -3.1, 0.3);
    expect(a).toBeGreaterThan(-Math.PI - 1e-9);
    expect(a).toBeLessThanOrEqual(Math.PI + 1e-9);
    expect(Math.cos(a)).toBeCloseTo(Math.cos(-3.1), 1);
  });
});

describe('bankFrame', () => {
  it('selects by |vx| thresholds 30/90', () => {
    expect(bankFrame(0)).toBe(0);
    expect(bankFrame(-29)).toBe(0);
    expect(bankFrame(30)).toBe(1);
    expect(bankFrame(-89)).toBe(1);
    expect(bankFrame(90)).toBe(2);
    expect(bankFrame(-300)).toBe(2);
  });
});

describe('aimFromStick', () => {
  it('returns null inside the deadzone', () => {
    expect(aimFromStick(100, 50, 3, -3)).toBeNull();
  });
  it('projects a point 200px from the player along the stick direction', () => {
    const p = aimFromStick(100, 50, 40, 0)!;
    expect(p.x).toBeCloseTo(300);
    expect(p.y).toBeCloseTo(50);
    const q = aimFromStick(0, 0, 0, -30)!;
    expect(q.x).toBeCloseTo(0);
    expect(q.y).toBeCloseTo(-200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/aim.test.ts`
Expected: FAIL — cannot resolve `./aim`.

- [ ] **Step 3: Implement**

`src/game/aim.ts`:
```ts
/** Angle from (px,py) to (ax,ay) in radians, canvas convention (y down). */
export function angleTo(px: number, py: number, ax: number, ay: number): number {
  return Math.atan2(ay - py, ax - px);
}

/** Move `current` toward `target` by at most `maxStep`, taking the short way
 * around the circle. Result normalized to (-PI, PI]. */
export function easeAngle(current: number, target: number, maxStep: number): number {
  let d = target - current;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  let a = current + Math.max(-maxStep, Math.min(maxStep, d));
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Bank sprite row from horizontal speed: 0 level, 1 lean, 2 hard. */
export function bankFrame(vx: number): 0 | 1 | 2 {
  const s = Math.abs(vx);
  return s < 30 ? 0 : s < 90 ? 1 : 2;
}

/** Convert an aim-stick displacement into a world aim point `dist` px from
 * the player. Returns null inside the 8px deadzone. */
export function aimFromStick(
  px: number, py: number, dx: number, dy: number, dist = 200,
): { x: number; y: number } | null {
  const len = Math.hypot(dx, dy);
  if (len < 8) return null;
  return { x: px + (dx / len) * dist, y: py + (dy / len) * dist };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/aim.test.ts` — Expected: PASS (9 tests). `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/aim.ts src/game/aim.test.ts
git commit -m "feat: aim math helpers (angle, ease, bank, stick)"
```

---

### Task 2: World aiming + FX state

**Files:**
- Modify: `src/game/entities/types.ts` (Player, Sub)
- Modify: `src/game/world.ts`
- Modify: `src/core/input.ts` (Intent only — one optional field)
- Test: `src/game/world.test.ts` (append)

- [ ] **Step 1: Extend Intent (optional field — existing tests stay valid)**

In `src/core/input.ts`, change the `Intent` interface to:
```ts
export interface Intent {
  move: { x: number; y: number };
  drop: boolean;
  fire: boolean;
  /** world-space aim point; resolved by main.ts from mouse or aim stick */
  aim?: { x: number; y: number } | null;
}
```

- [ ] **Step 2: Extend entity types**

In `src/game/entities/types.ts`:

Add to `Player`:
```ts
  turretAngle: number;
  muzzleT: number;
```
Add to `Sub`:
```ts
  hitFlash: number;
```

- [ ] **Step 3: Write the failing tests**

Append to `src/game/world.test.ts` (inside the existing `describe('World', ...)` block; also add `import { easeAngle } from './aim';` is NOT needed — tests below use World only):
```ts
  it('fires bullets toward the aim point', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.turretAngle = 0;
    const aim = { x: w.player.x + 100, y: w.player.y - 100 }; // up-right
    // let the turret settle on the target first
    for (let i = 0; i < 60; i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, aim });
    }
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: true, aim });
    const bullet = w.shots.find(s => s.ptype === 'bullet')!;
    expect(bullet).toBeDefined();
    expect(bullet.vx).toBeGreaterThan(0);
    expect(bullet.vy).toBeLessThan(0);
    expect(Math.hypot(bullet.vx, bullet.vy)).toBeCloseTo(300, 0);
  });

  it('turret eases toward the aim target instead of snapping', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.turretAngle = 0;
    const aim = { x: w.player.x, y: w.player.y + 100 }; // straight down: target PI/2
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, aim });
    expect(w.player.turretAngle).toBeGreaterThan(0);
    expect(w.player.turretAngle).toBeLessThan(Math.PI / 2); // not snapped
  });

  it('shake decays toward zero and is capped', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.shake = 100;
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    expect(w.shake).toBeLessThan(100);
    for (let i = 0; i < 600; i++) w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    expect(w.shake).toBe(0);
  });

  it('blast rings expire after 0.3s', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.rings.push({ x: 0, y: 200, age: 0 });
    for (let i = 0; i < 30; i++) w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    expect(w.rings.length).toBe(0);
  });
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/game/world.test.ts`
Expected: FAIL — `rings`/`shake` don't exist, turret doesn't move, bullet vy is 0.
(Also expect a typecheck error until Step 5 adds the fields — that's the failing state.)

- [ ] **Step 5: Implement world changes**

In `src/game/world.ts`:

a) Add import:
```ts
import { angleTo, easeAngle } from './aim';
```

b) Player initializer — add the two new fields:
```ts
  player: Player = { x: VIEW_W / 2, y: 60, vx: 0, vy: 0, hp: 100, iframes: 0, facing: 1, fireCd: 0, pdCd: 0, turretAngle: 0, muzzleT: 0 };
```

c) New public/private state on `World` (next to `sonarTimer` etc.):
```ts
  shake = 0;
  rings: { x: number; y: number; age: number }[] = [];
  private smokeT = 0;
```

d) `spawn()` — add `hitFlash: 0,` to the Sub literal (after `surfaced: false,`).

e) In `update()` after the sonar block, before the camera block, add:
```ts
    this.shake = Math.max(0, this.shake - 8 * dt);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].age += dt;
      if (this.rings[i].age > 0.3) this.rings.splice(i, 1);
    }
```

f) In `updatePlayer()` — REPLACE the facing line
```ts
    if (intent.move.x !== 0) p.facing = intent.move.x > 0 ? 1 : -1;
```
with turret + facing logic:
```ts
    const aim = intent.aim ?? null;
    if (aim) {
      const target = angleTo(p.x, p.y, aim.x, aim.y);
      p.turretAngle = easeAngle(p.turretAngle, target, 10 * dt);
    }
    if (intent.fire && aim) p.facing = Math.cos(p.turretAngle) >= 0 ? 1 : -1;
    else if (Math.abs(p.vx) > 15) p.facing = p.vx > 0 ? 1 : -1;
    if (p.muzzleT > 0) p.muzzleT -= dt;
```

g) In `updatePlayer()` — REPLACE the autocannon shot push
```ts
      this.shots.push({
        id: this.nextId++, ptype: 'bullet',
        x: p.x + p.facing * 12, y: p.y + 2,
        vx: p.facing * 300, vy: 0,
        age: 0, life: 0.7, damage: 8,
      });
```
with:
```ts
      const a = (intent.aim ?? null) ? p.turretAngle : (p.facing > 0 ? 0 : Math.PI);
      this.shots.push({
        id: this.nextId++, ptype: 'bullet',
        x: p.x + Math.cos(a) * 12, y: p.y + 4 + Math.sin(a) * 12,
        vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
        age: 0, life: 0.7, damage: 8,
      });
      p.muzzleT = 0.05;
```

h) At the end of `updatePlayer()` add the damage-smoke emitter:
```ts
    if (p.hp > 0 && p.hp < this.stats.maxHp * 0.4) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.08;
        this.particles.push({
          id: this.nextId++, x: p.x - p.facing * 10, y: p.y,
          vx: -p.facing * 20, vy: -10,
          life: 0.8, maxLife: 0.8, color: '#3a3f46', size: 2,
        });
      }
    }
```

i) In `damagePlayer()` after `this.events.push('hit');` add:
```ts
    this.shake = Math.min(8, this.shake + 4);
```

j) In `updateCharges()` — in the `if (killed.length > 0)` / blast-resolution tail, after `for (const b of blasts) this.boomParticles(b.x, b.y, 10);` add:
```ts
    for (const b of blasts) this.rings.push({ x: b.x, y: b.y, age: 0 });
    this.shake = Math.min(6, this.shake + 2);
```

k) In `updateShot()` bullet branch — where a bullet damages a target (`s.hp -= p.damage;`), add on the next line:
```ts
          s.hitFlash = 0.1;
```
And in the kill branch (`if (s.hp <= 0) { ... }`) after `this.boomParticles(s.x, s.y, 10);` add:
```ts
            this.rings.push({ x: s.x, y: s.y, age: 0 });
            this.shake = Math.min(6, this.shake + 2);
```

l) In `updateSub()` — first line of the method body, add hit-flash decay + prop-wash bubbles:
```ts
    if (s.hitFlash > 0) s.hitFlash -= dt;
    if (s.kind !== 'gunboat' && s.kind !== 'mine' && this.rng() < dt * 3) {
      this.particles.push({
        id: this.nextId++, x: s.x - s.dir * 12, y: s.y, vx: 0, vy: -12,
        life: 1, maxLife: 1, color: '#9fd8ff', size: 1,
      });
    }
```

m) In `updateShot()` SAM branch (`} else if (p.ptype === 'sam') {`) add exhaust flame after the steer call:
```ts
      if (this.rng() < dt * 40) {
        this.particles.push({
          id: this.nextId++, x: p.x, y: p.y + 5, vx: (this.rng() - 0.5) * 20, vy: 40,
          life: 0.25, maxLife: 0.25, color: '#ff9a44', size: 2,
        });
      }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run` — Expected: 44 tests pass (40 prior + 4 new). `npm run typecheck` clean.
(Note: v1 suite ended at 40 tests after the mine regression test; verify actual count and report.)

- [ ] **Step 7: Commit**

```bash
git add src/game/world.ts src/game/world.test.ts src/game/entities/types.ts src/core/input.ts
git commit -m "feat: turret aiming, aimed bullets, screen shake, blast rings, hit FX state"
```

---

### Task 3: Input — mouse aim, touch aim stick, canvas buttons

**Files:**
- Modify: `src/core/input.ts`

- [ ] **Step 1: Implement**

Replace `src/core/input.ts` (keeping the Task 2 `Intent` shape) with:
```ts
import { VIEW_W, VIEW_H } from '../game/consts';

export interface Intent {
  move: { x: number; y: number };
  drop: boolean;
  fire: boolean;
  /** world-space aim point; resolved by main.ts from mouse or aim stick */
  aim?: { x: number; y: number } | null;
}

/** Canvas-space touch button layout, shared with the renderer. */
export function touchButtons(): {
  fire: { x: number; y: number; r: number };
  drop: { x: number; y: number; r: number };
} {
  return {
    fire: { x: VIEW_W - 30, y: VIEW_H - 80, r: 18 },
    drop: { x: VIEW_W - 30, y: VIEW_H - 32, r: 18 },
  };
}

const inCircle = (cx: number, cy: number, b: { x: number; y: number; r: number }) =>
  (cx - b.x) ** 2 + (cy - b.y) ** 2 <= b.r ** 2;

export class Input {
  private keys = new Set<string>();
  private dropQueued = false;
  private confirmQueued = false;
  private cardKeyQueued = -1;
  private mouseFire = false;
  private firePointers = new Set<number>();
  private stick = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
  private aimStick = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
  private mouseAim: { x: number; y: number } | null = null;
  /** true once any touch input has been seen (renderer shows touch UI) */
  touchSeen = false;
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
    window.addEventListener('blur', () => this.keys.clear());

    el.addEventListener('pointerdown', e => {
      this.onGesture?.();
      const canvasPt = this.toCanvas ? this.toCanvas(e.clientX, e.clientY) : null;
      if (canvasPt && this.onTap) this.onTap(canvasPt[0], canvasPt[1]);
      if (e.pointerType === 'mouse') {
        this.mouseFire = true;
        if (canvasPt) this.mouseAim = { x: canvasPt[0], y: canvasPt[1] };
        return;
      }
      this.touchSeen = true;
      if (e.clientX < window.innerWidth / 2) {
        this.stick = { active: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 };
        return;
      }
      const b = touchButtons();
      if (canvasPt && inCircle(canvasPt[0], canvasPt[1], b.fire)) {
        this.firePointers.add(e.pointerId);
      } else if (canvasPt && inCircle(canvasPt[0], canvasPt[1], b.drop)) {
        this.dropQueued = true;
      } else {
        this.aimStick = { active: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 };
      }
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' && this.toCanvas) {
        const [cx, cy] = this.toCanvas(e.clientX, e.clientY);
        this.mouseAim = { x: cx, y: cy };
        return;
      }
      if (this.stick.active && e.pointerId === this.stick.id) {
        this.stick.dx = e.clientX - this.stick.sx;
        this.stick.dy = e.clientY - this.stick.sy;
      }
      if (this.aimStick.active && e.pointerId === this.aimStick.id) {
        this.aimStick.dx = e.clientX - this.aimStick.sx;
        this.aimStick.dy = e.clientY - this.aimStick.sy;
      }
    });
    const release = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.mouseFire = false;
      if (this.stick.active && e.pointerId === this.stick.id) this.stick.active = false;
      if (this.aimStick.active && e.pointerId === this.aimStick.id) this.aimStick.active = false;
      this.firePointers.delete(e.pointerId);
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
      fire: this.keys.has('KeyF') || this.mouseFire || this.firePointers.size > 0,
      aim: null,
    };
  }

  /** Latest mouse position in canvas coords, or null before any mouse motion. */
  aimCanvasPoint(): { x: number; y: number } | null {
    return this.mouseAim;
  }

  /** Raw aim-stick displacement in client px while active, else null. */
  aimStickDir(): { dx: number; dy: number } | null {
    return this.aimStick.active ? { dx: this.aimStick.dx, dy: this.aimStick.dy } : null;
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

Run: `npm run typecheck && npx vitest run` — clean, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/core/input.ts
git commit -m "feat: mouse aim tracking, touch aim stick, canvas fire/drop buttons"
```

---

### Task 4: Sprite sheet upgrade

**Files:**
- Modify: `src/render/sprites.ts` (full replace)

- [ ] **Step 1: Implement**

Replace `src/render/sprites.ts` with:
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
  canvas.width = 192;
  canvas.height = 96;
  const c = canvas.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };

  // --- helicopter 32x16, rows = bank (0 level, 1 lean, 2 hard), cols = rotor frame
  const heli = (ox: number, oy: number, bank: number, rotor: number) => {
    const n = bank;        // nose dips with bank
    const t = -bank;       // tail rises with bank
    px(ox + 20, oy + 7 + t, 9, 2, '#3c4b30');       // tail boom
    px(ox + 28, oy + 4 + t, 2, 5, '#3c4b30');       // tail fin
    px(ox + 30, oy + 5 + t, 2, 1, '#5a6d48');       // tail rotor
    px(ox + 5, oy + 6, 16, 6, '#4a5d3a');           // fuselage
    px(ox + 5, oy + 6, 16, 2, '#5f7549');           // top highlight
    px(ox + 4, oy + 8 + n, 4, 3, '#3c4b30');        // gunner nose
    px(ox + 7, oy + 6, 6, 3, '#9fd8ff');            // canopy
    px(ox + 8, oy + 7, 2, 1, '#e8f6ff');            // canopy glint
    px(ox + 6, oy + 11, 14, 1, '#2b3622');          // belly
    px(ox + 11, oy + 10, 7, 2, '#3c4b30');          // stub wings
    px(ox + 6, oy + 13, 4, 1, '#222222');           // skids
    px(ox + 15, oy + 13, 4, 1, '#222222');
    px(ox + 8, oy + 12, 1, 1, '#222222');
    px(ox + 16, oy + 12, 1, 1, '#222222');
    px(ox + 12, oy + 3, 2, 3, '#222222');           // rotor mast
    if (rotor === 0) px(ox + 2, oy + 2, 22, 1, '#cccccc');
    else px(ox + 6, oy + 2, 14, 1, 'rgba(220,220,220,0.6)');
  };
  for (let bank = 0; bank < 3; bank++) {
    for (let rotor = 0; rotor < 2; rotor++) heli(rotor * 32, bank * 16, bank, rotor);
  }

  // --- chin turret 8x4 at (64,0); pivot drawn at (66,2), barrel points right
  px(64, 0, 3, 4, '#39424e');
  px(67, 1, 5, 2, '#222831');

  // --- subs 26x12 at y=48: patrol(0), hunter(28), missile(56)
  const sub = (ox: number, hi: string, mid: string, lo: string, accent: string) => {
    const oy = 48;
    px(ox + 1, oy + 4, 24, 6, mid);           // hull
    px(ox + 2, oy + 4, 22, 2, hi);            // top highlight
    px(ox + 2, oy + 8, 22, 2, lo);            // bottom shadow
    px(ox + 0, oy + 5, 1, 4, accent);         // nose cap
    px(ox + 25, oy + 5, 1, 4, accent);        // tail cap
    px(ox + 24, oy + 2, 2, 2, accent);        // rudder
    px(ox + 9, oy + 0, 6, 4, mid);            // conning tower
    px(ox + 10, oy + 1, 3, 2, '#9fd8ff');     // window
    px(ox + 15, oy + 0, 1, 3, accent);        // periscope
    px(ox + 3, oy + 6, 20, 1, accent);        // stripe
  };
  sub(0,  '#f5dd6a', '#e8c832', '#b09420', '#8a7014');
  sub(28, '#f5a55a', '#e88232', '#b0611f', '#8a4a12');
  sub(56, '#cf92ee', '#b06ee0', '#8449ad', '#5f3380');

  // --- gunboat 30x14 at (84,48)
  const gx = 84, gy = 48;
  px(gx + 1, gy + 8, 28, 4, '#8a8f98');       // hull
  px(gx + 2, gy + 8, 26, 1, '#b8bdc8');       // deck highlight
  px(gx + 0, gy + 9, 1, 2, '#6a6f78');        // bow
  px(gx + 8, gy + 3, 10, 5, '#a8adb8');       // superstructure
  px(gx + 10, gy + 4, 3, 2, '#3d5a7a');       // bridge window
  px(gx + 20, gy + 5, 6, 3, '#7a7f88');       // aft mount
  px(gx + 21, gy + 2, 2, 3, '#555a63');       // turret
  px(gx + 23, gy + 3, 5, 1, '#31363f');       // barrel
  px(gx + 1, gy + 12, 28, 1, '#5a5f68');      // waterline shadow

  // --- mine 10x10 at (120,0)
  const mx = 120, my = 0;
  px(mx + 3, my + 3, 4, 4, '#39424e');
  px(mx + 4, my + 2, 2, 1, '#4a5560');
  px(mx + 4, my + 0, 2, 2, '#2b333d');
  px(mx + 4, my + 8, 2, 2, '#2b333d');
  px(mx + 0, my + 4, 2, 2, '#2b333d');
  px(mx + 8, my + 4, 2, 2, '#2b333d');
  px(mx + 1, my + 1, 2, 2, '#2b333d');
  px(mx + 7, my + 1, 2, 2, '#2b333d');
  px(mx + 1, my + 7, 2, 2, '#2b333d');
  px(mx + 7, my + 7, 2, 2, '#2b333d');
  px(mx + 4, my + 4, 2, 2, '#ff5544');        // light (renderer blinks over it)

  // --- torpedo 10x4 at (132,0)
  px(132, 1, 8, 2, '#d8dde4');
  px(140, 1, 2, 2, '#ff8844');
  px(132, 0, 3, 1, '#8a8f98');
  px(132, 3, 3, 1, '#8a8f98');

  // --- SAM 4x12 at (144,0), pointing up
  px(145, 0, 2, 3, '#ffcc66');
  px(144, 3, 4, 7, '#d8dde4');
  px(144, 10, 1, 2, '#8a8f98');
  px(147, 10, 1, 2, '#8a8f98');
  px(145, 10, 2, 2, '#ff8844');

  // --- depth charge 4x6 at (152,0)
  px(152, 0, 4, 5, '#5a6470');
  px(153, 0, 2, 1, '#7a8492');
  px(153, 5, 2, 1, '#3a424c');

  return {
    canvas,
    frames: {
      heli00: { x: 0,  y: 0,  w: 32, h: 16 },
      heli01: { x: 32, y: 0,  w: 32, h: 16 },
      heli10: { x: 0,  y: 16, w: 32, h: 16 },
      heli11: { x: 32, y: 16, w: 32, h: 16 },
      heli20: { x: 0,  y: 32, w: 32, h: 16 },
      heli21: { x: 32, y: 32, w: 32, h: 16 },
      turret: { x: 64, y: 0,  w: 8,  h: 4 },
      patrol: { x: 0,  y: 48, w: 26, h: 12 },
      hunter: { x: 28, y: 48, w: 26, h: 12 },
      missile:{ x: 56, y: 48, w: 26, h: 12 },
      gunboat:{ x: 84, y: 48, w: 30, h: 14 },
      mine:   { x: 120, y: 0, w: 10, h: 10 },
      torpedo:{ x: 132, y: 0, w: 10, h: 4 },
      sam:    { x: 144, y: 0, w: 4,  h: 12 },
      charge: { x: 152, y: 0, w: 4,  h: 6 },
    },
  };
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npx vitest run` — clean. (Renderer still references old keys `heli0`/`heli1` — it compiles because frames is `Record<string, Frame>`; renderer is replaced next task. Do NOT ship between Task 4 and Task 5 — they land as consecutive commits on the feature branch.)

- [ ] **Step 3: Commit**

```bash
git add src/render/sprites.ts
git commit -m "feat: high-detail sprite sheet - banked heli frames, turret, shaded enemies"
```

---

### Task 5: Renderer upgrade

**Files:**
- Modify: `src/render/renderer.ts` (full replace)

- [ ] **Step 1: Implement**

Replace `src/render/renderer.ts` with:
```ts
import { VIEW_W, VIEW_H, WATERLINE } from '../game/consts';
import type { World } from '../game/world';
import type { Phase } from '../game/state';
import type { UpgradeCard } from '../game/upgrades';
import { bankFrame } from '../game/aim';
import { touchButtons } from '../core/input';
import type { Sheet } from './sprites';

export function cardRect(i: number): { x: number; y: number; w: number; h: number } {
  return { x: 40 + i * 140, y: 80, w: 120, h: 110 };
}

interface CloudSpec { x: number; y: number; w: number }
const CLOUDS_FAR: CloudSpec[] = Array.from({ length: 8 }, (_, i) => ({
  x: (i * 233) % 960, y: 8 + (i * 29) % 50, w: 40 + (i * 61) % 50,
}));
const CLOUDS_NEAR: CloudSpec[] = Array.from({ length: 6 }, (_, i) => ({
  x: (i * 331) % 960, y: 60 + (i * 43) % 60, w: 26 + (i * 53) % 34,
}));

const wrapX = (x: number, cam: number, factor: number) =>
  ((x - cam * factor) % 960 + 960) % 960 - 240;

export class Renderer {
  private lastT = 0;
  private turnScale = 1;

  constructor(private ctx: CanvasRenderingContext2D, private sheet: Sheet) {
    ctx.imageSmoothingEnabled = false;
  }

  draw(world: World, phase: Phase, cards: UpgradeCard[], t: number, touchUI: boolean): void {
    const { ctx } = this;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    const shx = world.shake ? (Math.random() * 2 - 1) * world.shake : 0;
    const shy = world.shake ? (Math.random() * 2 - 1) * world.shake : 0;
    const cam = world.camX + shx;
    const oy = shy; // vertical shake offset for world-space drawing

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, WATERLINE);
    sky.addColorStop(0, '#2a4a9e');
    sky.addColorStop(1, '#7ba6e0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // far clouds
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (const cl of CLOUDS_FAR) {
      const x = wrapX(cl.x, cam, 0.15);
      ctx.fillRect(x, cl.y + oy * 0.3, cl.w, 4);
      ctx.fillRect(x + 8, cl.y - 2 + oy * 0.3, cl.w - 16, 2);
    }
    // horizon haze
    ctx.fillStyle = 'rgba(230,240,255,0.25)';
    ctx.fillRect(0, WATERLINE - 22 + oy, VIEW_W, 22);
    // near clouds
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const cl of CLOUDS_NEAR) {
      const x = wrapX(cl.x, cam, 0.4);
      ctx.fillRect(x, cl.y + oy * 0.6, cl.w, 5);
      ctx.fillRect(x + 6, cl.y - 3 + oy * 0.6, cl.w - 12, 3);
    }
    // sea with depth fog
    const sea = ctx.createLinearGradient(0, WATERLINE, 0, VIEW_H);
    sea.addColorStop(0, '#0e4a8a');
    sea.addColorStop(0.5, '#082d58');
    sea.addColorStop(1, '#03101f');
    ctx.fillStyle = sea;
    ctx.fillRect(0, WATERLINE + oy, VIEW_W, VIEW_H - WATERLINE);
    // light rays (fade out by mid-depth)
    const midY = (WATERLINE + VIEW_H) / 2;
    ctx.fillStyle = 'rgba(159,216,255,0.06)';
    for (let i = 0; i < 4; i++) {
      const rx = wrapX(i * 130, cam, 0.6) + Math.sin(t * 0.3 + i) * 8;
      ctx.beginPath();
      ctx.moveTo(rx, WATERLINE + oy);
      ctx.lineTo(rx + 26, WATERLINE + oy);
      ctx.lineTo(rx + 44, midY + oy);
      ctx.lineTo(rx + 8, midY + oy);
      ctx.fill();
    }
    // sun glare on water
    const glx = wrapX(300, cam, 0.9);
    const glare = ctx.createRadialGradient(glx, WATERLINE + 6 + oy, 2, glx, WATERLINE + 6 + oy, 60);
    glare.addColorStop(0, 'rgba(255,244,200,0.25)');
    glare.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(glx - 60, WATERLINE - 4 + oy, 120, 24);
    // waterline: two wave rows + foam caps
    for (let x = 0; x < VIEW_W; x += 4) {
      const h1 = 1 + Math.round(Math.sin((x + cam) * 0.08 + t * 2.5) + 1);
      ctx.fillStyle = '#bfe3ff';
      ctx.fillRect(x, WATERLINE - h1 + oy, 4, h1);
      const h2 = Math.round(Math.sin((x + cam) * 0.15 - t * 1.8) + 1);
      if (h2 > 1) {
        ctx.fillStyle = '#f0faff';
        ctx.fillRect(x + 1, WATERLINE - h1 - 1 + oy, 2, 1);
      }
      ctx.fillStyle = '#7db8e8';
      ctx.fillRect(x, WATERLINE + oy, 4, 1 + h2);
    }

    // --- entities (world space) ---
    const dr = (frame: string, x: number, y: number, flip = false, rot = 0) => {
      const f = this.sheet.frames[frame];
      ctx.save();
      ctx.translate(Math.round(x - cam), Math.round(y + oy));
      if (flip) ctx.scale(-1, 1);
      if (rot) ctx.rotate(rot);
      ctx.drawImage(this.sheet.canvas, f.x, f.y, f.w, f.h, -f.w / 2, -f.h / 2, f.w, f.h);
      ctx.restore();
    };

    for (const s of world.subs) {
      if (s.kind === 'mine') {
        const bob = Math.sin(t * 2 + s.id) * 1.5;
        dr('mine', s.x, s.y + bob);
        if (Math.floor(t * 3) % 2 === 0) {
          ctx.fillStyle = '#ff8877';
          ctx.fillRect(Math.round(s.x - cam) - 1, Math.round(s.y + bob + oy) - 1, 2, 2);
        }
      } else {
        dr(s.kind, s.x, s.y, s.dir < 0);
        if (s.hitFlash > 0) {
          const f = this.sheet.frames[s.kind];
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(s.x - cam - f.w / 2), Math.round(s.y + oy - f.h / 2), f.w, f.h);
          ctx.globalAlpha = 1;
        }
      }
      if (world.sonarTimer > 0 && s.kind !== 'gunboat') {
        ctx.strokeStyle = 'rgba(120,255,160,0.8)';
        ctx.strokeRect(Math.round(s.x - cam) - 14, Math.round(s.y + oy) - 8, 28, 16);
      }
    }
    for (const c of world.charges) dr('charge', c.x, c.y);
    for (const p of world.shots) {
      if (p.ptype === 'bullet') {
        const nx = p.vx / 300, ny = p.vy / 300;
        ctx.fillStyle = 'rgba(255,236,150,0.35)';
        ctx.fillRect(Math.round(p.x - cam - nx * 6), Math.round(p.y + oy - ny * 6), 2, 2);
        ctx.fillStyle = '#ffe9a0';
        ctx.fillRect(Math.round(p.x - cam - nx * 3), Math.round(p.y + oy - ny * 3), 2, 2);
        ctx.fillStyle = '#fff8d8';
        ctx.fillRect(Math.round(p.x - cam), Math.round(p.y + oy), 2, 2);
      } else {
        const rot = Math.atan2(p.vy, p.vx);
        dr(p.ptype === 'sam' ? 'sam' : 'torpedo', p.x, p.y, false,
          p.ptype === 'sam' ? rot + Math.PI / 2 : rot);
      }
    }
    // blast shockwave rings
    for (const r of world.rings) {
      const a = 1 - r.age / 0.3;
      ctx.strokeStyle = `rgba(255,240,200,${(a * 0.8).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(Math.round(r.x - cam), Math.round(r.y + oy), 6 + r.age * 90, 0, Math.PI * 2);
      ctx.stroke();
    }
    // player with turn motion
    const pl = world.player;
    const target = pl.facing;
    this.turnScale += (target - this.turnScale) * Math.min(1, dt * 16);
    let ts = this.turnScale;
    if (Math.abs(ts) < 0.08) ts = ts < 0 ? -0.08 : 0.08;
    const pitch = Math.max(-0.15, Math.min(0.15, pl.vy * 0.002));
    if (pl.iframes <= 0 || Math.floor(t * 12) % 2 === 0) {
      const frame = `heli${bankFrame(pl.vx)}${Math.floor(t * 20) % 2}`;
      const f = this.sheet.frames[frame];
      ctx.save();
      ctx.translate(Math.round(pl.x - cam), Math.round(pl.y + oy));
      ctx.rotate(pitch * (ts < 0 ? -1 : 1));
      ctx.scale(ts, 1);
      ctx.drawImage(this.sheet.canvas, f.x, f.y, f.w, f.h, -f.w / 2, -f.h / 2, f.w, f.h);
      ctx.restore();
      // chin turret (aims independently of body flip)
      const tf = this.sheet.frames.turret;
      ctx.save();
      ctx.translate(Math.round(pl.x - cam), Math.round(pl.y + oy + 4));
      ctx.rotate(pl.turretAngle);
      ctx.drawImage(this.sheet.canvas, tf.x, tf.y, tf.w, tf.h, -2, -2, tf.w, tf.h);
      if (pl.muzzleT > 0) {
        ctx.fillStyle = '#fff6c0';
        ctx.fillRect(6, -2, 4, 4);
      }
      ctx.restore();
    }
    // particles
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x - cam), Math.round(pt.y + oy), pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    this.hud(world);
    if (touchUI && phase === 'playing') this.touchOverlay();
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

  private touchOverlay(): void {
    const { ctx } = this;
    const b = touchButtons();
    for (const [key, btn] of Object.entries(b) as ['fire' | 'drop', { x: number; y: number; r: number }][]) {
      ctx.strokeStyle = 'rgba(232,242,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      ctx.stroke();
      this.text(key === 'fire' ? 'FIRE' : 'DROP', btn.x, btn.y + 3, 7, 'rgba(232,242,255,0.7)', true);
    }
  }

  private overlay(): void {
    this.ctx.fillStyle = 'rgba(4,10,20,0.75)';
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private menu(): void {
    this.overlay();
    this.text('SEA BOMBER', VIEW_W / 2, 100, 24, '#ffd866', true);
    this.text('depth-charge the subs · dodge everything', VIEW_W / 2, 125, 8, '#9fd8ff', true);
    this.text('WASD/arrows move · SPACE drop · aim with mouse · click/F fire', VIEW_W / 2, 150, 8, '#e8f2ff', true);
    this.text('touch: left stick move · right stick aim · FIRE/DROP buttons', VIEW_W / 2, 162, 8, '#e8f2ff', true);
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

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npx vitest run` — clean. Note: `draw()` now takes a 5th param; main.ts still passes 4 — TS error expected HERE if main not yet updated. If typecheck fails only on main.ts arity, proceed to Task 6 immediately (same branch) and typecheck after; otherwise fix per error. To keep each commit green, you MAY update the `renderer.draw(...)` call in `src/main.ts` to `renderer.draw(world, state.phase, cards, elapsed, input.touchSeen)` within THIS task — do so, it's a one-line consequence of the new signature.

- [ ] **Step 3: Commit**

```bash
git add src/render/renderer.ts src/main.ts
git commit -m "feat: turn motion, chin turret, env layers, shake, rings, tracers, touch UI"
```

---

### Task 6: Main aim wiring

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Implement**

a) Add import:
```ts
import { aimFromStick } from './game/aim';
```

b) In `update(dt)`, playing branch — REPLACE:
```ts
  world.update(dt, input.poll());
```
with:
```ts
  const intent = input.poll();
  const stickDir = input.aimStickDir();
  if (stickDir) {
    intent.aim = aimFromStick(world.player.x, world.player.y, stickDir.dx, stickDir.dy);
  } else {
    const m = input.aimCanvasPoint();
    if (m) intent.aim = { x: m.x + world.camX, y: m.y };
  }
  world.update(dt, intent);
```

c) Confirm the render call passes touch flag (done in Task 5 if not already):
```ts
const loop = new Loop(
  dt => update(dt),
  () => renderer.draw(world, state.phase, cards, elapsed, input.touchSeen),
);
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npx vitest run && npm run build` — all clean/green.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: resolve aim from mouse or touch stick in main"
```

---

### Task 7: Playtest + polish

- [ ] **Step 1: Manual verification (preview tools)**

Start dev server, verify:
1. Menu shows updated control text.
2. Mouse moves → chin turret visibly swings toward cursor (eased, not snapped); click/F fires tracers toward cursor at any angle incl. up/behind.
3. Firing left while flying right flips heli toward aim; releasing fire, moving right flips back — flip animates (squash through zero), not a pop.
4. Speed changes bank frame (level/lean/hard); climbing/diving pitches sprite slightly.
5. Muzzle flash on shots; bullet tracers show streak + fade tail.
6. Explosions: shockwave ring + shake; player hit → bigger shake; shake decays.
7. Gunboat flashes white when hit by bullets.
8. Mines bob and blink; subs emit prop-wash bubbles; SAM has flame trail; player below 40% hp trails smoke.
9. Environment: two cloud layers move at different rates, haze band, sun glare, two-row waves with foam, rays fade by mid-depth.
10. No console errors; steady frame rate.
11. Screenshot before/after comparisons at menu + mid-fight.

Fix issues found with `fix:` commits.

- [ ] **Step 2: Full suite + build**

Run: `npx vitest run && npm run typecheck && npm run build` — green.

- [ ] **Step 3: Merge readiness**

Hand off to superpowers:finishing-a-development-branch.

---

## Self-review

- **Spec coverage:** Intent.aim + mouse/stick resolution (T2/T3/T6), turret ease 10 rad/s + muzzle spawn + facing rule (T2), bullets-die-underwater unchanged (no change made), bank frames + squash flip + pitch (T4/T5), chin turret + muzzle flash (T4/T5), enemy sprite detail (T4), env layers/haze/foam/fog/glare (T5), shockwave rings + shake + smoke + tracers + hit flash + bubbles + SAM flame (T2 state, T5 draw), touch UI buttons + touchSeen (T3/T5), aim helpers tested (T1), world FX tested (T2). ✓
- **Placeholders:** none — full code every step. ✓
- **Type consistency:** `Intent.aim?: {x,y}|null` used identically in input/world/main; `touchButtons()` exported from input, consumed by renderer; frame keys heli00–heli21/turret match renderer template `heli${bank}${rotor}`; `rings`/`shake`/`hitFlash`/`muzzleT`/`turretAngle` declared in T2, read in T5. `aimFromStick` deadzone 8px matches input's raw client px. ✓
- **Existing tests:** Intent.aim optional so v1 test literals compile; world tests appended, none modified. ✓
