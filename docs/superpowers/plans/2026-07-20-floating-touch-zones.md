# Floating Two-Zone Touch Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed touch circles with two floating zones — left half steers from wherever the thumb lands, right half aims the turret directly at the finger and fires continuously while held — plus a DROP button bottom-right and a MISSILE button directly above it.

**Architecture:** Each pointer is assigned exactly one role at touch-down (`steer` | `aim` | `missile` | `drop`) and keeps it for the pointer's lifetime, so sliding across zones never re-roles a gesture. Steering stays a relative floating stick (origin under the thumb); aiming becomes absolute — the finger's own position converts to a world point exactly like the mouse already does, which removes the need for any change to `main.ts`'s aim resolution. Buttons queue one action per tap, deleting the old tap-vs-hold ambiguity on the fire button.

**Tech Stack:** TypeScript, Vite, Vitest, Canvas 2D. No new dependencies.

## Global Constraints

- Pointer roles are assigned once at `pointerdown` and never change mid-gesture, even if the finger slides into another zone or over a button.
- Steering and aiming use independent pointer IDs; steering, aiming/firing, and button taps must all work simultaneously.
- Right-zone aim is **absolute** (turret points at the finger's actual world position), not a relative joystick.
- Gunfire is active for the entire lifetime of the right-zone pointer and stops on release.
- MISSILE and DROP each queue exactly one launch per tap. No long-press behaviour anywhere.
- A touch that begins on MISSILE or DROP never activates aiming or steering.
- `pointercancel`, window blur, death, and phase changes clear every held touch.
- Mouse, keyboard, and gamepad behaviour is unchanged.
- Existing minimum touch-target sizes must hold: every control's `r * 2 >= 44` CSS px.

**Baseline:** `main` @ 9897e68, 1254 tests green across 158 files. Branch: `touch-zones`.

## File map

```
src/render/ui-layout.ts      — fire → missile; missile stacked above drop; zoneSplitX   [tested]
src/render/ui-layout.test.ts — updated expectations for the renamed/stacked controls
src/core/input.ts            — pointer-role table, floating steer, absolute touch aim,
                               continuous fire, tap-only buttons, touchVisuals()        [tested]
src/core/input.test.ts       — rewritten touch sections
src/render/renderer.ts       — draw MISSILE/DROP buttons + floating steer ring
src/main.ts                  — pass missile circle + zoneSplitX into setTouchControls
```

---

### Task 0: Branch

- [ ] **Step 1:**
```bash
cd /Users/paulcooke/Documents/Projects/Bomber
git checkout -b touch-zones
npx vitest run   # 1254 passing baseline
```

---

### Task 1: Layout — MISSILE button above DROP, zone split

**Files:**
- Modify: `src/render/ui-layout.ts`
- Test: `src/render/ui-layout.test.ts`

**Interfaces:**
- Produces: `UiLayout.missile: UiCircle` (replaces `UiLayout.fire`), `UiLayout.zoneSplitX: number`. `UiLayout.move` is retained as the **resting hint position** for the floating steer stick (drawn when no steer touch is active). `drop` remains the bottom-right anchor; `missile` sits directly above it.

- [ ] **Step 1: Write the failing test**

Read `src/render/ui-layout.test.ts` first — every existing reference to `l.fire` must become `l.missile`, and the stacking assertions below are added. Replace the whole-file references to `fire` and append these cases:

```ts
it('stacks the missile button directly above the drop button', () => {
  const l = uiLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 }, true);
  expect(l.missile.x).toBeCloseTo(l.drop.x, 5);
  expect(l.missile.y).toBeLessThan(l.drop.y);
  // no overlap between the two stacked buttons
  expect(l.drop.y - l.missile.y).toBeGreaterThanOrEqual(l.missile.r + l.drop.r);
});

it('anchors the button stack to the bottom-right of the safe area', () => {
  const insets = { top: 0, right: 20, bottom: 30, left: 0 };
  const l = uiLayout(960, 540, insets, true);
  expect(l.drop.x + l.drop.r).toBeLessThanOrEqual(960 - insets.right);
  expect(l.drop.y + l.drop.r).toBeLessThanOrEqual(540 - insets.bottom);
});

it('splits the steering and aiming zones at the horizontal midpoint', () => {
  const l = uiLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 }, true);
  expect(l.zoneSplitX).toBeCloseTo(480, 5);
  const inset = uiLayout(960, 540, { top: 0, right: 40, bottom: 0, left: 60 }, true);
  expect(inset.zoneSplitX).toBeCloseTo(60 + (960 - 60 - 40) / 2, 5);
});

it('keeps both stacked buttons at the 44px minimum touch target', () => {
  const l = uiLayout(720, 360, { top: 0, right: 0, bottom: 0, left: 0 }, true);
  expect(l.missile.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.drop.r * 2).toBeGreaterThanOrEqual(44);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/ui-layout.test.ts`
Expected: FAIL — `l.missile` is undefined and `zoneSplitX` does not exist.

- [ ] **Step 3: Implement**

In `src/render/ui-layout.ts`:

a) Change the interface — replace the `fire: UiCircle;` line with `missile: UiCircle;` and add `zoneSplitX: number;`:
```ts
export interface UiLayout {
  viewport: { w: number; h: number };
  battlefield: UiRect;
  hud: { x: number; y: number; w: number; h: number; fontSize: number };
  objective: { x: number; y: number };
  move: UiCircle;
  missile: UiCircle;
  drop: UiCircle;
  /** client-x boundary: touches left of this steer, right of this aim */
  zoneSplitX: number;
  controlsInLetterbox: boolean;
  controlOpacity: number;
  gameplaySafe: UiRect;
  audio: AudioSettingsLayout;
}
```

