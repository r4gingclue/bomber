import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input, touchButtons, touchControls, type TouchControls } from './input';
import { GamepadInput, type GamepadLike } from './gamepad';
import { clientToWorld } from '../render/viewport';
import { uiLayout } from '../render/ui-layout';

let now = 0;

function event(type: string, props: Record<string, unknown> = {}): Event {
  const e = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(e, key, { value });
  }
  return e;
}

function setupInput(): { input: Input; canvas: EventTarget; keyboard: EventTarget } {
  const keyboard = new EventTarget();
  vi.stubGlobal('window', keyboard);
  const canvas = new EventTarget();
  const input = new Input();
  input.toCanvas = (x, y) => ({ x, y });
  input.attach(canvas as unknown as HTMLElement);
  return { input, canvas, keyboard };
}

function gamepad(axes: number[], pressed: number[]): GamepadLike {
  return {
    id: 'Standard Controller',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes,
    buttons: Array.from({ length: 18 }, (_, button) => ({
      pressed: pressed.includes(button),
      value: pressed.includes(button) ? 1 : 0,
    })),
  };
}

beforeEach(() => {
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('maps the center of a 960x540 display back to 480x270 simulation space', () => {
  const world = clientToWorld(580, 320, {
    x: 100, y: 50, width: 960, height: 540, scale: 1,
  });

  expect(world).toEqual({ x: 240, y: 135 });
});

it('maps render-space touch controls back to the matching simulation hit region', () => {
  const renderMissile = uiLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 }, true).missile;

  expect(touchButtons().missile).toEqual({
    x: renderMissile.x / 2,
    y: renderMissile.y / 2,
    r: renderMissile.r / 2,
  });
});

it('combines standard gamepad movement, aim, and actions with input intent', () => {
  const controller = new GamepadInput(() => [gamepad([0.7, -0.6, 0.8, -0.9], [0, 1, 2, 3])]);
  const input = new Input(controller);

  expect(input.poll()).toMatchObject({
    move: { x: 0.7, y: -0.6 },
    fire: true,
    drop: true,
    missile: true,
    sfxUp: true,
  });
  expect(input.aimStickDir()).toEqual({ dx: 32, dy: -36 });
  expect(input.gamepadConnected).toBe(true);
});

it('queues gamepad confirm and semantic select edges for phase handling', () => {
  let current = gamepad([0, 0, 0, 0], []);
  const input = new Input(new GamepadInput(() => [current]));
  input.poll();
  current = gamepad([0, 0, 0, 0], [0]);
  input.poll();

  expect(input.consumeConfirm()).toBe(true);
  expect(input.consumeConfirm()).toBe(false);
  expect(input.consumeUpgradeAction()).toBe('select');
  expect(input.consumeUpgradeAction()).toBeNull();
});

it.each([
  ['Enter', 'confirm'],
  ['Space', 'gameplay'],
] as const)('discards stale %s keyboard queues at a phase transition', (code, source) => {
  const { input, keyboard } = setupInput();
  keyboard.dispatchEvent(event('keydown', { code, repeat: false }));

  if (source === 'confirm') expect(input.consumeConfirm()).toBe(true);
  else expect(input.poll().drop).toBe(true);
  input.discardPhaseQueues();

  expect(input.consumeConfirm()).toBe(false);
  expect(input.consumeUpgradeAction()).toBeNull();
  expect(input.poll().drop).toBe(false);
});

it.each([
  ['A', 0, 'select', 'confirm'],
  ['B', 1, 'refund', 'gameplay'],
] as const)('discards stale gamepad %s queues without inventing a held-button edge', (_label, button, action, source) => {
  let current = gamepad([0, 0, 0, 0], []);
  const input = new Input(new GamepadInput(() => [current]));
  input.poll();
  current = gamepad([0, 0, 0, 0], [button]);
  const intent = input.poll();

  if (source === 'confirm') expect(input.consumeConfirm()).toBe(true);
  else expect(intent.drop).toBe(true);
  input.discardPhaseQueues();

  input.poll();
  expect(input.consumeConfirm()).toBe(false);
  expect(input.consumeUpgradeAction()).toBeNull();

  current = gamepad([0, 0, 0, 0], []);
  input.poll();
  current = gamepad([0, 0, 0, 0], [button]);
  input.poll();
  expect(input.consumeUpgradeAction()).toBe(action);
});

