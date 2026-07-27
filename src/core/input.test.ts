import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input, touchButtons, touchControls } from './input';
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

function touchEvent(type: 'pointerdown' | 'pointerup' | 'pointercancel', pointerId: number): Event {
  const fire = touchControls().fire;
  return event(type, { pointerType: 'touch', pointerId, clientX: fire.x, clientY: fire.y });
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
  const renderFire = uiLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 }, true).fire;

  expect(touchButtons().fire).toEqual({
    x: renderFire.x / 2,
    y: renderFire.y / 2,
    r: renderFire.r / 2,
  });
});

it('uses the visible MOVE circle as the movement hitbox', () => {
  const { input, canvas } = setupInput();
  const move = touchControls().move;

  canvas.dispatchEvent(event('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: move.x, clientY: move.y }));
  canvas.dispatchEvent(event('pointermove', { pointerType: 'touch', pointerId: 7, clientX: move.x + 40, clientY: move.y }));

  expect(input.poll().move).toEqual({ x: 1, y: 0 });
});

it('does not turn a far left-half touch outside MOVE into movement', () => {
  const { input, canvas } = setupInput();

  canvas.dispatchEvent(event('pointerdown', { pointerType: 'touch', pointerId: 8, clientX: 0, clientY: 0 }));
  canvas.dispatchEvent(event('pointermove', { pointerType: 'touch', pointerId: 8, clientX: 40, clientY: 0 }));

  expect(input.poll().move).toEqual({ x: 0, y: 0 });
  expect(input.aimStickDir()).toEqual({ dx: 40, dy: 0 });
});

it('queues DROP from its visible touch target', () => {
  const { input, canvas } = setupInput();
  const drop = touchControls().drop;

  canvas.dispatchEvent(event('pointerdown', { pointerType: 'touch', pointerId: 9, clientX: drop.x, clientY: drop.y }));

  expect(input.poll().drop).toBe(true);
});

describe('missile input', () => {
  it('queues one KeyE missile edge and then clears it', () => {
    const { input, keyboard } = setupInput();

    keyboard.dispatchEvent(event('keydown', { code: 'KeyE', repeat: false }));

    expect(input.poll().missile).toBe(true);
    expect(input.poll().missile).toBe(false);
  });

  it('queues exactly one cannon shot for a short touch tap on release', () => {
    const { input, canvas } = setupInput();
    canvas.dispatchEvent(touchEvent('pointerdown', 1));
    now = 200;
    canvas.dispatchEvent(touchEvent('pointerup', 1));

    expect(input.poll()).toMatchObject({ fire: true, missile: false });
    expect(input.poll()).toMatchObject({ fire: false, missile: false });
  });

  it('does not fire or queue a missile before a 350ms fire-button hold', () => {
    const { input, canvas } = setupInput();
    canvas.dispatchEvent(touchEvent('pointerdown', 1));
    now = 349;

    const intent = input.poll();

    expect(intent.fire).toBe(false);
    expect(intent.missile).toBe(false);
  });

  it('queues one missile at 350ms with no cannon fire, then clears on repeat polls', () => {
    const { input, canvas } = setupInput();
    canvas.dispatchEvent(touchEvent('pointerdown', 1));
    now = 350;

    expect(input.poll()).toMatchObject({ fire: false, missile: true });
    expect(input.poll()).toMatchObject({ fire: false, missile: false });
    now = 700;
    expect(input.poll()).toMatchObject({ fire: false, missile: false });
    canvas.dispatchEvent(touchEvent('pointerup', 1));
    expect(input.poll()).toMatchObject({ fire: false, missile: false });
  });

  it('queues another missile only after release and re-hold', () => {
    const { input, canvas } = setupInput();
    canvas.dispatchEvent(touchEvent('pointerdown', 1));
    now = 350;
    expect(input.poll()).toMatchObject({ fire: false, missile: true });
    now = 700;
    expect(input.poll().missile).toBe(false);

    canvas.dispatchEvent(touchEvent('pointerup', 1));
    now = 800;
    canvas.dispatchEvent(touchEvent('pointerdown', 2));
    now = 1150;

    expect(input.poll()).toMatchObject({ fire: false, missile: true });
  });

  it('keeps simultaneous touch holds independent', () => {
    const { input, canvas } = setupInput();
    canvas.dispatchEvent(touchEvent('pointerdown', 1));
    now = 100;
    canvas.dispatchEvent(touchEvent('pointerdown', 2));
    now = 200;
    canvas.dispatchEvent(touchEvent('pointerup', 2)); // short tap from pointer 2

    expect(input.poll()).toMatchObject({ fire: true, missile: false });
    now = 350; // pointer 1 is still held long enough
    expect(input.poll()).toMatchObject({ fire: false, missile: true });
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
