import { expect, it } from 'vitest';
import { helicopterDisplaySize, helicopterPose, shadowStyle } from './helicopter';

it('selects braking separately from accelerating', () => {
  expect(helicopterPose(120, 0, 1)).toBe('accelerate');
  expect(helicopterPose(-120, 0, 1)).toBe('brake');
});

it('prioritizes strong climb and descent attitudes', () => {
  expect(helicopterPose(120, -100, 1)).toBe('climb');
  expect(helicopterPose(120, 100, 1)).toBe('descend');
});

it('makes low-altitude shadows darker and tighter', () => {
  expect(shadowStyle(10).alpha).toBeGreaterThan(shadowStyle(100).alpha);
  expect(shadowStyle(10).scale).toBeLessThan(shadowStyle(100).scale);
});

it('keeps the painted player helicopter in scale with other aircraft', () => {
  expect(helicopterDisplaySize()).toEqual({ width: 64, height: 32 });
});
