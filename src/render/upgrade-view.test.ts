import { expect, it } from 'vitest';
import type { LoadedAssets } from './assets';
import type { PostWaveView } from '../game/post-wave';
import { RunProgression } from '../game/run-progression';
import { UPGRADE_NODES } from '../game/upgrade-tree';
import { Renderer } from './renderer';
import { upgradeLayout } from './upgrade-layout';
import { fitViewport } from './viewport';
import {
  buildUpgradeNodeRenderPlan,
  buildUpgradeTreeView,
  perkPointHudText,
  type UpgradeTextRegionPlan,
} from './upgrade-view';
import { uiLayout, type UiRect } from './ui-layout';

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

const measureText = (text: string, size: number): number => text.length * size * 0.55;

function expectLinesInside(region: UpgradeTextRegionPlan): void {
  for (const line of region.lines) {
    expect(line.baseline - line.fontSize).toBeGreaterThanOrEqual(region.rect.y);
    expect(line.baseline + Math.ceil(line.fontSize * 0.25))
      .toBeLessThanOrEqual(region.rect.y + region.rect.h);
  }
}

it('keeps every compact landscape card line bounded and moves exact focused details out of cards', () => {
  const progression = new RunProgression();
  const insets = { top: 0, right: 47, bottom: 21, left: 47 };

  for (const branch of ['weapons', 'ordnance', 'defense', 'flight'] as const) {
    const layout = upgradeLayout(844, 390, insets, branch, UPGRADE_NODES);
    expect(layout.detail).not.toBeNull();
    for (const item of layout.nodes) {
      const node = buildUpgradeTreeView(progression, branch, item.node.id)
        .nodes.find(candidate => candidate.id === item.node.id)!;
      const plan = buildUpgradeNodeRenderPlan(node, item.rect, layout.detail, measureText);

      expectLinesInside(plan.card);
      expect(plan.card.lines.map(line => line.role)).toEqual(['name', 'cost', 'status']);
      expect(plan.detail).toBeDefined();
      expectLinesInside(plan.detail!);
      expect(plan.detail!.lines.filter(line => line.role === 'description').map(line => line.text).join(' '))
        .toBe(item.node.description);
      expect(plan.detail!.lines.filter(line => line.role === 'status').map(line => line.text).join(' '))
        .toBe(node.reason);
    }
  }
});

it.each([
  ['desktop', 1920, 1080, { top: 0, right: 0, bottom: 0, left: 0 }, false],
  ['portrait', 390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, true],
] as const)('keeps all %s card and detail lines inside their regions', (_name, w, h, insets, usesDetail) => {
  const progression = new RunProgression({ points: 9 });
  for (const branch of ['weapons', 'ordnance', 'defense', 'flight'] as const) {
    const layout = upgradeLayout(w, h, insets, branch, UPGRADE_NODES);
    expect(Boolean(layout.detail)).toBe(usesDetail);
    if (_name === 'portrait') {
      expect(layout.detail!.y + layout.detail!.h).toBeLessThanOrEqual(720);
    }
    for (const item of layout.nodes) {
      const node = buildUpgradeTreeView(progression, branch, item.node.id)
        .nodes.find(candidate => candidate.id === item.node.id)!;
      const plan = buildUpgradeNodeRenderPlan(node, item.rect, layout.detail, measureText);

      expectLinesInside(plan.card);
      if (usesDetail) {
        expect(plan.detail).toBeDefined();
        expectLinesInside(plan.detail!);
        expect(plan.detail!.lines.filter(line => line.role === 'description').map(line => line.text).join(' '))
          .toBe(item.node.description);
      } else {
        expect(plan.detail).toBeUndefined();
        expect(plan.card.lines.filter(line => line.role === 'description').map(line => line.text).join(' '))
          .toBe(item.node.description);
      }
    }
  }
});

it.each([
  ['purchased', (progression: RunProgression): void => { progression.purchase('armor-1'); progression.confirm(); }, 'PURCHASED'],
  ['pending', (progression: RunProgression): void => { progression.purchase('armor-1'); }, 'PENDING — SELECT TO REFUND'],
  ['affordable', (_progression: RunProgression): void => undefined, 'AVAILABLE'],
  ['locked', (_progression: RunProgression): void => undefined, 'Requires 1 points.'],
] as const)('puts the exact %s status in the focused detail region', (_state, arrange, expected) => {
  const points = _state === 'locked' ? 0 : 1;
  const progression = new RunProgression({ points });
  arrange(progression);
  const layout = upgradeLayout(844, 390, { top: 0, right: 47, bottom: 21, left: 47 }, 'defense', UPGRADE_NODES);
  const node = buildUpgradeTreeView(progression, 'defense', 'armor-1').nodes[0];
  const plan = buildUpgradeNodeRenderPlan(node, layout.nodes[0].rect, layout.detail, measureText);

  expect(plan.detail!.lines.filter(line => line.role === 'status').map(line => line.text).join(' '))
    .toBe(expected);
  expectLinesInside(plan.detail!);
});

