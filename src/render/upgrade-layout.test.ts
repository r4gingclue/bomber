import { expect, it } from 'vitest';
import { UPGRADE_NODES } from '../game/upgrade-tree';
import { upgradeLayout } from './upgrade-layout';
import type { UiRect } from './ui-layout';

const weaponNodes = UPGRADE_NODES.filter(node => node.branch === 'weapons');

function rectWithinInsets(rect: UiRect, w: number, h: number, insets: { top: number; right: number; bottom: number; left: number }): boolean {
  return rect.x >= insets.left
    && rect.y >= insets.top
    && rect.x + rect.w <= w - insets.right
    && rect.y + rect.h <= h - insets.bottom;
}

it.each([
  [1920, 1080, { top: 0, right: 0, bottom: 0, left: 0 }],
  [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }],
  [844, 390, { top: 0, right: 47, bottom: 21, left: 47 }],
] as const)('keeps results and tree controls within the safe area at %ix%i', (w, h, insets) => {
  const layout = upgradeLayout(w, h, insets, 'weapons', weaponNodes);

  expect(layout.tabs).toHaveLength(4);
  expect(layout.nodes).toHaveLength(weaponNodes.length);
  for (const rect of [
    layout.panel,
    ...layout.tabs,
    ...layout.nodes.map(node => node.rect),
    layout.continueButton,
    layout.resultsContinueButton,
  ]) {
    expect(rectWithinInsets(rect, w, h, insets)).toBe(true);
  }
});

it('shows only the selected branch nodes', () => {
  const layout = upgradeLayout(1280, 720, { top: 0, right: 0, bottom: 0, left: 0 }, 'defense', UPGRADE_NODES);

  expect(layout.nodes.map(node => node.node.id)).toEqual([
    'armor-1',
    'field-repair',
    'armor-2',
    'point-defense',
    'reinforced-defense',
  ]);
});

it('uses a two-column node path on desktop and compact landscape', () => {
  const desktop = upgradeLayout(1920, 1080, { top: 0, right: 0, bottom: 0, left: 0 }, 'weapons', weaponNodes);
  const landscape = upgradeLayout(844, 390, { top: 0, right: 47, bottom: 21, left: 47 }, 'weapons', weaponNodes);

  expect(new Set(desktop.nodes.map(node => node.rect.x)).size).toBe(2);
  expect(new Set(landscape.nodes.map(node => node.rect.x)).size).toBe(2);
  expect(landscape.nodes[0].rect.h).toBeLessThan(desktop.nodes[0].rect.h);
});

it('uses a single scroll-free node path in portrait', () => {
  const layout = upgradeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, 'weapons', weaponNodes);

  expect(new Set(layout.nodes.map(node => node.rect.x)).size).toBe(1);
  expect(layout.nodes.at(-1)!.rect.y + layout.nodes.at(-1)!.rect.h)
    .toBeLessThanOrEqual(layout.continueButton.y);
});