b) Replace the local declarations `let fire: UiCircle;` / `let drop: UiCircle;` with:
```ts
  let move: UiCircle;
  let missile: UiCircle;
  let drop: UiCircle;
```

c) Replace each layout branch's control placement so DROP anchors bottom-right and MISSILE stacks above it. The five branches become:

```ts
  const stackGap = 12;
  if (touch && bottomBar >= r * 2 + 8) {
    const y = battlefield.y + battlefield.h + bottomBar / 2;
    move = { x: i.left + r + 16, y, r };
    drop = { x: safeRight - r - 16, y, r };
    missile = { x: drop.x, y: drop.y - r * 2 - stackGap, r };
    controlsInLetterbox = true;
    controlOpacity = 0.66;
  } else if (touch && topBar >= r * 2 + 8) {
    const y = i.top + topBar / 2;
    move = { x: i.left + r + 16, y, r };
    drop = { x: safeRight - r - 16, y, r };
    missile = { x: drop.x, y: drop.y - r * 2 - stackGap, r };
    controlsInLetterbox = true;
    controlOpacity = 0.66;
  } else if (touch && leftBar >= r * 2 + 8 && rightBar >= r * 2 + 8) {
    move = {
      x: i.left + leftBar / 2,
      y: Math.min(safeBottom - r - 8, battlefield.y + battlefield.h * 0.72),
      r,
    };
    drop = {
      x: battlefield.x + battlefield.w + rightBar / 2,
      y: Math.min(safeBottom - r - 8, battlefield.y + battlefield.h * 0.72),
      r,
    };
    missile = { x: drop.x, y: drop.y - r * 2 - stackGap, r };
    controlsInLetterbox = true;
    controlOpacity = 0.66;
  } else if (touch) {
    r = 22;
    const edge = 8;
    move = {
      x: battlefield.x + r + edge,
      y: battlefield.y + battlefield.h - r - edge,
      r,
    };
    drop = {
      x: Math.min(battlefield.x + battlefield.w, safeRight) - r - edge,
      y: Math.min(battlefield.y + battlefield.h, safeBottom) - r - edge,
      r,
    };
    missile = { x: drop.x, y: drop.y - r * 2 - stackGap, r };
    controlOpacity = 0.36;
  } else {
    move = { x: i.left + r + 28, y: safeBottom - r - 24, r };
    drop = { x: safeRight - r - 28, y: safeBottom - r - 24, r };
    missile = { x: drop.x, y: drop.y - r * 2 - stackGap, r };
  }
```

