import { expect, it } from 'vitest';
import { uiLayout } from './ui-layout';

it('keeps phone touch controls inside safe areas', () => {
  const l = uiLayout(960, 540, { top: 0, right: 24, bottom: 34, left: 24 }, true);
  expect(l.move.x - l.move.r).toBeGreaterThanOrEqual(24);
  expect(l.fire.x + l.fire.r).toBeLessThanOrEqual(936);
  expect(l.drop.y + l.drop.r).toBeLessThanOrEqual(506);
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
  const l = uiLayout(w, h, { top: 0, right: 0, bottom: 0, left: 0 }, true);

  expect(l.move.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.fire.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.drop.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.hud.fontSize).toBeGreaterThanOrEqual(14);
  expect(l.hud.x + l.hud.w).toBeLessThanOrEqual(w);
});
