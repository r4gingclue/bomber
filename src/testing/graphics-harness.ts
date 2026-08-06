import { mulberry32 } from '../core/rng';
import type { Sub, Projectile, Particle } from '../game/entities/types';
import type { World } from '../game/world';
import { generateTerrain, surfaceAt } from '../game/terrain';
import type { Biome } from '../game/biomes';
import type { SpawnKind } from '../game/waves';
import type { HelicopterPose } from '../render/helicopter';
import type { QualityTier } from '../render/quality';
import type { Insets } from '../render/viewport';
import { buildPostWaveView, type PostWaveView } from '../game/post-wave';
import { RunProgression } from '../game/run-progression';
import type { UpgradeBranch, UpgradeId } from '../game/upgrade-tree';

export type ProgressionHarnessScene = 'results' | 'upgrade-tree';
export type GraphicsHarnessScene = Biome | 'heavy-combat' | ProgressionHarnessScene;

export interface ProgressionHarnessFixture {
  progression: RunProgression;
  postWaveView: PostWaveView;
  branch: UpgradeBranch;
  focusedNode: UpgradeId;
}

export interface GraphicsHarnessOptions {
  enabled: boolean;
  touchUi: boolean;
  reducedMotion: boolean;
  damageFlash: boolean;
  pixelRatio: number;
  safeInsets?: Insets;
  qualityTier?: QualityTier;
  scene?: GraphicsHarnessScene;
  playerPose?: HelicopterPose;
  playerFacing?: 1 | -1;
  freeze: boolean;
  record: boolean;
  snapshot: boolean;
}

export interface GraphicsCaptureSample {
  timestampMs: number;
  elapsedMs: number;
  deliveredFrameMs: number;
  renderMs: number;
  tier: QualityTier;
}

const SNAPSHOT_CHUNK_SIZE = 100_000;

const qualityTier = (value: string | null): QualityTier | undefined =>
  value === 'full' || value === 'reduced' || value === 'minimum' ? value : undefined;

const harnessScene = (value: string | null): GraphicsHarnessScene | undefined =>
  value === 'sea' || value === 'coast' || value === 'inland' || value === 'heavy-combat'
  || value === 'results' || value === 'upgrade-tree'
    ? value
    : undefined;

const helicopterPose = (value: string | null): HelicopterPose | undefined =>
  value === 'level'
  || value === 'accelerate'
  || value === 'brake'
  || value === 'climb'
  || value === 'descend'
    ? value
    : undefined;

const nonNegativeNumber = (value: string | null): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function readGraphicsHarnessOptions(
  search: string,
  development: boolean,
): GraphicsHarnessOptions {
  const params = new URLSearchParams(search);
  const enabled = development && params.get('harness') === '1';
  if (!enabled) {
    return {
      enabled: false,
      touchUi: false,
      reducedMotion: false,
      damageFlash: false,
      pixelRatio: 0,
      freeze: false,
      record: false,
      snapshot: false,
    };
  }
  const requestedDpr = Number(params.get('dpr'));
  const hasSafeInset = ['safe-top', 'safe-right', 'safe-bottom', 'safe-left']
    .some(name => params.has(name));
  return {
    enabled,
    touchUi: params.has('touch-ui'),
    reducedMotion: params.has('reduced-motion'),
    damageFlash: params.has('damage-flash'),
    pixelRatio: Number.isFinite(requestedDpr) && requestedDpr > 0 ? requestedDpr : 0,
    safeInsets: hasSafeInset ? {
      top: nonNegativeNumber(params.get('safe-top')),
      right: nonNegativeNumber(params.get('safe-right')),
      bottom: nonNegativeNumber(params.get('safe-bottom')),
      left: nonNegativeNumber(params.get('safe-left')),
    } : undefined,
    qualityTier: qualityTier(params.get('tier')),
    scene: harnessScene(params.get('scene')),
    playerPose: helicopterPose(params.get('pose')),
    playerFacing: params.get('facing') === 'left'
      ? -1
      : params.get('facing') === 'right' ? 1 : undefined,
    freeze: params.has('freeze'),
    record: params.has('record'),
    snapshot: params.has('snapshot'),
  };
}

/** Exports the live battlefield and screen-space UI as one CSS-pixel PNG. */
export function captureViewportFrame(
  gameCanvas: HTMLCanvasElement,
  uiCanvas: HTMLCanvasElement,
  viewportWidth: number,
  viewportHeight: number,
): string {
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(viewportWidth));
  output.height = Math.max(1, Math.round(viewportHeight));
  const context = output.getContext('2d');
  if (!context) throw new Error('Graphics snapshot canvas is unavailable');
  context.fillStyle = '#101418';
  context.fillRect(0, 0, output.width, output.height);
  for (const canvas of [gameCanvas, uiCanvas]) {
    const rect = canvas.getBoundingClientRect();
    context.drawImage(canvas, rect.left, rect.top, rect.width, rect.height);
  }
  return output.toDataURL('image/png');
}

