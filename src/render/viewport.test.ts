import { describe, expect, it } from 'vitest';
import { clientToWorld, fitViewport, worldToRender } from './viewport';

describe('fitViewport', () => {
  it('contains 16:9 without cropping a wide viewport', () => {
    const v = fitViewport(1200, 600, { top: 0, right: 0, bottom: 0, left: 0 });
    expect(v.x).toBeCloseTo(200 / 3);
    expect(v.y).toBe(0);
    expect(v.width).toBeCloseTo(3200 / 3);
    expect(v.height).toBe(600);
    expect(v.scale).toBeCloseTo(600 / 540);
  });
  it('contains 16:9 inside safe-area insets', () => {
    const v = fitViewport(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    expect(v.x).toBe(0);
    expect(v.width).toBe(390);
    expect(v.height).toBeCloseTo(219.375);
    expect(v.y).toBeCloseTo(318.8125);
  });
  it('derives the unconstrained dimension to retain an exact 16:9 ratio', () => {
    for (const [width, height] of [[1366, 768], [390, 844], [844, 390]]) {
      const v = fitViewport(width, height, { top: 0, right: 0, bottom: 0, left: 0 });
      expect(v.width / v.height).toBeCloseTo(16 / 9, 12);
    }
  });
  it('stays inside fractional safe-area bounds without rounding outward', () => {
    const inset = { top: 1.25, right: 47.4, bottom: 2.75, left: 46.6 };
    const v = fitViewport(844, 390, inset);

    expect(v.x).toBeGreaterThanOrEqual(inset.left);
    expect(v.y).toBeGreaterThanOrEqual(inset.top);
    expect(v.x + v.width).toBeLessThanOrEqual(844 - inset.right);
    expect(v.y + v.height).toBeLessThanOrEqual(390 - inset.bottom);
    expect(v.width / v.height).toBeCloseTo(16 / 9, 12);
  });
});

it('round-trips world coordinates through render and client space', () => {
  const v = fitViewport(1280, 720, { top: 0, right: 0, bottom: 0, left: 0 });
  expect(worldToRender(240, 135)).toEqual({ x: 480, y: 270 });
  expect(clientToWorld(640, 360, v))
    .toEqual({ x: 240, y: 135 });
});

it('maps the visual center of a rounded safe-area viewport to the simulation center', () => {
  const v = fitViewport(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });

  expect(clientToWorld(v.x + v.width / 2, v.y + v.height / 2, v))
    .toEqual({ x: 240, y: 135 });
});
