import { expect, it } from 'vitest';
import type { LoadedAssets } from './assets';
import type { PostWaveView } from '../game/post-wave';
import { RunProgression } from '../game/run-progression';
import { UPGRADE_NODES } from '../game/upgrade-tree';
import { Renderer } from './renderer';
import { upgradeLayout } from './upgrade-layout';
import { buildUpgradeTreeView, perkPointHudText } from './upgrade-view';

it('marks nodes as purchased, pending, affordable, or locked with a reason', () => {
  const progression = new RunProgression({ points: 6 });
  progression.purchase('armor-1');
  progression.confirm();
  progression.purchase('field-repair');

  const view = buildUpgradeTreeView(progression, 'defense');

  expect(view.nodes.find(node => node.id === 'armor-1')?.state).toBe('purchased');
  expect(view.nodes.find(node => node.id === 'field-repair')?.state).toBe('pending');
  expect(view.nodes.find(node => node.id === 'armor-2')?.state).toBe('affordable');
  expect(view.nodes.find(node => node.id === 'point-defense')).toMatchObject({
    state: 'locked',
    reason: 'Requires Armor Plating II.',
  });
});

it('keeps pending purchase state separate from keyboard focus and exposes exact display copy', () => {
  const progression = new RunProgression({ points: 3 });
  progression.purchase('armor-1');

  const view = buildUpgradeTreeView(progression, 'defense', 'armor-2');

  expect(view.points).toBe(2);
  expect(view.nodes.find(node => node.id === 'armor-1')).toMatchObject({
    name: 'Armor Plating I',
    description: 'Increase maximum health by 20.',
    cost: 1,
    state: 'pending',
    focused: false,
  });
  expect(view.nodes.find(node => node.id === 'armor-2')).toMatchObject({
    state: 'affordable',
    focused: true,
  });
});

it('builds the display model repeatedly without mutating progression', () => {
  const progression = new RunProgression({ points: 3 });
  progression.purchase('armor-1');
  const before = {
    points: progression.points,
    confirmed: [...progression.confirmed],
    pending: [...progression.pending],
  };

  const first = buildUpgradeTreeView(progression, 'defense', 'field-repair');
  const second = buildUpgradeTreeView(progression, 'defense', 'field-repair');

  expect(second).toEqual(first);
  expect({
    points: progression.points,
    confirmed: [...progression.confirmed],
    pending: [...progression.pending],
  }).toEqual(before);
});

it('formats the in-game point HUD label', () => {
  expect(perkPointHudText(7)).toBe('perk pts 7');
});

function recordingContext(): {
  ctx: CanvasRenderingContext2D;
  texts: string[];
  lineSegments: string[];
} {
  const texts: string[] = [];
  const lineSegments: string[] = [];
  const ctx = {
    clearRect: () => undefined,
    fillRect: () => undefined,
    strokeRect: () => undefined,
    beginPath: () => undefined,
    moveTo: (x: number, y: number) => lineSegments.push(`M${x},${y}`),
    lineTo: (x: number, y: number) => lineSegments.push(`L${x},${y}`),
    stroke: () => undefined,
    fillText: (text: string) => texts.push(text),
    measureText: (text: string) => ({ width: text.length * 7 }),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
  } as unknown as CanvasRenderingContext2D;
  return { ctx, texts, lineSegments };
}

function rendererFixture(): {
  renderer: Renderer;
  texts: string[];
  lineSegments: string[];
} {
  const world = recordingContext();
  const ui = recordingContext();
  return {
    renderer: new Renderer(world.ctx, ui.ctx, {} as LoadedAssets),
    texts: ui.texts,
    lineSegments: ui.lineSegments,
  };
}

it('renders the complete results breakdown and point balance', () => {
  const { renderer, texts } = rendererFixture();
  const layout = upgradeLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 }, 'defense', UPGRADE_NODES);
  const view: PostWaveView = {
    rating: { score: 32, accuracy: 21, survival: 27, total: 80, bonusPoint: true },
    award: { base: 1, bonus: 1, total: 2 },
    balance: 7,
  };

  renderer.results(view, layout);

  expect(texts).toEqual(expect.arrayContaining([
    'WAVE RESULTS',
    'COMBAT SCORE 32/40',
    'DEPTH-CHARGE ACCURACY 21/30',
    'SURVIVAL 27/30',
    'TOTAL 80/100',
    'BASE POINT +1',
    'RATING BONUS +1',
    'PERK POINTS 7',
    'CONTINUE',
  ]));
});

it('renders tabs, connected node details, lock and refund guidance, balance, and continue action', () => {
  const progression = new RunProgression({ points: 4 });
  progression.purchase('armor-1');
  const tree = buildUpgradeTreeView(progression, 'defense', 'armor-1');
  const layout = upgradeLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 }, 'defense', UPGRADE_NODES);
  const { renderer, texts, lineSegments } = rendererFixture();

  renderer.upgradeTree(tree, layout);

  expect(texts).toEqual(expect.arrayContaining([
    'WEAPONS',
    'ORDNANCE',
    'DEFENSE',
    'FLIGHT',
    'Armor Plating I',
    'Increase maximum health by 20.',
    '1 pt',
    'Requires Field Repair.',
    'Select pending upgrade again to refund',
    'PERK POINTS 3',
    'START NEXT WAVE',
  ]));
  expect(lineSegments.some(segment => segment.startsWith('L'))).toBe(true);
  expect(texts.join(' ')).not.toContain('choose an upgrade');
});