it('does not fire in playing while the A button used to start remains held', () => {
  let current = gamepad([0, 0, 0, 0], []);
  const input = new Input(new GamepadInput(() => [current]));
  input.poll();
  current = gamepad([0, 0, 0, 0], [0]);

  expect(input.poll().fire).toBe(true);
  expect(input.consumeConfirm()).toBe(true);
  input.discardPhaseQueues();

  expect(input.poll().fire).toBe(false);
  expect(input.poll().fire).toBe(false);
  current = gamepad([0, 0, 0, 0], []);
  expect(input.poll().fire).toBe(false);
  current = gamepad([0, 0, 0, 0], [0]);
  expect(input.poll().fire).toBe(true);
});

it('queues semantic keyboard upgrade actions on press edges', () => {
  const { input, keyboard } = setupInput();

  const actionFor = (code: string, action: string) => {
    keyboard.dispatchEvent(event('keydown', { code, repeat: false }));
    expect(input.consumeUpgradeAction()).toBe(action);
  };

  actionFor('ArrowLeft', 'left');
  actionFor('ArrowRight', 'right');
  actionFor('ArrowUp', 'up');
  actionFor('ArrowDown', 'down');
  actionFor('Enter', 'select');
  actionFor('Backspace', 'refund');
  actionFor('Space', 'continue');

  keyboard.dispatchEvent(event('keydown', { code: 'Enter', repeat: true }));
  expect(input.consumeUpgradeAction()).toBeNull();
});

it('queues gamepad upgrade actions once per pressed edge', () => {
  let current = gamepad([0, 0, 0, 0], []);
  const input = new Input(new GamepadInput(() => [current]));
  input.poll();
  current = gamepad([0, 0, 0, 0], [0]);

  input.poll();
  expect(input.consumeUpgradeAction()).toBe('select');
  input.poll();
  expect(input.consumeUpgradeAction()).toBeNull();
});

