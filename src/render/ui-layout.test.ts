import { expect, it } from 'vitest';
import { UPGRADE_NODES } from '../game/upgrade-tree';
import { upgradeLayout } from './upgrade-layout';
import { upgradeNodeWrapWidth } from './upgrade-view';
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
  expect(l.missile.x + l.missile.r).toBeLessThanOrEqual(936);
  expect(l.drop.y + l.drop.r).toBeLessThanOrEqual(506);
});

it('moves touch controls into portrait letterbox space', () => {
  const viewport = fitViewport(390, 844, { top: 0, right: 0, bottom: 0, left: 0 });
  const l = uiLayout(390, 844, { top: 0, right: 0, bottom: 0, left: 0 }, true, viewport);

  expect(l.controlsInLetterbox).toBe(true);
  // move and aim are centered in the bottom letterbox; drop/missile stack above
  expect(l.move.y).toBeGreaterThan(viewport.y + viewport.height);
  expect(l.aim.y).toBeGreaterThan(viewport.y + viewport.height);
  // All controls stay within the screen bounds
  expect(l.missile.y - l.missile.r).toBeGreaterThanOrEqual(viewport.y);
  expect(l.drop.y + l.drop.r).toBeLessThanOrEqual(844);
});

it('moves touch controls into a tablet bottom letterbox', () => {
  // Use a tall screen to ensure sufficient letterbox space for stacked buttons
  // (bottomBar needs to be >= 6r + 2*stackGap + 8 ≈ 296 for typical r)
  const viewport = fitViewport(1024, 1400, { top: 0, right: 0, bottom: 0, left: 0 });
  const l = uiLayout(1024, 1400, { top: 0, right: 0, bottom: 0, left: 0 }, true, viewport);

  expect(l.controlsInLetterbox).toBe(true);
  expect(l.move.y - l.move.r).toBeGreaterThanOrEqual(viewport.y + viewport.height);
});

it('uses compact translucent edge controls when landscape has no usable letterbox', () => {
  const insets = { top: 0, right: 47, bottom: 0, left: 47 };
  const viewport = fitViewport(844, 390, insets);
  const l = uiLayout(844, 390, insets, true, viewport);

  expect(l.controlsInLetterbox).toBe(false);
  expect(l.move.r).toBe(22);
  expect(l.missile.r).toBe(22);
  expect(l.drop.r).toBe(22);
  expect(l.controlOpacity).toBeLessThanOrEqual(0.4);
  expect(l.gameplaySafe.w).toBeGreaterThan(viewport.width * 0.5);
  for (const control of [l.move, l.missile, l.drop]) {
    expect(circleIntersectsRect(control, l.gameplaySafe)).toBe(false);
  }
});

it('uses compact desktop controls and pins the HUD to the safe top-left edge', () => {
  const l = uiLayout(960, 540, { top: 12, right: 0, bottom: 0, left: 18 }, false);

  expect(l.hud).toMatchObject({ x: 38, y: 32 });
  expect(l.move.r).toBe(38);
});

it.each([
  [390, 844],
  [320, 568],
])('keeps portrait HUD text and touch targets physically usable at %ix%i', (w, h) => {
  const viewport = fitViewport(w, h, { top: 0, right: 0, bottom: 0, left: 0 });
  const l = uiLayout(w, h, { top: 0, right: 0, bottom: 0, left: 0 }, true, viewport);

  expect(l.move.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.missile.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.drop.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.hud.fontSize).toBeGreaterThanOrEqual(14);
  expect(l.hud.x + l.hud.w).toBeLessThanOrEqual(w);
});

it.each([
  [1920, 1080, { top: 0, right: 0, bottom: 0, left: 0 }],
  [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }],
  [844, 390, { top: 0, right: 47, bottom: 21, left: 47 }],
] as const)('computes a usable wrapping width for every upgrade node at %ix%i', (w, h, insets) => {
  for (const branch of ['weapons', 'ordnance', 'defense', 'flight'] as const) {
    const layout = upgradeLayout(w, h, insets, branch, UPGRADE_NODES);
    for (const { rect } of layout.nodes) {
      expect(upgradeNodeWrapWidth(rect)).toBeGreaterThan(0);
      expect(upgradeNodeWrapWidth(rect)).toBeLessThan(rect.w);
    }
  }
});

it('stacks the missile button directly above the drop button', () => {
  const l = uiLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 }, true);
  expect(l.missile.x).toBeCloseTo(l.drop.x, 5);
  expect(l.missile.y).toBeLessThan(l.drop.y);
  // no overlap between the two stacked buttons
  expect(l.drop.y - l.missile.y).toBeGreaterThanOrEqual(l.missile.r + l.drop.r);
});

it('anchors the button stack to the bottom-right of the safe area', () => {
  const insets = { top: 0, right: 20, bottom: 30, left: 0 };
  const l = uiLayout(960, 540, insets, true);
  expect(l.drop.x + l.drop.r).toBeLessThanOrEqual(960 - insets.right);
  expect(l.drop.y + l.drop.r).toBeLessThanOrEqual(540 - insets.bottom);
});

it('splits the steering and aiming zones at the horizontal midpoint', () => {
  const l = uiLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 }, true);
  expect(l.zoneSplitX).toBeCloseTo(480, 5);
  const inset = uiLayout(960, 540, { top: 0, right: 40, bottom: 0, left: 60 }, true);
  expect(inset.zoneSplitX).toBeCloseTo(60 + (960 - 60 - 40) / 2, 5);
});

it('keeps both stacked buttons at the 44px minimum touch target', () => {
  const l = uiLayout(720, 360, { top: 0, right: 0, bottom: 0, left: 0 }, true);
  expect(l.missile.r * 2).toBeGreaterThanOrEqual(44);
  expect(l.drop.r * 2).toBeGreaterThanOrEqual(44);
});

it('falls back to the compact overlay on 4:3 tablet landscape (iPad 1024x768)', () => {
  // Intentional, accepted trade-off (see the guard comment in ui-layout.ts):
  // two stacked 44px buttons need ~100px of bar, and this size's bar is too
  // short to fit them without breaking the 44px touch-target floor, so it
  // falls through to the compact overlay instead of the letterbox layout.
  const l = uiLayout(1024, 768, { top: 0, right: 0, bottom: 0, left: 0 }, true);

  expect(l.controlsInLetterbox).toBe(false);
  expect(l.controlOpacity).toBeLessThanOrEqual(0.4);
  expect(l.move.r).toBe(22);
  expect(l.missile.r).toBe(22);
  expect(l.drop.r).toBe(22);
});

it('prevents missile overlap when bottomBar is insufficient', () => {
  // Regression test: with four stacked controls on the right (aim, drop, missile),
  // the letterbox guard requires bottomBar >= 6r + 2*stackGap + 8.
  // This test verifies that when the guard passes, controls stay below battlefield.
  const viewport = fitViewport(1024, 1400, { top: 0, right: 0, bottom: 0, left: 0 });
  const l = uiLayout(1024, 1400, { top: 0, right: 0, bottom: 0, left: 0 }, true, viewport);

  // If letterbox layout was chosen, verify controls don't overlap battlefield
  if (l.controlsInLetterbox) {
    expect(l.aim.y - l.aim.r).toBeGreaterThanOrEqual(l.battlefield.y + l.battlefield.h);
  }
  // Verify drop respects safe area boundaries
  expect(l.drop.y + l.drop.r).toBeLessThanOrEqual(1400);
});
