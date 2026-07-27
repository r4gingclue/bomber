import { expect, it } from 'vitest';
import { screenCanvasSize } from './screen-canvas';
import { uiLayout } from './ui-layout';

it.each([
  [390, 844],
  [320, 568],
])('keeps CSS-space controls aligned with a DPR2 overlay at %ix%i', (w, h) => {
  const canvas = screenCanvasSize(w, h, 2);
  const layout = uiLayout(w, h, { top: 0, right: 0, bottom: 0, left: 0 }, true);

  expect(canvas).toEqual({ cssWidth: w, cssHeight: h, backingWidth: w * 2, backingHeight: h * 2 });
  expect(layout.move.x).toBeLessThanOrEqual(canvas.cssWidth);
  expect(layout.fire.x + layout.fire.r).toBeLessThanOrEqual(canvas.cssWidth);
  expect(layout.drop.y + layout.drop.r).toBeLessThanOrEqual(canvas.cssHeight);
});
