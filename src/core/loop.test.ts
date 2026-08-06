import { afterEach, describe, it, expect, vi } from 'vitest';
import { FixedStepper, Loop, STEP } from './loop';

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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('reports the delivered requestAnimationFrame interval to the renderer', () => {
  let animationFrame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    animationFrame = callback;
    return 1;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(performance, 'now').mockReturnValue(100);
  const render = vi.fn();
  const loop = new Loop(vi.fn(), render);

  loop.start();
  animationFrame?.(116.75);

  expect(render).toHaveBeenCalledWith(expect.any(Number), 16.75);
  loop.stop();
});
