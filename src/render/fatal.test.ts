import { expect, it, vi } from 'vitest';
import { renderFatalBootError } from './fatal';

it('renders a critical asset failure visibly on the canvas', () => {
  const fillText = vi.fn();
  const ctx = {
    fillRect: vi.fn(),
    fillText,
    restore: vi.fn(),
    save: vi.fn(),
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 960,
    height: 540,
    getContext: vi.fn(() => ctx),
    setAttribute: vi.fn(),
  } as unknown as HTMLCanvasElement;

  const message = renderFatalBootError(
    canvas,
    new Error('Critical asset failed: player.heli'),
  );

  expect(message).toContain('Critical asset failed: player.heli');
  expect(fillText).toHaveBeenCalledWith(
    'Critical asset failed: player.heli',
    canvas.width / 2,
    canvas.height / 2 + 18,
  );
  expect(canvas.setAttribute).toHaveBeenCalledWith('role', 'alert');
  expect(canvas.setAttribute).toHaveBeenCalledWith('aria-label', message);
});
