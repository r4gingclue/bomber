import { describe, expect, it } from 'vitest';
import { clientToWorld, fitViewport, worldToRender } from './viewport';

describe('fitViewport', () => {
  it('contains 16:9 without cropping a wide viewport', () => {
    expect(fitViewport(1200, 600, { top: 0, right: 0, bottom: 0, left: 0 }))
      .toEqual({ x: 67, y: 0, width: 1067, height: 600, scale: 600 / 540 });
  });
  it('contains 16:9 inside safe-area insets', () => {
    const v = fitViewport(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    expect(v.x).toBe(0);
    expect(v.width).toBe(390);
    expect(v.height).toBe(219);
    expect(v.y).toBe(319);
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