export function splitGraphicsSnapshot(snapshot: string): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < snapshot.length; start += SNAPSHOT_CHUNK_SIZE) {
    chunks.push(snapshot.slice(start, start + SNAPSHOT_CHUNK_SIZE));
  }
  return chunks;
}

export class GraphicsCapture {
  private startedAt: number | undefined;
  readonly samples: GraphicsCaptureSample[] = [];

  record(
    timestampMs: number,
    deliveredFrameMs: number,
    renderMs: number,
    tier: QualityTier,
  ): void {
    this.startedAt ??= timestampMs;
    this.samples.push({
      timestampMs,
      elapsedMs: timestampMs - this.startedAt,
      deliveredFrameMs,
      renderMs,
      tier,
    });
  }

  clear(): void {
    this.startedAt = undefined;
    this.samples.length = 0;
  }

  elapsedMs(): number {
    return this.samples.at(-1)?.elapsedMs ?? 0;
  }

  hasDuration(durationMs: number): boolean {
    return this.elapsedMs() >= durationMs;
  }

  toCsv(): string {
    const rows = ['timestampMs,elapsedMs,deliveredFrameMs,renderMs,tier'];
    for (const sample of this.samples) {
      rows.push([
        sample.timestampMs.toFixed(3),
        sample.elapsedMs.toFixed(3),
        sample.deliveredFrameMs.toFixed(3),
        sample.renderMs.toFixed(3),
        sample.tier,
      ].join(','));
    }
    return `${rows.join('\n')}\n`;
  }
}

export function stageProgressionScene(scene: ProgressionHarnessScene): ProgressionHarnessFixture {
  const postWaveView = buildPostWaveView(
    { score: 36, accuracy: 24, survival: 27, total: 87, bonusPoint: true },
    { base: 1, bonus: 1, total: 2 },
    5,
  );
  if (scene === 'results') {
    return {
      progression: new RunProgression({ points: 5 }),
      postWaveView,
      branch: 'defense',
      focusedNode: 'field-repair',
    };
  }

  const progression = new RunProgression({ points: 7 });
  progression.purchase('armor-1');
  progression.confirm();
  progression.purchase('field-repair');
  return { progression, postWaveView, branch: 'defense', focusedNode: 'field-repair' };
}

const hpFor = (kind: SpawnKind): number => {
  if (kind === 'gunship' || kind === 'gunboat') return 24;
  if (kind === 'mchopper') return 16;
  if (kind === 'tank') return 20;
  if (kind === 'scout') return 8;
  return 1;
};

function fixtureSub(
  id: number,
  kind: SpawnKind,
  x: number,
  y: number,
  dir: 1 | -1,
): Sub {
  return {
    id,
    kind,
    hp: hpFor(kind),
    x,
    y,
    vx: 0,
    vy: 0,
    dir,
    fireTimer: 999,
    surfaceTimer: 999,
    surfaced: false,
    hitFlash: 0,
  };
}

function fixtureProjectile(
  id: number,
  ptype: Projectile['ptype'],
  x: number,
  y: number,
  vx: number,
  vy: number,
): Projectile {
  return { id, ptype, x, y, vx, vy, age: 0, life: 999, damage: 1 };
}

const poseVelocity = (
  pose: HelicopterPose,
  facing: 1 | -1,
): { vx: number; vy: number } => {
  if (pose === 'accelerate') return { vx: 120 * facing, vy: 0 };
  if (pose === 'brake') return { vx: -120 * facing, vy: 0 };
  if (pose === 'climb') return { vx: 0, vy: -100 };
  if (pose === 'descend') return { vx: 0, vy: 100 };
  return { vx: 0, vy: 0 };
};

function closestSurfaceX(
  world: World,
  water: boolean,
  preferredScreenX: number,
): number | undefined {
  const firstColumn = Math.ceil((world.camX + 24) / 8);
  const lastColumn = Math.floor((world.camX + 456) / 8);
  const preferredColumn = Math.round((world.camX + preferredScreenX) / 8);
  let closest: number | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (let column = firstColumn; column <= lastColumn; column++) {
    if (world.terrain.water[column] !== water) continue;
    const candidateDistance = Math.abs(column - preferredColumn);
    if (candidateDistance < distance) {
      closest = column * 8 + 4;
      distance = candidateDistance;
    }
  }
  return closest;
}