d) The `safeRightX` clamp references `fire` — update it to use the stacked pair:
```ts
  const safeRightX = controlsInLetterbox
    ? battlefield.x + battlefield.w - 8
    : Math.min(
      battlefield.x + battlefield.w - 8,
      missile.x - missile.r - 8,
      drop.x - drop.r - 8,
    );
```

e) Return the new fields — replace `fire,` with `missile,` and add the split:
```ts
    move,
    missile,
    drop,
    zoneSplitX: i.left + availableW / 2,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/render/ui-layout.test.ts`
Expected: PASS. Then `npx tsc --noEmit` will still FAIL in `input.ts`, `renderer.ts`, and `main.ts` because they reference `layout.fire` — that is expected and fixed in Tasks 2–4. Do not fix them here.

- [ ] **Step 5: Commit**

```bash
git add src/render/ui-layout.ts src/render/ui-layout.test.ts
git commit -m "feat: stack missile button above drop and expose touch zone split"
```

---

### Task 2: Input — pointer roles, floating steer, absolute aim, continuous fire

**Files:**
- Modify: `src/core/input.ts`
- Test: `src/core/input.test.ts`

**Interfaces:**
- Consumes: `UiLayout.missile`, `UiLayout.drop`, `UiLayout.move`, `UiLayout.zoneSplitX` from Task 1.
- Produces:
  - `TouchControls = { move: UiCircle; missile: UiCircle; drop: UiCircle; zoneSplitX: number }`
  - `touchControls(): TouchControls` and `touchButtons(): Pick<TouchControls, 'missile' | 'drop'>` (simulation-space, unchanged conversion)
  - `Input.setTouchControls(controls: TouchControls): void`
  - `Input.touchVisuals(): { steer: { ox: number; oy: number; dx: number; dy: number } | null; aiming: boolean }` — consumed by the renderer in Task 3
  - `Input.aimCanvasPoint()` now returns the **touch** aim point (simulation coords) when a right-zone pointer is held, else the mouse point
  - `Input.aimStickDir()` now returns gamepad aim only

- [ ] **Step 1: Write the failing test**

Read `src/core/input.test.ts` first. Every existing touch case that exercises the old fire-button tap/hold behaviour (`touchButtons().fire`, 350 ms hold → missile, tap → single shot) is obsolete: delete those cases. Add this suite:

