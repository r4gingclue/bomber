import { expect, it } from 'vitest';
import { DevicePixelRatioMonitor, screenCanvasSize } from './screen-canvas';
import { uiLayout } from './ui-layout';
import { fitViewport } from './viewport';

it.each([
  [390, 844],
  [320, 568],
])('keeps CSS-space controls aligned with a DPR2 overlay at %ix%i', (w, h) => {
  const canvas = screenCanvasSize(w, h, 2);
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const layout = uiLayout(w, h, insets, true, fitViewport(w, h, insets));

  expect(canvas).toEqual({ cssWidth: w, cssHeight: h, backingWidth: w * 2, backingHeight: h * 2 });
  expect(layout.move.x).toBeLessThanOrEqual(canvas.cssWidth);
  expect(layout.fire.x + layout.fire.r).toBeLessThanOrEqual(canvas.cssWidth);
  expect(layout.drop.y + layout.drop.r).toBeLessThanOrEqual(canvas.cssHeight);
});

it('detects DPR changes without requiring a CSS resize', () => {
  const monitor = new DevicePixelRatioMonitor(1);

  expect(monitor.changed(1)).toBe(false);
  expect(monitor.changed(2)).toBe(true);
  expect(monitor.changed(2)).toBe(false);
  expect(monitor.changed(3)).toBe(true);
});