export function stageVisualScene(
  world: World,
  biome: Biome,
  playerPose: HelicopterPose = 'level',
  playerFacing: 1 | -1 = 1,
): void {
  const act = biome === 'sea' ? 1 : biome === 'coast' ? 2 : 3;
  world.act = act;
  world.wave = 1;
  world.waveInAct = 1;
  world.terrain = generateTerrain(biome, mulberry32(0x5ea + act));
  const shoreColumn = world.terrain.water.findIndex(value => !value);
  world.camX = biome === 'coast' && shoreColumn >= 0
    ? Math.max(0, shoreColumn * 8 - 240)
    : 0;
  const at = (screenX: number) => world.camX + screenX;
  const velocity = poseVelocity(playerPose, playerFacing);
  world.player.x = at(240);
  world.player.y = 58;
  world.player.vx = velocity.vx;
  world.player.vy = velocity.vy;
  world.player.hp = world.stats.maxHp;
  world.player.iframes = 0;
  world.player.facing = playerFacing;
  world.player.turretAngle = 0.2;
  world.charges = [{ id: 800, x: at(238), y: 130, vx: 0, vy: 0 }];

  const groundY = (x: number) => surfaceAt(world.terrain, x) - 4;
  world.subs = [
    fixtureSub(101, 'scout', at(58), 48, 1),
    fixtureSub(102, 'gunship', at(155), 74, -1),
    fixtureSub(103, 'mchopper', at(276), 47, 1),
    fixtureSub(104, 'tank', at(352), groundY(at(352)), 1),
    fixtureSub(105, 'aagun', at(426), groundY(at(426)), -1),
    fixtureSub(106, 'gunboat', at(365), 145, 1),
    fixtureSub(107, 'patrol', at(72), 186, 1),
    fixtureSub(108, 'hunter', at(181), 220, -1),
    fixtureSub(109, 'missile', at(310), 245, 1),
    fixtureSub(110, 'mine', at(430), 205, -1),
  ];
  world.shots = [
    fixtureProjectile(201, 'bullet', at(82), 121, 260, 0),
    fixtureProjectile(202, 'shot', at(142), 132, 180, 20),
    fixtureProjectile(203, 'flak', at(205), 140, 80, -180),
    fixtureProjectile(204, 'torpedo', at(286), 180, 120, 0),
    fixtureProjectile(205, 'sam', at(346), 116, 0, -140),
    fixtureProjectile(206, 'pmissile', at(412), 92, 180, -20),
  ];
  const waterX = closestSurfaceX(world, true, 110) ?? at(110);
  const landX = closestSurfaceX(world, false, 370) ?? at(370);
  world.rings = [
    { x: waterX, y: 148, age: 0.08 },
    { x: landX, y: surfaceAt(world.terrain, landX), age: 0.12 },
  ];
  world.particles = Array.from({ length: 72 }, (_, index): Particle => {
    const water = index % 3 === 0;
    const smoke = index % 7 === 0;
    const x = water ? waterX : landX;
    return {
      id: 300 + index,
      x: x + (index % 9) * 2 - 8,
      y: (water ? 148 : surfaceAt(world.terrain, landX)) - (index % 6),
      vx: (index % 5 - 2) * 14,
      vy: -20 - (index % 4) * 8,
      life: 0.3 + (index % 5) * 0.08,
      maxLife: smoke ? 0.8 : water ? 0.5 : 0.8,
      color: smoke ? '#3a3f46' : water ? '#cfe8ff' : '#ffb347',
      size: 2,
    };
  });
}

export function stageHeavyCombat(world: World): void {
  stageVisualScene(world, 'coast');
  const at = (screenX: number) => world.camX + screenX;
  const baseSubs = [...world.subs];
  world.subs = Array.from({ length: 18 }, (_, index) => {
    const base = baseSubs[index % baseSubs.length];
    const x = at(28 + (index * 71) % 430);
    return {
      ...base,
      id: 1000 + index,
      x,
      y: base.kind === 'tank' || base.kind === 'aagun'
        ? surfaceAt(world.terrain, x) - 4
        : 35 + (index * 31) % 210,
    };
  });
  const baseShots = [...world.shots];
  world.shots = Array.from({ length: 48 }, (_, index) => ({
    ...baseShots[index % baseShots.length],
    id: 2000 + index,
    x: at(16 + (index * 47) % 450),
    y: 28 + (index * 37) % 220,
  }));
  world.charges = Array.from({ length: 6 }, (_, index) => ({
    id: 3000 + index,
    x: at(65 + index * 68),
    y: 118 + index * 17,
    vx: 0,
    vy: 25,
  }));
  world.rings = Array.from({ length: 8 }, (_, index) => ({
    x: at(35 + index * 58),
    y: index % 2 === 0 ? 148 : surfaceAt(world.terrain, at(35 + index * 58)),
    age: (index % 4) * 0.045,
  }));
  world.particles = Array.from({ length: 120 }, (_, index): Particle => ({
    id: 4000 + index,
    x: at(15 + (index * 43) % 450),
    y: 30 + (index * 29) % 220,
    vx: (index % 7 - 3) * 12,
    vy: -18 - (index % 5) * 7,
    life: 0.3 + (index % 6) * 0.08,
    maxLife: index % 9 === 0 ? 0.5 : 0.8,
    color: index % 9 === 0 ? '#cfe8ff' : index % 7 === 0 ? '#3a3f46' : '#ffb347',
    size: 2,
  }));
  world.player.hp = world.stats.maxHp;
  world.player.iframes = 0;
}
