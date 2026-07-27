import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/rng';
import { World } from '../game/world';
import {
  GraphicsCapture,
  readGraphicsHarnessOptions,
  splitGraphicsSnapshot,
  stageHeavyCombat,
  stageVisualScene,
} from './graphics-harness';
import { helicopterPose } from '../render/helicopter';
import { isWater } from '../game/terrain';

describe('readGraphicsHarnessOptions', () => {
  it('keeps all diagnostics disabled outside development', () => {
    expect(readGraphicsHarnessOptions(
      '?harness=1&scene=coast&touch-ui&dpr=3&tier=minimum&record',
      false,
    )).toEqual({
      enabled: false,
      touchUi: false,
      reducedMotion: false,
      damageFlash: false,
      pixelRatio: 0,
      freeze: false,
      record: false,
      snapshot: false,
    });
  });

  it('parses an explicit development harness URL', () => {
    expect(readGraphicsHarnessOptions(
      '?harness=1&scene=coast&touch-ui&dpr=3&tier=minimum&freeze&record'
        + '&safe-top=0&safe-right=47&safe-bottom=21&safe-left=-4'
        + '&pose=descend&facing=left&snapshot',
      true,
    )).toMatchObject({
      enabled: true,
      scene: 'coast',
      touchUi: true,
      pixelRatio: 3,
      safeInsets: { top: 0, right: 47, bottom: 21, left: 0 },
      qualityTier: 'minimum',
      playerPose: 'descend',
      playerFacing: -1,
      freeze: true,
      record: true,
      snapshot: true,
    });
  });
});

it('captures delivered and render timing as separate fields', () => {
  const capture = new GraphicsCapture();
  capture.record(1000, 16.7, 2.5, 'full');
  capture.record(1017, 17, 2.8, 'reduced');

  expect(capture.toCsv()).toContain('timestampMs,elapsedMs,deliveredFrameMs,renderMs,tier');
  expect(capture.samples[1]).toMatchObject({
    elapsedMs: 17,
    deliveredFrameMs: 17,
    renderMs: 2.8,
    tier: 'reduced',
  });
  expect(capture.elapsedMs()).toBe(17);
  expect(capture.hasDuration(17)).toBe(true);
  expect(capture.hasDuration(18)).toBe(false);
});

it('splits snapshot exports into lossless bounded chunks', () => {
  const source = 'data:image/png;base64,' + 'a'.repeat(250_000);
  const chunks = splitGraphicsSnapshot(source);

  expect(chunks.every(chunk => chunk.length <= 100_000)).toBe(true);
  expect(chunks.join('')).toBe(source);
});

it('stages every moving unit and weapon for visual inspection', () => {
  const world = new World(mulberry32(1));
  stageVisualScene(world, 'inland');

  expect(new Set(world.subs.map(unit => unit.kind))).toEqual(new Set([
    'scout', 'gunship', 'mchopper', 'tank', 'aagun',
    'gunboat', 'patrol', 'hunter', 'missile', 'mine',
  ]));
  expect(new Set(world.shots.map(shot => shot.ptype))).toEqual(new Set([
    'bullet', 'shot', 'flak', 'torpedo', 'sam', 'pmissile',
  ]));
  expect(world.charges).toHaveLength(1);
  expect(world.rings).toHaveLength(2);
});

it.each([
  ['level', 1],
  ['accelerate', -1],
  ['brake', 1],
  ['climb', -1],
  ['descend', 1],
] as const)('stages the %s player pose facing %i', (pose, facing) => {
  const world = new World(mulberry32(1));
  stageVisualScene(world, 'sea', pose, facing);

  expect(world.player.facing).toBe(facing);
  expect(helicopterPose(world.player.vx, world.player.vy, facing)).toBe(pose);
});

it('centers the coast fixture on both land and water impacts', () => {
  const world = new World(mulberry32(1));
  stageVisualScene(world, 'coast');

  expect(world.rings.every(ring =>
    ring.x >= world.camX + 24 && ring.x <= world.camX + 456)).toBe(true);
  expect(world.rings.map(ring => isWater(world.terrain, ring.x))).toEqual([true, false]);
  expect(world.subs.every(unit =>
    unit.x >= world.camX && unit.x <= world.camX + 480)).toBe(true);
});

it('stages the documented heavy-combat load', () => {
  const world = new World(mulberry32(1));
  stageHeavyCombat(world);

  expect(world.subs).toHaveLength(18);
  expect(world.shots).toHaveLength(48);
  expect(world.charges).toHaveLength(6);
  expect(world.rings).toHaveLength(8);
  expect(world.particles).toHaveLength(120);
  expect(world.subs.every(unit =>
    unit.x >= world.camX && unit.x <= world.camX + 480)).toBe(true);
});