```ts
import { describe, it, expect } from 'vitest';
import { Input, type TouchControls } from './input';

const CONTROLS: TouchControls = {
  move: { x: 80, y: 400, r: 40 },
  missile: { x: 880, y: 300, r: 40 },
  drop: { x: 880, y: 400, r: 40 },
  zoneSplitX: 480,
};

class FakeEl {
  private handlers = new Map<string, ((e: PointerEvent) => void)[]>();
  addEventListener(type: string, fn: (e: PointerEvent) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn);
    this.handlers.set(type, list);
  }
  emit(type: string, e: Partial<PointerEvent>): void {
    for (const fn of this.handlers.get(type) ?? []) {
      fn({ pointerType: 'touch', ...e } as PointerEvent);
    }
  }
}

function harness() {
  const el = new FakeEl();
  const input = new Input();
  input.attach(el as unknown as HTMLElement);
  input.setTouchControls(CONTROLS);
  input.toCanvas = (x, y) => ({ x, y });
  return { el, input };
}

describe('floating steering zone', () => {
  it('starts the stick wherever the left-side thumb lands', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 });
    el.emit('pointermove', { pointerId: 1, clientX: 240, clientY: 500 });
    expect(input.poll().move.x).toBeCloseTo(1, 5); // +40px = full deflection
  });

  it('ignores movement below the dead zone', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 });
    el.emit('pointermove', { pointerId: 1, clientX: 204, clientY: 500 });
    expect(input.poll().move.x).toBe(0);
  });

  it('stops steering on release', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 });
    el.emit('pointermove', { pointerId: 1, clientX: 260, clientY: 500 });
    el.emit('pointerup', { pointerId: 1, clientX: 260, clientY: 500 });
    expect(input.poll().move.x).toBe(0);
  });
});

describe('floating aim/fire zone', () => {
  it('fires continuously while a right-side pointer is held', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 2, clientX: 700, clientY: 200 });
    expect(input.poll().fire).toBe(true);
    expect(input.poll().fire).toBe(true); // still held on the next frame
    el.emit('pointerup', { pointerId: 2, clientX: 700, clientY: 200 });
    expect(input.poll().fire).toBe(false);
  });

  it('aims at the finger position and follows it', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 2, clientX: 700, clientY: 200 });
    expect(input.aimCanvasPoint()).toEqual({ x: 700, y: 200 });
    el.emit('pointermove', { pointerId: 2, clientX: 640, clientY: 260 });
    expect(input.aimCanvasPoint()).toEqual({ x: 640, y: 260 });
  });

  it('does not report a relative stick direction for touch aim', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 2, clientX: 700, clientY: 200 });
    expect(input.aimStickDir()).toBeNull();
  });
});

describe('action buttons', () => {
  it('queues exactly one drop per tap and never aims', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 3, clientX: 880, clientY: 400 });
    const first = input.poll();
    expect(first.drop).toBe(true);
    expect(first.fire).toBe(false);
    expect(input.poll().drop).toBe(false);
  });

  it('queues exactly one missile per tap', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 4, clientX: 880, clientY: 300 });
    expect(input.poll().missile).toBe(true);
    expect(input.poll().missile).toBe(false);
  });

  it('does not launch a second missile when the button is held', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 4, clientX: 880, clientY: 300 });
    expect(input.poll().missile).toBe(true);
    for (let i = 0; i < 5; i++) expect(input.poll().missile).toBe(false);
    el.emit('pointerup', { pointerId: 4, clientX: 880, clientY: 300 });
    expect(input.poll().missile).toBe(false);
  });
});

describe('pointer role locking', () => {
  it('keeps steering when the thumb slides into the aim half', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 });
    el.emit('pointermove', { pointerId: 1, clientX: 700, clientY: 500 });
    expect(input.poll().fire).toBe(false);       // never becomes an aim pointer
    expect(input.aimCanvasPoint()).toBeNull();
    expect(input.poll().move.x).toBeCloseTo(1, 5); // clamped full deflection
  });

  it('keeps aiming when the finger slides into the steering half', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 2, clientX: 700, clientY: 200 });
    el.emit('pointermove', { pointerId: 2, clientX: 100, clientY: 200 });
    expect(input.poll().fire).toBe(true);
    expect(input.aimCanvasPoint()).toEqual({ x: 100, y: 200 });
    expect(input.poll().move.x).toBe(0); // did not become a steer pointer
  });

  it('supports steering and firing at the same time', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 });
    el.emit('pointerdown', { pointerId: 2, clientX: 700, clientY: 200 });
    el.emit('pointermove', { pointerId: 1, clientX: 240, clientY: 500 });
    const intent = input.poll();
    expect(intent.move.x).toBeCloseTo(1, 5);
    expect(intent.fire).toBe(true);
  });

  it('allows button taps while both zones are held', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 });
    el.emit('pointerdown', { pointerId: 2, clientX: 700, clientY: 200 });
    el.emit('pointerdown', { pointerId: 3, clientX: 880, clientY: 400 });
    el.emit('pointerdown', { pointerId: 4, clientX: 880, clientY: 300 });
    const intent = input.poll();
    expect(intent.drop).toBe(true);
    expect(intent.missile).toBe(true);
    expect(intent.fire).toBe(true);
  });

  it('releasing one zone leaves the other active', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 });
    el.emit('pointerdown', { pointerId: 2, clientX: 700, clientY: 200 });
    el.emit('pointermove', { pointerId: 1, clientX: 240, clientY: 500 });
    el.emit('pointerup', { pointerId: 2, clientX: 700, clientY: 200 });
    const intent = input.poll();
    expect(intent.fire).toBe(false);
    expect(intent.move.x).toBeCloseTo(1, 5);
  });
});

describe('touch teardown', () => {
  it('clears held touches on pointercancel', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 });
    el.emit('pointerdown', { pointerId: 2, clientX: 700, clientY: 200 });
    el.emit('pointermove', { pointerId: 1, clientX: 240, clientY: 500 });
    el.emit('pointercancel', { pointerId: 1, clientX: 240, clientY: 500 });
    el.emit('pointercancel', { pointerId: 2, clientX: 700, clientY: 200 });
    const intent = input.poll();
    expect(intent.move.x).toBe(0);
    expect(intent.fire).toBe(false);
    expect(input.aimCanvasPoint()).toBeNull();
  });

  it('resetTransient drops every held touch', () => {
    const { el, input } = harness();
    el.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 });
    el.emit('pointerdown', { pointerId: 2, clientX: 700, clientY: 200 });
    input.resetTransient();
    const intent = input.poll();
    expect(intent.move.x).toBe(0);
    expect(intent.fire).toBe(false);
  });
});

describe('touchVisuals', () => {
  it('reports the live steer origin and aim state', () => {
    const { el, input } = harness();
    expect(input.touchVisuals()).toEqual({ steer: null, aiming: false });
    el.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 });
    el.emit('pointermove', { pointerId: 1, clientX: 220, clientY: 480 });
    el.emit('pointerdown', { pointerId: 2, clientX: 700, clientY: 200 });
    expect(input.touchVisuals()).toEqual({
      steer: { ox: 200, oy: 500, dx: 20, dy: -20 },
      aiming: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/input.test.ts`