it('uses the visible MOVE circle as the movement hitbox', () => {
  const { input, canvas } = setupInput();
  const move = touchControls().move;

  canvas.dispatchEvent(event('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: move.x, clientY: move.y }));
  canvas.dispatchEvent(event('pointermove', { pointerType: 'touch', pointerId: 7, clientX: move.x + 40, clientY: move.y }));

  expect(input.poll().move).toEqual({ x: 1, y: 0 });
});

it('queues DROP from its visible touch target', () => {
  const { input, canvas } = setupInput();
  const drop = touchControls().drop;

  canvas.dispatchEvent(event('pointerdown', { pointerType: 'touch', pointerId: 9, clientX: drop.x, clientY: drop.y }));

  expect(input.poll().drop).toBe(true);
});

it('does not reinterpret a consumed Start Next Wave mouse pointer as fire or aim', () => {
  const { input, canvas } = setupInput();
  let taps = 0;
  input.isGamePoint = () => false;
  input.onTap = () => {
    taps++;
    return true;
  };

  canvas.dispatchEvent(event('pointerdown', {
    pointerType: 'mouse',
    pointerId: 10,
    clientX: 480,
    clientY: 500,
  }));

  expect(taps).toBe(1);
  expect(input.poll().fire).toBe(false);
  expect(input.aimCanvasPoint()).toBeNull();
});

it('does not reinterpret consumed results Continue touches as drop or aim', () => {
  const { input, canvas } = setupInput();
  input.onTap = () => true;
  const drop = touchControls().drop;

  canvas.dispatchEvent(event('pointerdown', {
    pointerType: 'touch',
    pointerId: 11,
    clientX: drop.x,
    clientY: drop.y,
  }));
  canvas.dispatchEvent(event('pointerdown', {
    pointerType: 'touch',
    pointerId: 12,
    clientX: 0,
    clientY: 0,
  }));

  expect(input.poll().drop).toBe(false);
  expect(input.aimStickDir()).toBeNull();
});

describe('missile input', () => {
  it('queues one KeyE missile edge and then clears it', () => {
    const { input, keyboard } = setupInput();

    keyboard.dispatchEvent(event('keydown', { code: 'KeyE', repeat: false }));

    expect(input.poll().missile).toBe(true);
    expect(input.poll().missile).toBe(false);
  });

  it('keeps keyboard and mouse fire continuous', () => {
    const { input, canvas, keyboard } = setupInput();
    keyboard.dispatchEvent(event('keydown', { code: 'KeyF', repeat: false }));
    expect(input.poll().fire).toBe(true);
    expect(input.poll().fire).toBe(true);
    keyboard.dispatchEvent(event('keyup', { code: 'KeyF' }));

    canvas.dispatchEvent(event('pointerdown', { pointerType: 'mouse', pointerId: 9, clientX: 10, clientY: 10 }));
    expect(input.poll().fire).toBe(true);
    expect(input.poll().fire).toBe(true);
    canvas.dispatchEvent(event('pointerup', { pointerType: 'mouse', pointerId: 9, clientX: 10, clientY: 10 }));
    expect(input.poll().fire).toBe(false);
  });

  it('stops mouse fire when its pointer is cancelled', () => {
    const { input, canvas } = setupInput();
    canvas.dispatchEvent(event('pointerdown', { pointerType: 'mouse', pointerId: 10, clientX: 10, clientY: 10 }));
    expect(input.poll().fire).toBe(true);

    canvas.dispatchEvent(event('pointercancel', { pointerType: 'mouse', pointerId: 10, clientX: 10, clientY: 10 }));

    expect(input.poll().fire).toBe(false);
  });
});

it('clears every held and queued input state on blur', () => {
  const { input, canvas, keyboard } = setupInput();
  const move = touchControls().move;
  const missile = touchControls().missile;

  keyboard.dispatchEvent(event('keydown', { code: 'KeyF', repeat: false }));
  keyboard.dispatchEvent(event('keydown', { code: 'KeyE', repeat: false }));
  keyboard.dispatchEvent(event('keydown', { code: 'Space', repeat: false }));
  keyboard.dispatchEvent(event('keydown', { code: 'Enter', repeat: false }));
  canvas.dispatchEvent(event('pointerdown', {
    pointerType: 'mouse',
    pointerId: 1,
    clientX: 10,
    clientY: 10,
  }));
  canvas.dispatchEvent(event('pointermove', {
    pointerType: 'mouse',
    pointerId: 1,
    clientX: 20,
    clientY: 20,
  }));
  canvas.dispatchEvent(event('pointerdown', {
    pointerType: 'touch',
    pointerId: 2,
    clientX: move.x,
    clientY: move.y,
  }));
  canvas.dispatchEvent(event('pointermove', {
    pointerType: 'touch',
    pointerId: 2,
    clientX: move.x + 40,
    clientY: move.y,
  }));
  canvas.dispatchEvent(event('pointerdown', {
    pointerType: 'touch',
    pointerId: 3,
    clientX: missile.x,
    clientY: missile.y,
  }));

  keyboard.dispatchEvent(event('blur'));
  now = 1000;

  expect(input.poll()).toEqual({
    move: { x: 0, y: 0 },
    drop: false,
    fire: false,
    missile: false,
    sfxUp: false,
    aim: null,
  });
  expect(input.aimCanvasPoint()).toBeNull();
  expect(input.aimStickDir()).toBeNull();
  expect(input.consumeConfirm()).toBe(false);
  expect(input.consumeUpgradeAction()).toBeNull();
});

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
  vi.stubGlobal('window', new EventTarget());
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
