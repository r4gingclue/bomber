import { RENDER_H, RENDER_SCALE, RENDER_W, VIEW_W, VIEW_H, WATERLINE } from '../game/consts';
import type { World } from '../game/world';
import type { Phase } from '../game/state';
import type { PostWaveView } from '../game/post-wave';
import type { UiCircle, UiLayout } from './ui-layout';
import { PALETTES, actTitle } from '../game/biomes';
import { COL_W, COLS, isWater } from '../game/terrain';
import { AIR, GROUND } from '../game/waves';
import type { LoadedAssets, LoadedFrameAsset } from './assets';
import { helicopterDisplaySize, helicopterPose, shadowStyle, type HelicopterPose } from './helicopter';
import { sceneryForTerrain, type SceneryProp } from './scenery';
import { budgetedParticlesOldestFirst, effectBudget } from './effects';
import type { QualityTier } from './quality';
import { damageFlashMode } from './motion';
import { projectileHasTrail, projectileRotation, projectileVelocityAngle } from './projectile';
import { AUDIO_CREDIT_LINES, type AudioSettingsView } from './audio-settings';
import type { UpgradeLayout } from './upgrade-layout';
import {
  buildUpgradeNodeRenderPlan,
  perkPointHudText,
  type UpgradeNodeView,
  type UpgradeTextRegionPlan,
  type UpgradeTreeView,
} from './upgrade-view';

export interface ProgressionRenderView {
  points: number;
  layout?: UpgradeLayout;
  results?: PostWaveView;
  tree?: UpgradeTreeView;
}

interface CloudSpec { x: number; y: number; w: number }
const CLOUDS_FAR: CloudSpec[] = Array.from({ length: 8 }, (_, i) => ({
  x: (i * 233) % 960, y: 8 + (i * 29) % 50, w: 40 + (i * 61) % 50,
}));
const CLOUDS_NEAR: CloudSpec[] = Array.from({ length: 6 }, (_, i) => ({
  x: (i * 331) % 960, y: 60 + (i * 43) % 60, w: 26 + (i * 53) % 34,
}));

const wrapX = (x: number, cam: number, factor: number) =>
  ((x - cam * factor) % 960 + 960) % 960 - 240;

const HELICOPTER_POSES: HelicopterPose[] = [
  'level',
  'accelerate',
  'brake',
  'climb',
  'descend',
];