function recordingContext(backingWidth = 960, backingHeight = 540): {
  ctx: CanvasRenderingContext2D;
  texts: string[];
  lineSegments: string[];
  draws: { text: string; x: number; baseline: number; clip?: UiRect }[];
  transforms: number[][];
} {
  const texts: string[] = [];
  const lineSegments: string[] = [];
  const draws: { text: string; x: number; baseline: number; clip?: UiRect }[] = [];
  const transforms: number[][] = [];
  const clipStack: (UiRect | undefined)[] = [];
  let currentClip: UiRect | undefined;
  let pendingRect: UiRect | undefined;
  const ctx = {
    clearRect: () => undefined,
    fillRect: () => undefined,
    strokeRect: () => undefined,
    save: () => clipStack.push(currentClip),
    restore: () => { currentClip = clipStack.pop(); },
    beginPath: () => { pendingRect = undefined; },
    rect: (x: number, y: number, w: number, h: number) => { pendingRect = { x, y, w, h }; },
    clip: () => { currentClip = pendingRect; },
    setTransform: (...values: number[]) => { transforms.push(values); },
    moveTo: (x: number, y: number) => lineSegments.push(`M${x},${y}`),
    lineTo: (x: number, y: number) => lineSegments.push(`L${x},${y}`),
    stroke: () => undefined,
    fillText: (text: string, x: number, baseline: number) => {
      texts.push(text);
      draws.push({ text, x, baseline, clip: currentClip ? { ...currentClip } : undefined });
    },
    measureText: (text: string) => ({ width: text.length * 7 }),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    canvas: { width: backingWidth, height: backingHeight },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, texts, lineSegments, draws, transforms };
}

function rendererFixture(): {
  renderer: Renderer;
  texts: string[];
  lineSegments: string[];
  draws: { text: string; x: number; baseline: number; clip?: UiRect }[];
  transforms: number[][];
} {
  const world = recordingContext();
  const ui = recordingContext();
  return {
    renderer: new Renderer(world.ctx, ui.ctx, {} as LoadedAssets),
    texts: ui.texts,
    lineSegments: ui.lineSegments,
    draws: ui.draws,
    transforms: ui.transforms,
  };
}

it.each([
  ['compact landscape', 844, 390, 2],
  ['forced-DPR portrait', 390, 844, 3],
] as const)('restores the %s screen-space transform before drawing progression overlays', (_name, width, height, pixelRatio) => {
  const world = recordingContext();
  const ui = recordingContext(width * pixelRatio, height * pixelRatio);
  const renderer = new Renderer(world.ctx, ui.ctx, {} as LoadedAssets);
  const progression = new RunProgression({ points: 4 });
  const tree = buildUpgradeTreeView(progression, 'defense', 'armor-1');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const layout = uiLayout(width, height, insets, true, fitViewport(width, height, insets));
  const upgrade = upgradeLayout(width, height, insets, 'defense', UPGRADE_NODES);

  (renderer as unknown as {
    drawScreenUi: (
      world: unknown,
      phase: 'upgrade',
      touchUi: boolean,
      layout: ReturnType<typeof uiLayout>,
      audio: undefined,
      progression: { points: number; layout: typeof upgrade; tree: typeof tree },
    ) => void;
  }).drawScreenUi({}, 'upgrade', true, layout, undefined, {
    points: progression.points,
    layout: upgrade,
    tree,
  });

  if (_name === 'forced-DPR portrait') {
    (renderer as unknown as {
      drawScreenUi: (
        world: unknown,
        phase: 'results',
        touchUi: boolean,
        layout: ReturnType<typeof uiLayout>,
      ) => void;
    }).drawScreenUi({}, 'results', true, layout);
  }

  expect(ui.transforms).toContainEqual([pixelRatio, 0, 0, pixelRatio, 0, 0]);
});

it('renders compact card and focused detail lines at their planned baselines under matching clips', () => {
  const progression = new RunProgression();
  const branch = 'weapons';
  const focusedId = 'improved-tracking';
  const tree = buildUpgradeTreeView(progression, branch, focusedId);
  const layout = upgradeLayout(844, 390, { top: 0, right: 47, bottom: 21, left: 47 }, branch, UPGRADE_NODES);
  const { renderer, draws } = rendererFixture();

  renderer.upgradeTree(tree, layout);

  for (const item of layout.nodes) {
    const node = tree.nodes.find(candidate => candidate.id === item.node.id)!;
    const plan = buildUpgradeNodeRenderPlan(node, item.rect, layout.detail, text => text.length * 7);
    for (const region of [plan.card, ...(plan.detail ? [plan.detail] : [])]) {
      for (const line of region.lines) {
        expect(draws).toContainEqual(expect.objectContaining({
          text: line.text,
          baseline: line.baseline,
          clip: region.rect,
        }));
      }
    }
  }
});

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
