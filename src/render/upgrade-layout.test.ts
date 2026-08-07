import { expect, it } from 'vitest';
import { UPGRADE_NODES } from '../game/upgrade-tree';
import { resultsControlAt, upgradeControlAt, upgradeLayout } from './upgrade-layout';
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
    ...(layout.detail ? [layout.detail] : []),
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

it('reserves a focused-node detail region beside readable compact landscape cards', () => {
  const layout = upgradeLayout(844, 390, { top: 0, right: 47, bottom: 21, left: 47 }, 'weapons', UPGRADE_NODES);

  expect(layout.detail).not.toBeNull();
  expect(Math.min(...layout.nodes.map(node => node.rect.h))).toBeGreaterThanOrEqual(32);
  expect(layout.nodes.every(node => node.rect.x + node.rect.w <= layout.detail!.x)).toBe(true);
  expect(layout.detail!.y + layout.detail!.h).toBeLessThan(layout.continueButton.y);
});

it('keeps desktop descriptions in cards and gives portrait a bounded detail region', () => {
  const desktop = upgradeLayout(1920, 1080, { top: 0, right: 0, bottom: 0, left: 0 }, 'weapons', UPGRADE_NODES);
  const portrait = upgradeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, 'weapons', UPGRADE_NODES);

  expect(desktop.detail).toBeNull();
  expect(portrait.detail).not.toBeNull();
  expect(portrait.nodes.at(-1)!.rect.y + portrait.nodes.at(-1)!.rect.h)
    .toBeLessThanOrEqual(portrait.detail!.y);
});

it('hit-tests the results Continue button from shared layout geometry', () => {
  const layout = upgradeLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 }, 'weapons', UPGRADE_NODES);
  const button = layout.resultsContinueButton;

  expect(resultsControlAt(layout, { x: button.x + button.w / 2, y: button.y + button.h / 2 })).toBe('continue');
  expect(resultsControlAt(layout, { x: layout.panel.x, y: layout.panel.y })).toBeNull();
});

it('hit-tests all tabs, node purchase/refund, and Start Next Wave from shared geometry', () => {
  const layout = upgradeLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 }, 'defense', UPGRADE_NODES);
  for (const [index, tab] of layout.tabs.entries()) {
    expect(upgradeControlAt(layout, { x: tab.x + tab.w / 2, y: tab.y + tab.h / 2 }, new Set())).toEqual({ type: 'tab', index });
  }
  for (const [index, item] of layout.nodes.entries()) {
    const point = { x: item.rect.x + item.rect.w / 2, y: item.rect.y + item.rect.h / 2 };
    expect(upgradeControlAt(layout, point, new Set())).toEqual({ type: 'purchase', id: item.node.id, index });
    expect(upgradeControlAt(layout, point, new Set([item.node.id]))).toEqual({ type: 'refund', id: item.node.id, index });
  }
  const button = layout.continueButton;
  expect(upgradeControlAt(layout, { x: button.x + button.w / 2, y: button.y + button.h / 2 }, new Set())).toEqual({ type: 'continue' });
});

it('keeps portrait detail strictly above the footer ink box', () => {
  const layout = upgradeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, 'weapons', UPGRADE_NODES);

  expect(layout.footer).toMatchObject({
    fontSize: 11,
    baseline: 732,
    inkTop: 721,
    detailGap: 3,
  });
  expect(layout.detail!.y + layout.detail!.h).toBeLessThanOrEqual(720);
});

it('uses a single scroll-free node path in portrait', () => {
  const layout = upgradeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, 'weapons', weaponNodes);

  expect(new Set(layout.nodes.map(node => node.rect.x)).size).toBe(1);
  expect(layout.nodes.at(-1)!.rect.y + layout.nodes.at(-1)!.rect.h)
    .toBeLessThanOrEqual(layout.continueButton.y);
});