const RENDER_MAX_HP = {
  gunship: 24,
  mchopper: 16,
  tank: 20,
  gunboat: 24,
  scout: 8,
  aagun: 1,
  patrol: 1,
  hunter: 1,
  missile: 1,
  mine: 1,
} as const;

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private uiCtx: CanvasRenderingContext2D,
    private assets: LoadedAssets,
  ) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    uiCtx.imageSmoothingEnabled = true;
  }

  private touchVisualState: {
    steer: { ox: number; oy: number; dx: number; dy: number } | null;
    aim: { ox: number; oy: number; dx: number; dy: number } | null;
  } = { steer: null, aim: null };

  draw(
    world: World,
    phase: Phase,
    t: number,
    touchUI: boolean,
    qualityTier: QualityTier,
    layout: UiLayout,
    reducedFlash: boolean,
    debugDamageFlash = false,
    audioSettings?: AudioSettingsView,
    progressionView?: ProgressionRenderView,
  ): void {
    const { ctx } = this;
    const tier = qualityTier;
    const shx = world.shake ? (Math.random() * 2 - 1) * world.shake : 0;
    const shy = world.shake ? (Math.random() * 2 - 1) * world.shake : 0;
    const cam = world.camX + shx;
    const oy = shy; // vertical shake offset for world-space drawing
    this.drawBackground(world, cam, oy, t, tier);
    this.drawTerrain(world, cam, oy, t);
    this.drawScenery(world, cam, oy);
    this.drawWater(world, cam, oy, t, tier);
    this.drawShadows(world, cam, oy, tier);

    for (const s of world.subs) {
      const bob = s.kind === 'mine' ? Math.sin(t * 2 + s.id) * 1.5 : 0;
      this.drawUnit(s.kind, s.x, s.y + bob, cam, oy, s.dir < 0);
      if (s.kind === 'mine') {
        if (Math.floor(t * 3) % 2 === 0) {
          ctx.fillStyle = '#ffb38e';
          ctx.fillRect(Math.round(s.x - cam) + 4, Math.round(s.y + bob + oy) - 2, 2, 2);
        }
      }
      if (s.hitFlash > 0) {
        const pulse = 0.25 + s.hitFlash * 2.8;
        ctx.save();
        ctx.globalAlpha = Math.min(0.65, pulse);
        ctx.fillStyle = '#fff2c6';
        ctx.beginPath();
        ctx.ellipse(Math.round(s.x - cam), Math.round(s.y + oy), 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (world.sonarTimer > 0 && s.kind !== 'gunboat' && !AIR.has(s.kind) && !GROUND.has(s.kind)) {
        ctx.strokeStyle = 'rgba(120,255,160,0.8)';
        ctx.strokeRect(Math.round(s.x - cam) - 14, Math.round(s.y + oy) - 8, 28, 16);
      }
    }
    this.drawProjectiles(world, cam, oy);

    // painted player body with procedural rotor, turret, and altitude shadow
    const pl = world.player;
    if (pl.iframes <= 0 || Math.floor(t * 12) % 2 === 0) {
      const pose = helicopterPose(pl.vx, pl.vy, pl.facing);
      const playerAsset = this.assets.player.heli;
      const frame = playerAsset.frames[HELICOPTER_POSES.indexOf(pose)];
      const display = helicopterDisplaySize();
      this.drawPlayerRotor(pl.x, pl.y, cam, oy, t);
      ctx.save();
      ctx.translate(Math.round(pl.x - cam), Math.round(pl.y + oy));
      ctx.scale(pl.facing, 1);
      ctx.drawImage(
        playerAsset.image,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        -display.width / 2,
        -display.height / 2,
        display.width,
        display.height,
      );
      ctx.restore();
      this.drawPlayerTurret(pl.x, pl.y, pl.turretAngle, pl.muzzleT, cam, oy);
    }
    this.drawParticles(world, cam, oy, tier);
    this.drawGrading(world, tier);

    this.damageFlash(world, reducedFlash, debugDamageFlash);
    this.drawScreenUi(world, phase, touchUI, layout, audioSettings, progressionView);
    if (phase === 'menu') this.menu();
    if (phase === 'actIntro') this.actIntro(world);
    if (phase === 'gameover') this.gameover(world);
  }

  setTouchVisuals(visuals: {
    steer: { ox: number; oy: number; dx: number; dy: number } | null;
    aim: { ox: number; oy: number; dx: number; dy: number } | null;
  }): void {
    this.touchVisualState = visuals;
  }

  private drawBackground(
    world: World,
    cam: number,
    oy: number,
    t: number,
    tier: QualityTier,
  ): void {
    const { ctx } = this;
    const budget = effectBudget(tier);
    const pal = PALETTES[world.terrain.biome];
    const sky = ctx.createLinearGradient(0, 0, 0, WATERLINE);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    const farClouds = budget.animatedClouds ? CLOUDS_FAR : CLOUDS_FAR.slice(0, 4);
    for (const cl of farClouds) {
      const x = wrapX(cl.x, cam, 0.15);
      const drift = budget.animatedClouds ? Math.sin(t * 0.08 + cl.x) * 0.4 : 0;
      ctx.fillRect(x, cl.y + oy * 0.3 + drift, cl.w, 4);
      ctx.fillRect(x + 8, cl.y - 2 + oy * 0.3 + drift, cl.w - 16, 2);
    }

    ctx.fillStyle = 'rgba(230,240,255,0.25)';
    ctx.fillRect(0, WATERLINE - 22 + oy, VIEW_W, 22);

    if (budget.animatedClouds) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (const cl of CLOUDS_NEAR) {
        const x = wrapX(cl.x, cam, 0.4);
        const drift = Math.sin(t * 0.12 + cl.y) * 0.6;
        ctx.fillRect(x, cl.y + oy * 0.6 + drift, cl.w, 5);
        ctx.fillRect(x + 6, cl.y - 3 + oy * 0.6 + drift, cl.w - 12, 3);
      }
    }

    if (world.terrain.biome === 'inland') {
      ctx.fillStyle = pal.skyBottom;
    } else {
      const sea = ctx.createLinearGradient(0, WATERLINE, 0, VIEW_H);
      sea.addColorStop(0, pal.seaTop);
      sea.addColorStop(0.5, '#082d58');
      sea.addColorStop(1, pal.seaDeep);
      ctx.fillStyle = sea;
    }
    ctx.fillRect(0, WATERLINE + oy, VIEW_W, VIEW_H - WATERLINE);
  }

  private drawTerrain(world: World, cam: number, oy: number, t: number): void {
    const { ctx } = this;
    const pal = PALETTES[world.terrain.biome];
    const face = ctx.createLinearGradient(0, WATERLINE - 80, 0, VIEW_H);
    face.addColorStop(0, pal.ground);
    face.addColorStop(0.35, pal.ground);
    face.addColorStop(1, pal.groundDark);

    for (const [start, end] of this.landRuns(world)) {
      if ((end + 1) * COL_W - cam < -COL_W || start * COL_W - cam > VIEW_W + COL_W) continue;
      this.traceLand(world, start, end, cam, oy, true);
      ctx.fillStyle = face;
      ctx.fill();

      const texture = world.terrain.biome === 'coast'
        ? this.assets.scenery.ruralWall
        : this.assets.scenery.desertStone;
      if (texture) {
        ctx.save();
        this.traceLand(world, start, end, cam, oy, true);
        ctx.clip();
        ctx.globalAlpha = 0.12 + Math.sin(t * 0.2) * 0.01;
        this.tileTexture(texture, cam, oy);
        ctx.restore();
      }

      this.traceLand(world, start, end, cam, oy, false);
      ctx.strokeStyle = world.terrain.biome === 'inland' ? '#a8bb78' : '#ead49a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const span of world.terrain.lz) {
      const x0 = Math.round(span.x0 - cam);
      const w = span.x1 - span.x0;
      if (x0 + w < 0 || x0 > VIEW_W) continue;
      const y = Math.round(this.surfaceYAt(world, span.x0) + oy);
      ctx.fillStyle = '#d8dde4';
      ctx.fillRect(x0, y - 1, w, 2);
      const concrete = this.assets.scenery.militaryConcrete;
      if (concrete) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.drawImage(concrete, x0, y - 2, w, 3);
        ctx.restore();
      }
      this.text('H', x0 + w / 2, y - 4, 7, '#12233d', true);
    }
  }

  private drawScenery(world: World, cam: number, oy: number): void {
    for (const prop of sceneryForTerrain(world.terrain, world.act)) {
      const x = prop.x - cam;
      if (x < -24 || x > VIEW_W + 24) continue;
      const y = this.surfaceYAt(world, prop.x) + oy;
      this.drawSceneryProp(prop, x, y);
    }
  }

  private drawWater(
    world: World,
    cam: number,
    oy: number,
    t: number,
    tier: QualityTier,
  ): void {
    const { ctx } = this;
    const budget = effectBudget(tier);
    const waterTime = budget.animatedWater ? t : 0;
    if (world.terrain.biome !== 'inland' && budget.reflections) {
      const midY = (WATERLINE + VIEW_H) / 2;
      ctx.fillStyle = 'rgba(159,216,255,0.06)';
      for (let i = 0; i < 4; i++) {
        const rx = wrapX(i * 130, cam, 0.6) + Math.sin(waterTime * 0.3 + i) * 8;
        ctx.beginPath();
        ctx.moveTo(rx, WATERLINE + oy);
        ctx.lineTo(rx + 26, WATERLINE + oy);
        ctx.lineTo(rx + 44, midY + oy);
        ctx.lineTo(rx + 8, midY + oy);
        ctx.fill();
      }

      const glx = wrapX(300, cam, 0.9);
      const glare = ctx.createRadialGradient(
        glx,
        WATERLINE + 6 + oy,
        2,
        glx,
        WATERLINE + 6 + oy,
        60,
      );
      glare.addColorStop(0, 'rgba(255,244,200,0.25)');
      glare.addColorStop(1, 'rgba(255,244,200,0)');
      ctx.fillStyle = glare;
      ctx.fillRect(glx - 60, WATERLINE - 4 + oy, 120, 24);
    }

    const step = budget.animatedWater ? 4 : 8;
    for (let x = 0; x < VIEW_W; x += step) {
      const col = Math.max(0, Math.min(COLS - 1, Math.floor((x + cam) / COL_W)));
      if (!world.terrain.water[col]) continue;
      const h1 = 1 + Math.round(Math.sin((x + cam) * 0.08 + waterTime * 2.5) + 1);
      ctx.fillStyle = '#bfe3ff';
      ctx.fillRect(x, WATERLINE - h1 + oy, step, h1);
      const h2 = Math.round(Math.sin((x + cam) * 0.15 - waterTime * 1.8) + 1);
      if (h2 > 1) {
        ctx.fillStyle = '#f0faff';
        ctx.fillRect(x + 1, WATERLINE - h1 - 1 + oy, Math.max(2, step - 2), 1);
      }
      ctx.fillStyle = '#7db8e8';
      ctx.fillRect(x, WATERLINE + oy, step, 1 + h2);
    }
  }

  private unitAsset(kind: string): LoadedFrameAsset {
    const enemy = this.assets.enemy[kind];
    if (enemy) return enemy;
    const vehicle = this.assets.vehicle[kind];
    if (vehicle) return vehicle;
    throw new Error(`Missing unit asset: ${kind}`);
  }

  private weaponAsset(kind: string): LoadedFrameAsset {
    const asset = this.assets.weapon[kind];
    if (!asset) throw new Error(`Missing weapon asset: ${kind}`);
    return asset;
  }

  private drawAtlas(
    asset: LoadedFrameAsset,
    x: number,
    y: number,
    cam: number,
    oy: number,
    opts: { flip?: boolean; rot?: number; alpha?: number } = {},
  ): void {
    const { ctx } = this;
    const { frame, image } = asset;
    const w = frame.drawW;
    const h = frame.drawH;
    ctx.save();
    ctx.translate(Math.round(x - cam), Math.round(y + oy));
    if (opts.flip) ctx.scale(-1, 1);
    if (opts.rot) ctx.rotate(opts.rot);
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  private drawUnit(kind: string, x: number, y: number, cam: number, oy: number, flip = false): void {
    this.drawAtlas(this.unitAsset(kind), x, y, cam, oy, { flip });
  }

  private maxHpFor(kind: keyof typeof RENDER_MAX_HP): number {
    return RENDER_MAX_HP[kind];
  }

  private drawShadows(world: World, cam: number, oy: number, tier: QualityTier): void {
    const soft = effectBudget(tier).softShadows;
    this.drawAircraftShadow(world, world.player.x, world.player.y, cam, oy, soft);
    for (const s of world.subs) {
      if (!AIR.has(s.kind)) continue;
      this.drawAircraftShadow(world, s.x, s.y + 4, cam, oy, soft);
    }
    for (const p of world.shots) {
      if (p.ptype !== 'sam' && p.ptype !== 'pmissile') continue;
      this.drawProjectileShadow(world, p.x, p.y, cam, oy, soft);
    }
  }

  private drawProjectiles(world: World, cam: number, oy: number): void {
    const { ctx } = this;
    for (const c of world.charges) this.drawAtlas(this.weaponAsset('charge'), c.x, c.y, cam, oy);
    for (const p of world.shots) {
      const velocityAngle = projectileVelocityAngle(p.vx, p.vy);
      const spriteRotation = projectileRotation(p.ptype, p.vx, p.vy);
      const nx = Math.cos(velocityAngle);
      const ny = Math.sin(velocityAngle);
      if (p.ptype === 'bullet' || p.ptype === 'shot' || p.ptype === 'flak') {
        const warm = p.ptype === 'bullet' ? 'rgba(255,242,176,0.45)' : 'rgba(255,162,104,0.38)';
        ctx.strokeStyle = warm;
        ctx.lineWidth = p.ptype === 'bullet' ? 1.25 : 1.75;
        ctx.beginPath();
        ctx.moveTo(Math.round(p.x - cam - nx * 7), Math.round(p.y + oy - ny * 7));
        ctx.lineTo(Math.round(p.x - cam + nx * 3), Math.round(p.y + oy + ny * 3));
        ctx.stroke();
      }
      if (projectileHasTrail(p.ptype)) {
        ctx.strokeStyle = 'rgba(209,234,255,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.round(p.x - cam - nx * 10), Math.round(p.y + oy - ny * 10));
        ctx.lineTo(Math.round(p.x - cam - nx * 2), Math.round(p.y + oy - ny * 2));
        ctx.stroke();
      }
      this.drawAtlas(this.weaponAsset(p.ptype), p.x, p.y, cam, oy, { rot: spriteRotation });
    }
    for (const r of world.rings) {
      this.drawImpactBlast(world, r.x, r.y, r.age, cam, oy);
    }
    ctx.lineWidth = 1;
  }

  private drawImpactBlast(
    world: World,
    x: number,
    y: number,
    age: number,
    cam: number,
    oy: number,
  ): void {
    const { ctx } = this;
    const life = Math.max(0, 1 - age / 0.3);
    const radius = 5 + age * 88;
    const sx = Math.round(x - cam);
    const sy = Math.round(y + oy);
    const water = isWater(world.terrain, x);
    ctx.save();
    ctx.globalAlpha = life;
    if (water) {
      const plume = 5 + life * 13;
      const spray = ctx.createLinearGradient(sx, sy - plume, sx, sy + 3);
      spray.addColorStop(0, 'rgba(244,251,255,0)');
      spray.addColorStop(0.45, 'rgba(220,244,255,0.8)');
      spray.addColorStop(1, 'rgba(104,181,226,0.18)');
      ctx.fillStyle = spray;
      ctx.beginPath();
      ctx.moveTo(sx - radius * 0.16, sy + 2);
      ctx.quadraticCurveTo(sx - radius * 0.05, sy - plume, sx, sy - plume * 1.15);
      ctx.quadraticCurveTo(sx + radius * 0.07, sy - plume, sx + radius * 0.18, sy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(222,246,255,${(life * 0.8).toFixed(2)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 1, radius, Math.max(2, radius * 0.22), 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.strokeStyle = `rgba(112,199,239,${(life * 0.5).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, radius * 0.62, Math.max(1.5, radius * 0.14), 0, 0.1, Math.PI * 0.92);
      ctx.stroke();
    } else {
      const core = ctx.createRadialGradient(sx - 2, sy - 2, 0, sx, sy, Math.max(4, radius * 0.7));
      core.addColorStop(0, 'rgba(255,255,218,0.95)');
      core.addColorStop(0.25, 'rgba(255,190,82,0.9)');
      core.addColorStop(0.7, 'rgba(216,77,32,0.45)');
      core.addColorStop(1, 'rgba(91,49,32,0)');
      ctx.fillStyle = core;
      for (let lobe = 0; lobe < 4; lobe++) {
        const angle = lobe * Math.PI * 0.5 + age * 3;
        ctx.beginPath();
        ctx.ellipse(
          sx + Math.cos(angle) * radius * 0.18,
          sy + Math.sin(angle) * radius * 0.12,
          Math.max(3, radius * (0.38 + (lobe % 2) * 0.08)),
          Math.max(2, radius * 0.28),
          angle * 0.35,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(218,174,112,${(life * 0.58).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy + radius * 0.18, radius, Math.max(2, radius * 0.28), 0, Math.PI * 1.08, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawParticles(world: World, cam: number, oy: number, tier: QualityTier): void {
    const { ctx } = this;
    const budget = effectBudget(tier);

    for (const pt of budgetedParticlesOldestFirst(world.particles, tier)) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(Math.round(pt.x - cam), Math.round(pt.y + oy));
      if (pt.color === '#3a3f46') {
        const smoke = ctx.createRadialGradient(-1, -1, 0, 0, 0, 4 + pt.size);
        smoke.addColorStop(0, 'rgba(91,98,106,0.82)');
        smoke.addColorStop(0.55, 'rgba(58,63,70,0.68)');
        smoke.addColorStop(1, 'rgba(31,37,43,0)');
        ctx.fillStyle = smoke;
        ctx.beginPath();
        ctx.ellipse(0, 0, 4 + pt.size, 3 + pt.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.color === '#9fd8ff' || pt.color === '#cfe8ff') {
        const angle = Math.atan2(pt.vy, pt.vx || 0.001);
        ctx.rotate(angle);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.2 + pt.size * 0.7, 0.7 + pt.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(232,250,255,0.7)';
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.moveTo(-pt.size * 2.5, 0);
        ctx.lineTo(pt.size * 0.5, 0);
        ctx.stroke();
      } else if (pt.maxLife === 0.8) {
        const angle = (pt.id % 17) * 0.31;
        ctx.rotate(angle);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.moveTo(-pt.size * 1.8, -pt.size * 0.55);
        ctx.lineTo(pt.size * 1.7, 0);
        ctx.lineTo(-pt.size * 1.1, pt.size * 0.7);
        ctx.closePath();
        ctx.fill();
      } else {
        const speed = Math.hypot(pt.vx, pt.vy) || 1;
        const nx = pt.vx / speed;
        const ny = pt.vy / speed;
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = Math.max(0.8, pt.size * 0.7);
        ctx.beginPath();
        ctx.moveTo(-nx * pt.size * 3, -ny * pt.size * 3);
        ctx.lineTo(nx * pt.size, ny * pt.size);
        ctx.stroke();
        ctx.fillStyle = '#fff3be';
        ctx.beginPath();
        ctx.arc(nx * pt.size, ny * pt.size, Math.max(0.7, pt.size * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (budget.haze) {
      this.drawRotorWash(world.player.x, world.player.y, world, cam, oy, 'rgba(210,228,236,0.16)');
      for (const s of world.subs) {
        if (AIR.has(s.kind)) this.drawRotorWash(s.x, s.y, world, cam, oy, 'rgba(194,206,214,0.12)');
        if (s.kind === 'tank') this.drawSurfaceWake(s.x - s.dir * 10, s.y + 4, cam, oy, '#cbb288', 0.2);
        if (s.kind === 'gunboat') this.drawSurfaceWake(s.x - 12, WATERLINE + 2, cam, oy, '#d8eeff', 0.24);
      }
    }

    for (const s of world.subs) {
      const maxHp = this.maxHpFor(s.kind as keyof typeof RENDER_MAX_HP);
      if (maxHp <= 1 || s.hp >= maxHp * 0.5) continue;
      const smokeAlpha = 0.18 + (1 - s.hp / maxHp) * 0.2;
      ctx.save();
      ctx.globalAlpha = smokeAlpha;
      ctx.fillStyle = '#4a5057';
      ctx.beginPath();
      ctx.ellipse(Math.round(s.x - cam - s.dir * 5), Math.round(s.y + oy - 8), 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawGrading(world: World, tier: QualityTier): void {
    const { ctx } = this;
    const budget = effectBudget(tier);
    if (budget.haze) {
      const haze = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      haze.addColorStop(0, 'rgba(255,242,208,0.05)');
      haze.addColorStop(0.55, 'rgba(255,255,255,0)');
      haze.addColorStop(1, world.terrain.biome === 'inland' ? 'rgba(186,164,112,0.04)' : 'rgba(94,142,182,0.05)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (budget.reflections && world.terrain.biome !== 'inland') {
      ctx.fillStyle = 'rgba(240,248,255,0.08)';
      ctx.fillRect(0, WATERLINE + 4, VIEW_W, 2);
      ctx.fillStyle = 'rgba(255,244,214,0.05)';
      ctx.fillRect(0, WATERLINE + 10, VIEW_W, 1);
    }
  }

  private drawProjectileShadow(
    world: World,
    x: number,
    y: number,
    cam: number,
    oy: number,
    soft: boolean,
  ): void {
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_W)));
    const surfaceY = world.terrain.water[col] ? WATERLINE : this.surfaceYAt(world, x);
    const style = shadowStyle(surfaceY - y);
    const { ctx } = this;
    ctx.save();
    ctx.translate(Math.round(x - cam), Math.round(surfaceY + oy + 1));
    ctx.scale(style.scale * 0.45, style.scale * 0.45);
    if (soft) ctx.filter = `blur(${Math.max(0.4, style.blur * 0.6)}px)`;
    ctx.fillStyle = `rgba(5, 12, 18, ${style.alpha * (soft ? 0.8 : 0.55)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRotorWash(x: number, y: number, world: World, cam: number, oy: number, color: string): void {
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_W)));
    const surfaceY = world.terrain.water[col] ? WATERLINE : this.surfaceYAt(world, x);
    const alt = surfaceY - y;
    if (alt < 8 || alt > 40) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 1 - alt / 48;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(Math.round(x - cam), Math.round(surfaceY + oy + 1), 14, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSurfaceWake(
    x: number,
    y: number,
    cam: number,
    oy: number,
    color: string,
    alpha: number,
  ): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(Math.round(x - cam), Math.round(y + oy), 8, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private landRuns(world: World): [number, number][] {
    const runs: [number, number][] = [];
    let start = -1;
    for (let col = 0; col <= world.terrain.surface.length; col++) {
      const land = col < world.terrain.surface.length && !world.terrain.water[col];
      if (land && start < 0) start = col;
      if (!land && start >= 0) {
        runs.push([start, col - 1]);
        start = -1;
      }
    }
    return runs;
  }

  private traceLand(
    world: World,
    start: number,
    end: number,
    cam: number,
    oy: number,
    closeFace: boolean,
  ): void {
    const { ctx } = this;
    const surface = world.terrain.surface;
    const yAt = (col: number) => surface[Math.max(start, Math.min(end, col))] + oy;
    const xAt = (col: number) => col * COL_W + COL_W / 2 - cam;
    ctx.beginPath();
    ctx.moveTo(start * COL_W - cam, yAt(start));
    ctx.lineTo(xAt(start), yAt(start));
    for (let col = start; col < end; col++) {
      const y0 = yAt(col - 1);
      const y1 = yAt(col);
      const y2 = yAt(col + 1);
      const y3 = yAt(col + 2);
      const low = Math.min(y1, y2);
      const high = Math.max(y1, y2);
      const c1y = Math.max(low, Math.min(high, y1 + (y2 - y0) / 6));
      const c2y = Math.max(low, Math.min(high, y2 - (y3 - y1) / 6));
      ctx.bezierCurveTo(
        xAt(col) + COL_W / 3,
        c1y,
        xAt(col + 1) - COL_W / 3,
        c2y,
        xAt(col + 1),
        y2,
      );
    }
    ctx.lineTo((end + 1) * COL_W - cam, yAt(end));
    if (closeFace) {
      ctx.lineTo((end + 1) * COL_W - cam, VIEW_H);
      ctx.lineTo(start * COL_W - cam, VIEW_H);
      ctx.closePath();
    }
  }

  private tileTexture(image: CanvasImageSource, cam: number, oy: number): void {
    const size = 128;
    const offsetX = -((cam % size) + size) % size;
    const offsetY = ((oy % size) + size) % size - size;
    for (let x = offsetX - size; x < VIEW_W + size; x += size) {
      for (let y = offsetY; y < VIEW_H + size; y += size) {
        this.ctx.drawImage(image, x, y, size, size);
      }
    }
  }

  private drawSceneryProp(prop: SceneryProp, x: number, y: number): void {
    const { ctx } = this;
    const scale = prop.scale;
    if (prop.kind === 'scrub') {
      ctx.strokeStyle = '#3f4f2c';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 7 * scale);
      ctx.moveTo(x, y - 4 * scale);
      ctx.lineTo(x - 4 * scale, y - 8 * scale);
      ctx.moveTo(x, y - 5 * scale);
      ctx.lineTo(x + 4 * scale, y - 9 * scale);
      ctx.stroke();
      ctx.fillStyle = '#738450';
      ctx.beginPath();
      ctx.ellipse(x - 3 * scale, y - 8 * scale, 4 * scale, 2.5 * scale, -0.3, 0, Math.PI * 2);
      ctx.ellipse(x + 3 * scale, y - 9 * scale, 4.5 * scale, 2.5 * scale, 0.3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const rural = prop.kind === 'rural';
    const desert = prop.kind === 'desert';
    const military = prop.kind === 'military';
    const w = (rural ? 12 : desert || military ? 13 : 11) * scale;
    const h = (rural ? 8 : desert || military ? 6 : 5) * scale;
    const texture = rural ? this.assets.scenery.ruralWall
      : military ? this.assets.scenery.militaryConcrete
        : this.assets.scenery.desertStone;

    ctx.save();
    ctx.beginPath();
    if (rural) {
      ctx.rect(x - w / 2, y - h, w, h);
    } else if (desert || military) {
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x - w * 0.42, y - h);
      ctx.lineTo(x + w * 0.35, y - h);
      ctx.lineTo(x + w / 2, y);
      ctx.closePath();
    } else {
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x - w * 0.35, y - h * 0.7);
      ctx.lineTo(x - w * 0.08, y - h);
      ctx.lineTo(x + w * 0.32, y - h * 0.75);
      ctx.lineTo(x + w / 2, y);
      ctx.closePath();
    }
    ctx.fillStyle = rural ? '#ad9a78' : military ? '#777b72' : '#9c855c';
    ctx.fill();
    if (texture) {
      ctx.clip();
      ctx.globalAlpha = 0.65;
      ctx.drawImage(texture, x - w / 2, y - h, w, h);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(37,35,28,0.7)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
    if (rural) {
      ctx.fillStyle = '#6d513d';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.6, y - h);
      ctx.lineTo(x, y - h - 4 * scale);
      ctx.lineTo(x + w * 0.6, y - h);
      ctx.closePath();
      ctx.fill();
    }
  }

  private text(
    s: string,
    x: number,
    y: number,
    size = 8,
    col = '#e8f2ff',
    center = false,
    ctx: CanvasRenderingContext2D = this.ctx,
  ): void {
    ctx.fillStyle = col;
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.textAlign = center ? 'center' : 'left';
    ctx.fillText(s, x, y);
  }

  private drawScreenUi(
    world: World,
    phase: Phase,
    touchUI: boolean,
    layout: UiLayout,
    audioSettings?: AudioSettingsView,
    progressionView?: ProgressionRenderView,
  ): void {
    // Canvas width/height changes reset its context state. Reassert the
    // CSS-space transform every frame so responsive overlays cannot render at
    // backing-store scale after a DPR or viewport transition.
    this.uiCtx.setTransform(
      this.uiCtx.canvas.width / Math.max(1, layout.viewport.w),
      0,
      0,
      this.uiCtx.canvas.height / Math.max(1, layout.viewport.h),
      0,
      0,
    );
    this.uiCtx.clearRect(0, 0, layout.viewport.w, layout.viewport.h);
    if (phase === 'results') {
      if (progressionView?.results && progressionView.layout) {
        this.results(progressionView.results, progressionView.layout);
      }
      return;
    }
    if (phase === 'upgrade') {
      if (progressionView?.tree && progressionView.layout) {
        this.upgradeTree(progressionView.tree, progressionView.layout);
      }
      return;
    }
    if (phase === 'menu') {
      if (audioSettings) this.audioPanel(layout, audioSettings, audioSettings.settingsCollapsed);
      return;
    }
    if (phase === 'gameover') return;
    this.hud(world, layout, progressionView?.points);
    if (touchUI && phase === 'playing') this.touchOverlay(layout);
  }

  private audioPanel(layout: UiLayout, view: AudioSettingsView, collapsed: boolean): void {
    const ctx = this.uiCtx;
    const panel = layout.audio.panel;
    ctx.fillStyle = 'rgba(4, 10, 20, 0.9)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeStyle = '#9fd8ff';
    ctx.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.w - 1, panel.h - 1);

    if (!collapsed) {
      this.drawAudioSlider('MUSIC', layout.audio.music, view.music);
      this.drawAudioSlider('SFX', layout.audio.sfx, view.sfx);
      for (const [rect, label, active] of [
        [layout.audio.mute, view.muted ? 'UNMUTE [M]' : 'MUTE [M]', view.muted],
        [layout.audio.credits, view.creditsOpen ? 'CLOSE CREDITS' : 'CREDITS [C]', view.creditsOpen],
      ] as const) {
        ctx.fillStyle = active ? '#765b25' : '#12233d';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = '#9fd8ff';
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        this.text(label, rect.x + rect.w / 2, rect.y + 24, 12, '#e8f2ff', true, ctx);
      }
      if (view.creditsOpen) {
        ctx.fillStyle = 'rgba(4, 10, 20, 0.97)';
        ctx.fillRect(panel.x + 8, panel.y + 8, panel.w - 16, panel.h - 88);
        AUDIO_CREDIT_LINES.forEach((line, index) =>
          this.text(line, panel.x + panel.w / 2, panel.y + 28 + index * 20, 11, '#e8f2ff', true, ctx));
      }
    }

    // Bottom row: toggle and start buttons always visible
    for (const [rect, label, primary] of [
      [layout.audio.toggle, collapsed ? 'SETTINGS ▸' : 'SETTINGS ▾', false],
      [layout.audio.start, 'START GAME', true],
    ] as const) {
      ctx.fillStyle = primary ? '#765b25' : '#12233d';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = primary ? '#ffd866' : '#9fd8ff';
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      this.text(label, rect.x + rect.w / 2, rect.y + 24, 12, primary ? '#fff2c6' : '#e8f2ff', true, ctx);
    }
  }

  private drawAudioSlider(label: string, track: { x: number; y: number; w: number; h: number }, value: number): void {
    const ctx = this.uiCtx;
    this.text(label, track.x - 40, track.y + 20, 11, '#e8f2ff', true, ctx);
    const y = track.y + track.h / 2 - 4;
    ctx.fillStyle = '#26364d';
    ctx.fillRect(track.x, y, track.w, 8);
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(track.x, y, track.w * value, 8);
    ctx.fillStyle = '#ffd866';
    ctx.beginPath();
    ctx.arc(track.x + track.w * value, y + 4, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  private hud(world: World, layout: UiLayout, perkPoints?: number): void {
    const ctx = this.uiCtx;
    const { x, y, w, h, fontSize } = layout.hud;
    ctx.fillStyle = '#000a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#42212a';
    ctx.fillRect(x + 12, y + 16, 120, 10);
    ctx.fillStyle = '#e04848';
    ctx.fillRect(x + 12, y + 16, Math.max(0, 120 * world.player.hp / world.stats.maxHp), 10);
    for (let i = 0; i < world.stats.maxCharges; i++) {
      ctx.fillStyle = i < world.stats.maxCharges - world.charges.length ? '#ffd866' : '#444';
      ctx.fillRect(x + 12 + i * 14, y + 38, 10, 12);
    }
    if (world.stats.missileCap > 0) {
      for (let i = 0; i < world.stats.missileCap; i++) {
        ctx.fillStyle = i < world.missileStock ? '#8ad0ff' : '#444';
        ctx.fillRect(x + 116 + i * 10, y + 38, 6, 12);
      }
    }
    ctx.fillStyle = '#e8f2ff';
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`ACT ${world.act} · ${world.waveInAct >= 4 ? 'FINALE' : 'WAVE ' + world.waveInAct}`, x + 12, y + h - 8);
    ctx.textAlign = 'right';
    ctx.fillText(`${world.score}`, x + w - 12, y + 25);
    if (perkPoints !== undefined) {
      ctx.fillText(perkPointHudText(perkPoints), x + w - 12, y + h - 8);
    }
    ctx.textAlign = 'left';
  }

  private touchOverlay(layout: UiLayout): void {
    const ctx = this.uiCtx;
    const fill = `rgba(4, 13, 24, ${(layout.controlOpacity * 0.62).toFixed(2)})`;
    const stroke = `rgba(232,242,255,${layout.controlOpacity.toFixed(2)})`;
    const label = `rgba(232,242,255,${Math.min(0.82, layout.controlOpacity + 0.22).toFixed(2)})`;

    const buttons: [string, UiCircle][] = [
      ['MISSILE', layout.missile],
      ['DROP', layout.drop],
    ];
    for (const [key, btn] of buttons) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      ctx.stroke();
      this.text(key, btn.x, btn.y + 5, key.length > 4 ? 11 : 14, label, true, ctx);
    }

    this.drawJoystick(layout.move, this.touchVisualState.steer, 'MOVE', fill, stroke, label);
    this.drawJoystick(layout.aim, this.touchVisualState.aim, 'AIM', fill, stroke, label);
  }

  private drawJoystick(
    baseCircle: UiCircle,
    pointer: { ox: number; oy: number; dx: number; dy: number } | null,
    labelKey: string,
    fill: string,
    stroke: string,
    label: string,
  ): void {
    const ctx = this.uiCtx;
    const base = pointer
      ? { x: pointer.ox, y: pointer.oy, r: baseCircle.r }
      : baseCircle;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(base.x, base.y, base.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(base.x, base.y, base.r, 0, Math.PI * 2);
    ctx.stroke();
    if (pointer) {
      const len = Math.hypot(pointer.dx, pointer.dy);
      const cap = len > base.r ? base.r / len : 1;
      ctx.fillStyle = `rgba(232,242,255,${Math.min(0.9, labelKey === 'AIM' ? 0.7 : 0.3).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(base.x + pointer.dx * cap, base.y + pointer.dy * cap, base.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else {
      this.text(labelKey, base.x, base.y + 5, 14, label, true, ctx);
    }
  }

  private damageFlash(world: World, reducedFlash: boolean, debugDamageFlash: boolean): void {
    const pulse = debugDamageFlash ? 1 : Math.max(0, Math.min(1, (world.player.iframes - 0.55) / 0.25));
    if (pulse <= 0) return;
    const { ctx } = this;
    ctx.save();
    ctx.scale(1 / RENDER_SCALE, 1 / RENDER_SCALE);
    if (damageFlashMode(reducedFlash) === 'border') {
      ctx.strokeStyle = `rgba(255, 196, 120, ${(pulse * 0.8).toFixed(2)})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, RENDER_W - 8, RENDER_H - 8);
    } else {
      ctx.fillStyle = `rgba(255, 240, 204, ${(pulse * 0.22).toFixed(2)})`;
      ctx.fillRect(0, 0, RENDER_W, RENDER_H);
    }
    ctx.restore();
  }

  private overlay(): void {
    this.ctx.fillStyle = 'rgba(4,10,20,0.75)';
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private menu(): void {
    this.overlay();
    // Title
    this.text('SEA BOMBER', VIEW_W / 2, 50, 24, '#ffd866', true);
    this.text('depth-charge the subs · dodge everything', VIEW_W / 2, 72, 8, '#9fd8ff', true);

    // How to Play section - compact, centered
    this.text('HOW TO PLAY', VIEW_W / 2, 95, 12, '#ffd866', true);
    const instrY = 112;
    const instrGap = 14;
    this.text('MOVE: WASD / arrows / left stick', VIEW_W / 2, instrY, 8, '#e8f2ff', true);
    this.text('AIM: mouse / right stick', VIEW_W / 2, instrY + instrGap, 8, '#e8f2ff', true);
    this.text('DROP: SPACE / right button / A button', VIEW_W / 2, instrY + instrGap * 2, 8, '#e8f2ff', true);
    this.text('MISSILES: E / left button / X button', VIEW_W / 2, instrY + instrGap * 3, 8, '#e8f2ff', true);
    this.text('FIRE: click / F / right trigger', VIEW_W / 2, instrY + instrGap * 4, 8, '#e8f2ff', true);
  }

  results(view: PostWaveView, layout: UpgradeLayout): void {
    const ctx = this.uiCtx;
    const { panel, resultsContinueButton: button } = layout;
    ctx.fillStyle = 'rgba(4,10,20,0.94)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(panel.x + 1, panel.y + 1, panel.w - 2, panel.h - 2);

    const center = panel.x + panel.w / 2;
    const compact = panel.h < 430;
    const titleSize = compact ? 20 : 26;
    const bodySize = compact ? 13 : 16;
    const lineHeight = compact ? 24 : 31;
    let y = panel.y + (compact ? 38 : 54);
    this.text('WAVE RESULTS', center, y, titleSize, '#ffd866', true, ctx);
    y += lineHeight * 1.35;
    for (const line of [
      `COMBAT SCORE ${view.rating.score}/40`,
      `DEPTH-CHARGE ACCURACY ${view.rating.accuracy}/30`,
      `SURVIVAL ${view.rating.survival}/30`,
      `TOTAL ${view.rating.total}/100`,
    ]) {
      this.text(line, center, y, bodySize, '#e8f2ff', true, ctx);
      y += lineHeight;
    }
    y += compact ? 2 : 8;
    this.text(`BASE POINT +${view.award.base}`, center, y, bodySize, '#9fd8ff', true, ctx);
    y += lineHeight;
    this.text(`RATING BONUS +${view.award.bonus}`, center, y, bodySize, '#9fd8ff', true, ctx);
    y += lineHeight;
    this.text(`PERK POINTS ${view.balance}`, center, y, bodySize + 1, '#ffd866', true, ctx);

    ctx.fillStyle = '#765b25';
    ctx.fillRect(button.x, button.y, button.w, button.h);
    ctx.strokeStyle = '#ffd866';
    ctx.strokeRect(button.x + 0.5, button.y + 0.5, button.w - 1, button.h - 1);
    this.text('CONTINUE', button.x + button.w / 2, button.y + button.h / 2 + bodySize * 0.36, bodySize, '#fff2c6', true, ctx);
  }

  upgradeTree(view: UpgradeTreeView, layout: UpgradeLayout): void {
    const ctx = this.uiCtx;
    const { panel } = layout;
    ctx.fillStyle = 'rgba(4,10,20,0.96)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(panel.x + 1, panel.y + 1, panel.w - 2, panel.h - 2);

    const branches = ['weapons', 'ordnance', 'defense', 'flight'] as const;
    branches.forEach((branch, index) => {
      const tab = layout.tabs[index];
      const selected = branch === view.branch;
      ctx.fillStyle = selected ? '#765b25' : '#12233d';
      ctx.fillRect(tab.x, tab.y, tab.w, tab.h);
      ctx.strokeStyle = selected ? '#ffd866' : '#526b88';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(tab.x + 0.5, tab.y + 0.5, tab.w - 1, tab.h - 1);
      const tabSize = tab.w < 100 ? 10 : 13;
      this.text(branch.toUpperCase(), tab.x + tab.w / 2, tab.y + tab.h / 2 + tabSize * 0.35, tabSize, selected ? '#fff2c6' : '#9fd8ff', true, ctx);
    });

    const rectById = new Map(layout.nodes.map(item => [item.node.id, item.rect]));
    ctx.strokeStyle = '#526b88';
    ctx.lineWidth = 2;
    for (const node of view.nodes) {
      const rect = rectById.get(node.id);
      if (!rect) continue;
      for (const required of node.requires) {
        const from = rectById.get(required);
        if (!from) continue;
        ctx.beginPath();
        ctx.moveTo(from.x + from.w / 2, from.y + from.h);
        ctx.lineTo(rect.x + rect.w / 2, rect.y);
        ctx.stroke();
      }
    }

    const fills = {
      purchased: '#244837',
      pending: '#164e67',
      affordable: '#253f5e',
      locked: '#171f2b',
    } as const;
    const strokes = {
      purchased: '#72d29b',
      pending: '#67d8ff',
      affordable: '#ffd866',
      locked: '#52606f',
    } as const;
    if (layout.detail) {
      ctx.fillStyle = '#0c1726';
      ctx.fillRect(layout.detail.x, layout.detail.y, layout.detail.w, layout.detail.h);
      ctx.strokeStyle = '#526b88';
      ctx.lineWidth = 1;
      ctx.strokeRect(layout.detail.x + 0.5, layout.detail.y + 0.5, layout.detail.w - 1, layout.detail.h - 1);
    }
    let focusedDetail: { node: UpgradeNodeView; region: UpgradeTextRegionPlan } | undefined;
    for (const node of view.nodes) {
      const rect = rectById.get(node.id);
      if (!rect) continue;
      ctx.fillStyle = fills[node.state];
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = node.focused ? '#fff2c6' : strokes[node.state];
      ctx.lineWidth = node.focused ? 3 : 1.5;
      ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
      const plan = buildUpgradeNodeRenderPlan(node, rect, layout.detail, (text, fontSize) => {
        ctx.font = `${fontSize}px system-ui, sans-serif`;
        return ctx.measureText(text).width;
      });
      this.drawUpgradeTextRegion(plan.card, node, strokes[node.state]);
      if (plan.detail) focusedDetail = { node, region: plan.detail };
    }
    if (focusedDetail) {
      this.drawUpgradeTextRegion(
        focusedDetail.region,
        focusedDetail.node,
        strokes[focusedDetail.node.state],
      );
    }

    const footerSize = layout.footer.fontSize;
    const footerY = layout.footer.baseline;
    this.text('Select pending upgrade again to refund', panel.x + 18, footerY, footerSize, '#9fd8ff', false, ctx);
    this.rightText(`PERK POINTS ${view.points}`, panel.x + panel.w - 18, footerY, footerSize, '#ffd866');

    const button = layout.continueButton;
    ctx.fillStyle = '#765b25';
    ctx.fillRect(button.x, button.y, button.w, button.h);
    ctx.strokeStyle = '#ffd866';
    ctx.lineWidth = 2;
    ctx.strokeRect(button.x + 0.5, button.y + 0.5, button.w - 1, button.h - 1);
    this.text('START NEXT WAVE', button.x + button.w / 2, button.y + button.h / 2 + footerSize * 0.38, footerSize + 1, '#fff2c6', true, ctx);
  }

  private rightText(s: string, x: number, y: number, size: number, color: string): void {
    const ctx = this.uiCtx;
    ctx.fillStyle = color;
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }

  private drawUpgradeTextRegion(
    region: UpgradeTextRegionPlan,
    node: UpgradeNodeView,
    stateColor: string,
  ): void {
    const ctx = this.uiCtx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(region.rect.x, region.rect.y, region.rect.w, region.rect.h);
    ctx.clip();
    for (const line of region.lines) {
      ctx.fillStyle = line.role === 'cost'
        ? '#ffd866'
        : line.role === 'description'
          ? '#9fd8ff'
          : line.role === 'status'
            ? node.state === 'locked' ? '#aeb8c5' : stateColor
            : '#e8f2ff';
      ctx.font = `${line.fontSize}px system-ui, sans-serif`;
      ctx.textAlign = line.align;
      ctx.fillText(line.text, line.x, line.baseline);
    }
    ctx.restore();
    ctx.textAlign = 'left';
  }

  private gameover(world: World): void {
    this.overlay();
    const acc = world.drops > 0 ? Math.round(100 * world.hitDrops / world.drops) : 0;
    this.text('CHOPPER DOWN', VIEW_W / 2, 90, 20, '#e04848', true);
    this.text(`wave ${world.wave} · score ${world.score}`, VIEW_W / 2, 120, 10, '#e8f2ff', true);
    this.text(`kills ${world.kills} · drop accuracy ${acc}%`, VIEW_W / 2, 138, 8, '#9fd8ff', true);
    this.text('press ENTER or tap for menu', VIEW_W / 2, 175, 10, '#ffd866', true);
  }

  private surfaceYAt(world: World, x: number): number {
    return world.terrain.surface[Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_W)))];
  }

  private drawAircraftShadow(
    world: World,
    x: number,
    y: number,
    cam: number,
    oy: number,
    soft: boolean,
  ): void {
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_W)));
    const surfaceY = world.terrain.water[col] ? WATERLINE : this.surfaceYAt(world, x);
    const style = shadowStyle(surfaceY - y);
    const { ctx } = this;
    ctx.save();
    ctx.translate(Math.round(x - cam), Math.round(surfaceY + oy + 1));
    ctx.scale(style.scale, style.scale);
    if (soft) ctx.filter = `blur(${style.blur}px)`;
    ctx.fillStyle = `rgba(5, 12, 18, ${style.alpha * (soft ? 1 : 0.72)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayerTurret(
    x: number,
    y: number,
    angle: number,
    muzzleT: number,
    cam: number,
    oy: number,
  ): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(Math.round(x - cam), Math.round(y + oy + 4));
    ctx.rotate(angle);
    const housing = ctx.createLinearGradient(-2, -3, 3, 3);
    housing.addColorStop(0, '#89957a');
    housing.addColorStop(0.5, '#46503f');
    housing.addColorStop(1, '#1d2622');
    ctx.fillStyle = housing;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#121a19';
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(9, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(196,214,188,0.7)';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(1, -0.65);
    ctx.lineTo(8.5, -0.65);
    ctx.stroke();
    if (muzzleT > 0) {
      const flash = ctx.createRadialGradient(10, 0, 0, 10, 0, 7);
      flash.addColorStop(0, 'rgba(255,255,220,1)');
      flash.addColorStop(0.32, 'rgba(255,202,100,0.92)');
      flash.addColorStop(1, 'rgba(255,117,50,0)');
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(10, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlayerRotor(x: number, y: number, cam: number, oy: number, t: number): void {
    const { ctx } = this;
    const sweep = 20 + Math.sin(t * 38) * 2;
    ctx.save();
    ctx.translate(Math.round(x - cam), Math.round(y + oy - 11));
    ctx.strokeStyle = 'rgba(230, 238, 242, 0.58)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, sweep, 1.25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 136, 145, 0.45)';
    ctx.beginPath();
    ctx.moveTo(-sweep - 4, 0);
    ctx.lineTo(sweep + 4, 0);
    ctx.stroke();
    ctx.restore();
  }

  private actIntro(world: World): void {
    this.overlay();
    this.text(actTitle(world.act), VIEW_W / 2, 125, 16, '#ffd866', true);
    this.text('get ready', VIEW_W / 2, 150, 8, '#9fd8ff', true);
  }
}
