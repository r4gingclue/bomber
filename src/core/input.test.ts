import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input, touchButtons } from './input';

let now = 0;

function event(type: string, props: Record<string, unknown> = {}): Event {
  const e = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(e, key, { value });
  }
  return e;
}

function touchEvent(type: 'pointerdown' | 'pointerup', pointerId: number): Event {
  const fire = touchButtons().fire;
  return event(type, { pointerType: 'touch', pointerId, clientX: fire.x, clientY: fire.y });
}

function setupInput(): { input: Input; canvas: EventTarget; keyboard: EventTarget } {
  const keyboard = new EventTarget();
  vi.stubGlobal('window', keyboard);
  const canvas = new EventTarget();
  const input = new Input();
  input.toCanvas = (x, y) => [x, y];
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

describe('missile input', () => {
  it('queues one KeyE missile edge and then clears it', () => {
    const { input, keyboard } = setupInput();

    keyboard.dispatchEvent(event('keydown', { code: 'KeyE', repeat: false }));

    expect(input.poll().missile).toBe(true);
    expect(input.poll().missile).toBe(false);
  });

  it('does not queue a missile before a 350ms fire-button hold', () => {
    const { input, canvas } = setupInput();
    canvas.dispatchEvent(touchEvent('pointerdown', 1));
    now = 349;

    const intent = input.poll();

    expect(intent.fire).toBe(true);
    expect(intent.missile).toBe(false);
  });

  it('queues one missile at 350ms while fire remains held', () => {
    const { input, canvas } = setupInput();
    canvas.dispatchEvent(touchEvent('pointerdown', 1));
    now = 350;

    expect(input.poll()).toMatchObject({ fire: true, missile: true });
    expect(input.poll()).toMatchObject({ fire: true, missile: false });
  });

  it('queues another missile only after release and re-hold', () => {
    const { input, canvas } = setupInput();
    canvas.dispatchEvent(touchEvent('pointerdown', 1));
    now = 350;
    expect(input.poll().missile).toBe(true);
    now = 700;
    expect(input.poll().missile).toBe(false);

    canvas.dispatchEvent(touchEvent('pointerup', 1));
    now = 800;
    canvas.dispatchEvent(touchEvent('pointerdown', 2));
    now = 1150;

    expect(input.poll()).toMatchObject({ fire: true, missile: true });
  });
});