Expected: FAIL — `TouchControls` has no `missile`/`zoneSplitX`, `touchVisuals` is not a function.

- [ ] **Step 3: Implement**

In `src/core/input.ts`:

a) Replace the `TouchControls` interface and the two helper functions:
```ts
export interface TouchControls {
  move: UiCircle;
  missile: UiCircle;
  drop: UiCircle;
  /** client-x boundary: touches left of this steer, right of this aim */
  zoneSplitX: number;
}

/** CSS-pixel touch controls shared with the screen-space renderer. */
export function touchControls(): TouchControls {
  const layout = uiLayout(RENDER_W, RENDER_H, { top: 0, right: 0, bottom: 0, left: 0 }, true);
  return {
    move: layout.move,
    missile: layout.missile,
    drop: layout.drop,
    zoneSplitX: layout.zoneSplitX,
  };
}

/** Simulation-space button geometry retained for callers that use canvas coordinates. */
export function touchButtons(): Pick<TouchControls, 'missile' | 'drop'> {
  const controls = touchControls();
  const toSimulation = ({ x, y, r }: UiCircle): UiCircle =>
    ({ x: x / RENDER_SCALE, y: y / RENDER_SCALE, r: r / RENDER_SCALE });
  return {
    missile: toSimulation(controls.missile),
    drop: toSimulation(controls.drop),
  };
}
```

b) Add the role type above the class:
```ts
type PointerRole = 'steer' | 'aim' | 'missile' | 'drop';
```

c) Replace the touch state fields. Delete `touchFireQueued`, `firePointers`, `stick`, and `aimStick`; add:
```ts
  private pointerRoles = new Map<number, PointerRole>();
  private steerPointer: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null;
  private aimPointer: { id: number; x: number; y: number } | null = null;
```

