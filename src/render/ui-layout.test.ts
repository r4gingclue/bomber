import { expect, it } from 'vitest';
import { fitViewport } from './viewport';
import { uiLayout, type UiCircle, type UiRect } from './ui-layout';

function circleIntersectsRect(circle: UiCircle, rect: UiRect): boolean {
  const x = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const y = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  return (circle.x - x) ** 2 + (circle.y - y) ** 2 < circle.r ** 2;
}

it('keeps phone touch controls inside safe areas', () => {
  const insets = { top: 0, right: 24, bottom: 34, left: 24 };
  const viewport = fitViewport(960, 540, insets);
  const l = uiLayout(960, 540, insets, true, viewport);
  expect(l.move.x - l.move.r).toBeGreaterThanOrEqual(24);
  expect(l.fire.x + l.fire.r).toBeLessThanOrEqual(936);
  expect(l.drop.y + l.drop.r).toBeLessThanOrEqual(506);
});

it('moves touch controls into portrait letterbox space', () => {
  const viewport = fitViewport(390, 844, { top: 0, right: 0, bottom: 0, left: 0 });
  const l = uiLayout(390, 844, { top: 0, right: 0, bottom: 0, left: 0 }, true, viewport);

  expect(l.controlsInLetterbox).toBe(true);
  expect(l.move.y - l.move.r).toBeGreaterThanOrEqual(viewport.y + viewport.height);
  expect(l.fire.y - l.fire.r).toBeGreaterThanOrEqual(viewport.y + viewport.height);
  expect(l.drop.y - l.drop.r).toBeGreaterThanOrEqual(viewport.y + viewport.height);
});

it('moves touch controls into a tablet bottom letterbox', () => {
  const viewport = fitViewport(1024, 768, { top: 0, right: 0, bottom: 0, left: 0 });
  const l = uiLayout(1024, 768, { top: 0, right: 0, bottom: 0, left: 0 }, true, viewport);

  expect(l.controlsInLetterbox).toBe(true);
  expect(l.move.y - l.move.r).toBeGreaterThanOrEqual(viewport.y + viewport.height);
});

it('uses compact translucent edge controls when landscape has no usable letterbox', () => {
  const insets = { top: 0, right: 47, bottom: 0, left: 47 };
  const viewport = fitViewport(844, 390, insets);
  const l = uiLayout(844, 390, insets, true, viewport);

  expect(l.controlsInLetterbox).toBe(false);
  expect(l.move.r).toBe(22);
  expect(l.fire.r).toBe(22);
  expect(l.drop.r).toBe(22);
  expect(l.controlOpacity).toBeLessThanOrEqual(0.4);
  expect(l.gameplaySafe.w).toBeGreaterThan(viewport.width * 0.5);
  for (const control of [l.move, l.fire, l.drop]) {
    expect(circleIntersectsRect(control, l.gameplaySafe)).toBe(false);
  }
});

it('uses compact desktop controls and pins the HUD to the safe top-left edge', () => {
  const l = uiLayout(960, 540, { top: 12, right: 0, bottom: 0, left: 18 }, false);

  expect(l.hud).toMatchObject({ x: 38, y: 32 });
  expect(l.move.r).toBe(38);
});

it('keeps upgrade cards inside narrow safe-area bounds', () => {
  const l = uiLayout(960, 540, { top: 47, right: 160, bottom: 34, left: 160 }, false);

  expect(l.cards[0].x).toBeGreaterThanOrEqual(160);
  expect(l.cards[2].x + l.cards[2].w).toBeLessThanOrEqual(800);
  expect(l.cards[0].y).toBeGreaterThanOrEqual(47);
  expect(l.cards[0].y + l.cards[0].h).toBeLessThanOrEqual(506);
});

it.each([
  [390, 844],
  [320, 568],
])('keeps portrait HUD text and touch targets physically usable at %ix%i', (w, h) => {
  const viewport = fitViewport(w, h, { top: 0, right: 0, bottom: 0, left: 0 });
  const l = uiLayout(w, h, { top: 0, right: 0, bottom: 0, left: 0 }, true, viewport);

  expect(l.move.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.fire.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.drop.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.hud.fontSize).toBeGreaterThanOrEqual(14);
  expect(l.hud.x + l.hud.w).toBeLessThanOrEqual(w);
});