d) Replace the non-mouse half of the `pointerdown` handler (everything after the mouse `return`) with role assignment:
```ts
      const controls = this.controls;
      if (inCircle(e.clientX, e.clientY, controls.missile)) {
        this.pointerRoles.set(e.pointerId, 'missile');
        this.missileQueued = true;
        return;
      }
      if (inCircle(e.clientX, e.clientY, controls.drop)) {
        this.pointerRoles.set(e.pointerId, 'drop');
        this.dropQueued = true;
        return;
      }
      if (e.clientX < controls.zoneSplitX) {
        this.pointerRoles.set(e.pointerId, 'steer');
        this.steerPointer = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
      } else {
        this.pointerRoles.set(e.pointerId, 'aim');
        this.aimPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
```

e) Replace the non-mouse half of `pointermove` — role comes from the stored pointer id, so a slide never re-roles:
```ts
      if (this.steerPointer && e.pointerId === this.steerPointer.id) {
        this.steerPointer.dx = e.clientX - this.steerPointer.ox;
        this.steerPointer.dy = e.clientY - this.steerPointer.oy;
      }
      if (this.aimPointer && e.pointerId === this.aimPointer.id) {
        this.aimPointer.x = e.clientX;
        this.aimPointer.y = e.clientY;
      }
```

f) Replace `release` and `cancel` with one shared teardown (buttons already fired on down, so up and cancel behave identically now):
```ts
    const endPointer = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.mouseFire = false;
      if (this.steerPointer?.id === e.pointerId) this.steerPointer = null;
      if (this.aimPointer?.id === e.pointerId) this.aimPointer = null;
      this.pointerRoles.delete(e.pointerId);
    };
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
```

g) In `resetTransient()`, replace the three stale lines (`this.firePointers.clear();` and both stick resets) with:
```ts
    this.pointerRoles.clear();
    this.steerPointer = null;
    this.aimPointer = null;
```

h) In `discardPhaseQueues()`, delete the `this.touchFireQueued = false;` line.

i) In `poll()`, replace the steer block and the fire/missile wiring. The stick section becomes:
```ts
    if (this.steerPointer) {
      const nx = Math.max(-1, Math.min(1, this.steerPointer.dx / 40));
      const ny = Math.max(-1, Math.min(1, this.steerPointer.dy / 40));
      if (Math.abs(nx) > 0.15) x = nx;
      if (Math.abs(ny) > 0.15) y = ny;
    }
```
Delete the `this.queueHeldTouchMissiles();` call and the two `touchFire` lines, and return:
```ts
    return {
      move: { x, y },
      drop,
      fire: this.keys.has('KeyF') || this.mouseFire || this.aimPointer !== null || gamepad.fire,
      missile,
      sfxUp: gamepad.sfxPressed,
      aim: null,
    };
```

j) Delete the `queueHeldTouchMissiles` and `releaseFirePointer` methods entirely.

k) Replace the two aim accessors and add the visual getter:
```ts
  /** Latest aim point in simulation coords: held touch first, else the mouse. */
  aimCanvasPoint(): { x: number; y: number } | null {
    if (this.aimPointer && this.toCanvas) {
      return this.toCanvas(this.aimPointer.x, this.aimPointer.y);
    }
    return this.mouseAim;
  }

  /** Relative aim displacement — gamepad only; touch aim is absolute. */
  aimStickDir(): { dx: number; dy: number } | null {
    return this.gamepadAim;
  }

  /** Live floating-control state for the screen-space renderer. */
  touchVisuals(): {
    steer: { ox: number; oy: number; dx: number; dy: number } | null;
    aiming: boolean;
  } {
    return {
      steer: this.steerPointer
        ? {
          ox: this.steerPointer.ox,
          oy: this.steerPointer.oy,
          dx: this.steerPointer.dx,
          dy: this.steerPointer.dy,
        }
        : null,
      aiming: this.aimPointer !== null,
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/input.test.ts`
Expected: PASS, including all role-locking and multi-touch cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/input.ts src/core/input.test.ts
git commit -m "feat: floating touch zones with locked pointer roles and absolute aim"
```

---

### Task 3: Renderer — floating stick ring and stacked buttons

**Files:**
- Modify: `src/render/renderer.ts`

**Interfaces:**
- Consumes: `UiLayout.missile`, `UiLayout.move`, `UiLayout.drop` (Task 1) and `Input.touchVisuals()` (Task 2).
- Produces: `Renderer.setTouchVisuals(visuals: { steer: { ox: number; oy: number; dx: number; dy: number } | null; aiming: boolean }): void` — called by `main.ts` in Task 4.

- [ ] **Step 1: Implement**

Browser-visual code; verified by playtest in Task 4 rather than unit tests.

a) Add a field to the `Renderer` class next to its other mutable UI state:
```ts
  private touchVisualState: {
    steer: { ox: number; oy: number; dx: number; dy: number } | null;
    aiming: boolean;
  } = { steer: null, aiming: false };
```

b) Add the setter as a public method:
```ts
  setTouchVisuals(visuals: {
    steer: { ox: number; oy: number; dx: number; dy: number } | null;
    aiming: boolean;
  }): void {
    this.touchVisualState = visuals;
  }
```

c) Replace the whole `touchOverlay` method. The button loop now draws MISSILE and DROP; the steering control is drawn as a floating ring at the live thumb origin, falling back to the resting hint circle at `layout.move` when no steer touch is held:
```ts
  private touchOverlay(layout: UiLayout): void {
    const ctx = this.uiCtx;
    const fill = `rgba(4, 13, 24, ${(layout.controlOpacity * 0.62).toFixed(2)})`;
    const stroke = `rgba(232,242,255,${layout.controlOpacity.toFixed(2)})`;
    const label = `rgba(232,242,255,${Math.min(0.82, layout.controlOpacity + 0.22).toFixed(2)})`;

    const buttons: [string, UiCircle][] = [
      ['MISSILE', layout.missile],
      ['DROP', layout.drop],
    ];
    for (const [key, btn] of buttons) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      ctx.stroke();
      this.text(key, btn.x, btn.y + 5, key.length > 4 ? 11 : 14, label, true, ctx);
    }

    const steer = this.touchVisualState.steer;
    const base = steer
      ? { x: steer.ox, y: steer.oy, r: layout.move.r }
      : layout.move;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(base.x, base.y, base.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(base.x, base.y, base.r, 0, Math.PI * 2);
    ctx.stroke();
    if (steer) {
      // knob follows the thumb, clamped to the ring
      const len = Math.hypot(steer.dx, steer.dy);
      const cap = len > base.r ? base.r / len : 1;
      ctx.fillStyle = `rgba(232,242,255,${Math.min(0.9, layout.controlOpacity + 0.3).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(base.x + steer.dx * cap, base.y + steer.dy * cap, base.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else {
      this.text('MOVE', base.x, base.y + 5, 14, label, true, ctx);
    }
  }
```

d) If `UiCircle` is not already imported in `renderer.ts`, add it to the existing `ui-layout` import:
```ts
import { uiLayout, type UiCircle, type UiLayout } from './ui-layout';
```
(Match the file's existing import shape — only add the `UiCircle` type if it is missing.)

- [ ] **Step 2: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tests pass; typecheck still reports the two `layout.fire` references in `src/main.ts`, fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/render/renderer.ts
git commit -m "feat: draw floating steer ring and stacked missile/drop buttons"
```

---

### Task 4: Wire-up and playtest

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `TouchControls` (Task 2), `Renderer.setTouchVisuals` (Task 3).

- [ ] **Step 1: Implement**

In `src/main.ts`, both `setTouchControls` call sites (near lines 102 and 245) currently read:
```ts
input?.setTouchControls({ move: screenLayout.move, fire: screenLayout.fire, drop: screenLayout.drop });
```
Replace each with the new shape (keep the `input?.` / `activeInput.` receiver each site already uses):
```ts
input?.setTouchControls({
  move: screenLayout.move,
  missile: screenLayout.missile,
  drop: screenLayout.drop,
  zoneSplitX: screenLayout.zoneSplitX,
});
```
```ts
activeInput.setTouchControls({
  move: screenLayout.move,
  missile: screenLayout.missile,
  drop: screenLayout.drop,
  zoneSplitX: screenLayout.zoneSplitX,
});
```

Then feed the renderer the live control state. In the gameplay update, directly after the existing aim-resolution block (the `const stickDir = activeInput.aimStickDir();` … `if (m) intent.aim = …` lines), add:
```ts
    renderer.setTouchVisuals(activeInput.touchVisuals());
```
(If the renderer instance in scope uses a different identifier at that point, use that identifier.)

No other change is needed for aiming: touch aim now arrives through `aimCanvasPoint()` in simulation coords, and the existing `intent.aim = { x: m.x + world.camX, y: m.y }` line converts it to world space exactly as it already does for the mouse.

- [ ] **Step 2: Verify the build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all green — 1254+ tests, clean typecheck, successful build.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire floating touch zones into layout and renderer"
```

- [ ] **Step 4: Playtest (preview tools, touch emulation)**

Start the dev server and verify with synthetic pointer events (`pointerType: 'touch'`):
1. Touch anywhere on the left half → steer ring appears under the finger; dragging moves the helicopter in the drag direction; releasing stops movement.
2. Touch anywhere on the right half → the turret snaps toward the finger and fires continuously; dragging sweeps the aim; releasing stops firing.
3. Both at once: steer left-thumb while right-thumb aims and fires — both respond independently.
4. Tap DROP (bottom-right) → exactly one depth charge; holding it does not repeat.
5. Tap MISSILE (directly above DROP) → exactly one missile; holding does not repeat.
6. Tap DROP and MISSILE while both zones are held → all four actions register.
7. Slide a steering finger across the midpoint → it keeps steering and never starts firing.
8. Slide an aiming finger across the midpoint → it keeps aiming/firing and never steers.
9. Rotate to portrait and repeat 1–5 → buttons stay inside the safe area, stack unchanged.
10. No console errors.

Fix any findings with `fix:` commits, then hand off to superpowers:finishing-a-development-branch.

---

## Self-review

- **Spec coverage:** left floating steer zone (T1 zoneSplitX, T2 d/e/i, T3 ring), right absolute aim + continuous fire (T2 d/e/i/k), DROP bottom-right + MISSILE above (T1 c, T3 c), roles locked at down (T2 d/e + role-locking tests), independent pointer IDs / simultaneous multi-touch (T2 tests), dead zone + capped radius (T2 i, T3 c knob clamp), one launch per tap with no long-press (T2 d, missile-hold test, `queueHeldTouchMissiles` deleted), cancel/blur/phase teardown (T2 f/g/h + teardown tests), mouse/keyboard/gamepad untouched (T2 k keeps `gamepadAim`; mouse branch unedited), 44px targets (T1 test). ✓
- **Placeholders:** none — every step carries its code. ✓
- **Type consistency:** `TouchControls` gains `missile`/`zoneSplitX` in T2 and is constructed with exactly those keys in T4; `UiLayout.missile`/`zoneSplitX` defined T1, consumed T2/T3/T4; `touchVisuals()` return shape identical in T2 (definition), T2 (test), T3 (field + setter), T4 (call). `touchButtons()` now returns `missile`/`drop` — the plan's grep showed no non-test consumer of its `fire` key, but the T4 typecheck gate will catch any stragglers. ✓
