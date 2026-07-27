import { VIEW_W, VIEW_H, WATERLINE } from '../game/consts';
import type { World } from '../game/world';
import type { Phase } from '../game/state';
import type { UpgradeCard } from '../game/upgrades';
import { touchButtons } from '../core/input';
import type { Sheet } from './sprites';
import { PALETTES, actTitle } from '../game/biomes';
import { COL_W, COLS } from '../game/terrain';
import { AIR, GROUND } from '../game/waves';
import type { LoadedAssets } from './assets';
import { helicopterPose, shadowStyle, type HelicopterPose } from './helicopter';
import { sceneryForTerrain, type SceneryProp } from './scenery';

export function cardRect(i: number): { x: number; y: number; w: number; h: number } {
  return { x: 40 + i * 140, y: 80, w: 120, h: 110 };
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

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private sheet: Sheet,
    private assets: LoadedAssets,
  ) {
    ctx.imageSmoothingEnabled = false;
  }

  draw(world: World, phase: Phase, cards: UpgradeCard[], t: number, touchUI: boolean): void {
    const { ctx } = this;
    const shx = world.shake ? (Math.random() * 2 - 1) * world.shake : 0;
    const shy = world.shake ? (Math.random() * 2 - 1) * world.shake : 0;
    const cam = world.camX + shx;
    const oy = shy; // vertical shake offset for world-space drawing
    this.drawBackground(world, cam, oy, t);
    this.drawTerrain(world, cam, oy, t);
    this.drawScenery(world, cam, oy);
    this.drawWater(world, cam, oy, t);

    // --- entities (world space) ---
    const dr = (frame: string, x: number, y: number, flip = false, rot = 0) => {
      const f = this.sheet.frames[frame];
      ctx.save();
      ctx.translate(Math.round(x - cam), Math.round(y + oy));
      if (flip) ctx.scale(-1, 1);
      if (rot) ctx.rotate(rot);
      ctx.drawImage(this.sheet.canvas, f.x, f.y, f.w, f.h, -f.w / 2, -f.h / 2, f.w, f.h);
      ctx.restore();
    };

    for (const s of world.subs) {
      if (s.kind === 'mine') {
        const bob = Math.sin(t * 2 + s.id) * 1.5;
        dr('mine', s.x, s.y + bob);
        if (Math.floor(t * 3) % 2 === 0) {
          ctx.fillStyle = '#ff8877';
          ctx.fillRect(Math.round(s.x - cam) - 1, Math.round(s.y + bob + oy) - 1, 2, 2);
        }
      } else {
        dr(s.kind, s.x, s.y, s.dir < 0);
        if (s.hitFlash > 0) {
          const f = this.sheet.frames[s.kind];
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(s.x - cam - f.w / 2), Math.round(s.y + oy - f.h / 2), f.w, f.h);
          ctx.globalAlpha = 1;
        }
      }
      if (world.sonarTimer > 0 && s.kind !== 'gunboat' && !AIR.has(s.kind) && !GROUND.has(s.kind)) {
        ctx.strokeStyle = 'rgba(120,255,160,0.8)';
        ctx.strokeRect(Math.round(s.x - cam) - 14, Math.round(s.y + oy) - 8, 28, 16);
      }
    }
    for (const c of world.charges) dr('charge', c.x, c.y);
    for (const p of world.shots) {
      if (p.ptype === 'bullet') {
        const nx = p.vx / 300, ny = p.vy / 300;
        ctx.fillStyle = 'rgba(255,236,150,0.35)';
        ctx.fillRect(Math.round(p.x - cam - nx * 6), Math.round(p.y + oy - ny * 6), 2, 2);
        ctx.fillStyle = '#ffe9a0';
        ctx.fillRect(Math.round(p.x - cam - nx * 3), Math.round(p.y + oy - ny * 3), 2, 2);
        ctx.fillStyle = '#fff8d8';
        ctx.fillRect(Math.round(p.x - cam), Math.round(p.y + oy), 2, 2);
      } else if (p.ptype === 'shot') {
        ctx.fillStyle = '#ff9a66';
        ctx.fillRect(Math.round(p.x - cam) - 1, Math.round(p.y + oy) - 1, 3, 2);
      } else {
        const rot = Math.atan2(p.vy, p.vx);
        dr(p.ptype === 'sam' ? 'sam' : p.ptype === 'pmissile' ? 'pmissile' : 'torpedo',
          p.x, p.y, false, p.ptype === 'sam' ? rot + Math.PI / 2 : rot);
      }
    }
    // blast shockwave rings
    for (const r of world.rings) {
      const a = 1 - r.age / 0.3;
      ctx.strokeStyle = `rgba(255,240,200,${(a * 0.8).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(Math.round(r.x - cam), Math.round(r.y + oy), 6 + r.age * 90, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    // painted player body with procedural rotor, turret, and altitude shadow
    const pl = world.player;
    this.drawAircraftShadow(world, pl.x, pl.y, cam, oy);
    if (pl.iframes <= 0 || Math.floor(t * 12) % 2 === 0) {
      const pose = helicopterPose(pl.vx, pl.vy, pl.facing);
      const frameX = HELICOPTER_POSES.indexOf(pose) * 192;
      this.drawPlayerRotor(pl.x, pl.y, cam, oy, t);
      ctx.save();
      ctx.translate(Math.round(pl.x - cam), Math.round(pl.y + oy));
      ctx.scale(pl.facing, 1);
      ctx.drawImage(this.assets.player.heli, frameX, 0, 192, 96, -48, -24, 96, 48);
      ctx.restore();
      // chin turret (aims independently of body flip)
      const tf = this.sheet.frames.turret;
      ctx.save();
      ctx.translate(Math.round(pl.x - cam), Math.round(pl.y + oy + 4));
      ctx.rotate(pl.turretAngle);
      ctx.drawImage(this.sheet.canvas, tf.x, tf.y, tf.w, tf.h, -2, -2, tf.w, tf.h);
      if (pl.muzzleT > 0) {
        ctx.fillStyle = '#fff6c0';
        ctx.fillRect(6, -2, 4, 4);
      }
      ctx.restore();
    }
    // particles
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x - cam), Math.round(pt.y + oy), pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    this.hud(world);
    if (touchUI && phase === 'playing') this.touchOverlay();
    if (phase === 'menu') this.menu();
    if (phase === 'upgrade') this.upgrade(cards);
    if (phase === 'actIntro') this.actIntro(world);
    if (phase === 'gameover') this.gameover(world);
  }

  private drawBackground(world: World, cam: number, oy: number, t: number): void {
    const { ctx } = this;
    const pal = PALETTES[world.terrain.biome];
    const sky = ctx.createLinearGradient(0, 0, 0, WATERLINE);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (const cl of CLOUDS_FAR) {
      const x = wrapX(cl.x, cam, 0.15);
      const drift = Math.sin(t * 0.08 + cl.x) * 0.4;
      ctx.fillRect(x, cl.y + oy * 0.3 + drift, cl.w, 4);
      ctx.fillRect(x + 8, cl.y - 2 + oy * 0.3 + drift, cl.w - 16, 2);
    }

    ctx.fillStyle = 'rgba(230,240,255,0.25)';
    ctx.fillRect(0, WATERLINE - 22 + oy, VIEW_W, 22);

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const cl of CLOUDS_NEAR) {
      const x = wrapX(cl.x, cam, 0.4);
      const drift = Math.sin(t * 0.12 + cl.y) * 0.6;
      ctx.fillRect(x, cl.y + oy * 0.6 + drift, cl.w, 5);
      ctx.fillRect(x + 6, cl.y - 3 + oy * 0.6 + drift, cl.w - 12, 3);
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

  private drawWater(world: World, cam: number, oy: number, t: number): void {
    const { ctx } = this;
    if (world.terrain.biome !== 'inland') {
      const midY = (WATERLINE + VIEW_H) / 2;
      ctx.fillStyle = 'rgba(159,216,255,0.06)';
      for (let i = 0; i < 4; i++) {
        const rx = wrapX(i * 130, cam, 0.6) + Math.sin(t * 0.3 + i) * 8;
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

    for (let x = 0; x < VIEW_W; x += 4) {
      const col = Math.max(0, Math.min(COLS - 1, Math.floor((x + cam) / COL_W)));
      if (!world.terrain.water[col]) continue;
      const h1 = 1 + Math.round(Math.sin((x + cam) * 0.08 + t * 2.5) + 1);
      ctx.fillStyle = '#bfe3ff';
      ctx.fillRect(x, WATERLINE - h1 + oy, 4, h1);
      const h2 = Math.round(Math.sin((x + cam) * 0.15 - t * 1.8) + 1);
      if (h2 > 1) {
        ctx.fillStyle = '#f0faff';
        ctx.fillRect(x + 1, WATERLINE - h1 - 1 + oy, 2, 1);
      }
      ctx.fillStyle = '#7db8e8';
      ctx.fillRect(x, WATERLINE + oy, 4, 1 + h2);
    }
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

  private text(s: string, x: number, y: number, size = 8, col = '#e8f2ff', center = false): void {
    const { ctx } = this;
    ctx.fillStyle = col;
    ctx.font = `${size}px monospace`;
    ctx.textAlign = center ? 'center' : 'left';
    ctx.fillText(s, x, y);
  }

  private hud(world: World): void {
    const { ctx } = this;
    ctx.fillStyle = '#000a';
    ctx.fillRect(4, 4, 84, 22);
    ctx.fillStyle = '#42212a';
    ctx.fillRect(8, 8, 60, 5);
    ctx.fillStyle = '#e04848';
    ctx.fillRect(8, 8, Math.max(0, 60 * world.player.hp / world.stats.maxHp), 5);
    for (let i = 0; i < world.stats.maxCharges; i++) {
      ctx.fillStyle = i < world.stats.maxCharges - world.charges.length ? '#ffd866' : '#444';
      ctx.fillRect(8 + i * 7, 17, 5, 6);
    }
    if (world.stats.missileCap > 0) {
      for (let i = 0; i < world.stats.missileCap; i++) {
        ctx.fillStyle = i < world.missileStock ? '#8ad0ff' : '#444';
        ctx.fillRect(60 + i * 5, 17, 3, 6);
      }
    }
    ctx.fillStyle = '#e8f2ff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`ACT ${world.act} · ${world.waveInAct >= 4 ? 'FINALE' : 'WAVE ' + world.waveInAct}`, VIEW_W - 8, 12);
    ctx.fillText(`${world.score}`, VIEW_W - 8, 22);
    ctx.textAlign = 'left';
  }

  private touchOverlay(): void {
    const { ctx } = this;
    const b = touchButtons();
    for (const [key, btn] of Object.entries(b) as ['fire' | 'drop', { x: number; y: number; r: number }][]) {
      ctx.strokeStyle = 'rgba(232,242,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      ctx.stroke();
      this.text(key === 'fire' ? 'FIRE' : 'DROP', btn.x, btn.y + 3, 7, 'rgba(232,242,255,0.7)', true);
    }
  }

  private overlay(): void {
    this.ctx.fillStyle = 'rgba(4,10,20,0.75)';
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private menu(): void {
    this.overlay();
    this.text('SEA BOMBER', VIEW_W / 2, 100, 24, '#ffd866', true);
    this.text('depth-charge the subs · dodge everything', VIEW_W / 2, 125, 8, '#9fd8ff', true);
    this.text('WASD/arrows move · SPACE drop · aim with mouse · click/F fire', VIEW_W / 2, 150, 8, '#e8f2ff', true);
    this.text('touch: left stick move · right stick aim · FIRE/DROP buttons', VIEW_W / 2, 162, 8, '#e8f2ff', true);
    this.text('press ENTER or tap to start', VIEW_W / 2, 190, 10, '#ffd866', true);
  }

  private upgrade(cards: UpgradeCard[]): void {
    this.overlay();
    this.text('WAVE CLEARED — choose an upgrade', VIEW_W / 2, 60, 10, '#ffd866', true);
    cards.forEach((card, i) => {
      const r = cardRect(i);
      this.ctx.fillStyle = '#12233d';
      this.ctx.fillRect(r.x, r.y, r.w, r.h);
      this.ctx.strokeStyle = '#9fd8ff';
      this.ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      this.text(`[${i + 1}]`, r.x + r.w / 2, r.y + 20, 10, '#ffd866', true);
      this.text(card.name, r.x + r.w / 2, r.y + 45, 9, '#e8f2ff', true);
      this.text(card.desc, r.x + r.w / 2, r.y + 70, 7, '#9fd8ff', true);
    });
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

  private drawAircraftShadow(world: World, x: number, y: number, cam: number, oy: number): void {
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_W)));
    const surfaceY = world.terrain.water[col] ? WATERLINE : this.surfaceYAt(world, x);
    const style = shadowStyle(surfaceY - y);
    const { ctx } = this;
    ctx.save();
    ctx.translate(Math.round(x - cam), Math.round(surfaceY + oy + 1));
    ctx.scale(style.scale, style.scale);
    ctx.filter = `blur(${style.blur}px)`;
    ctx.fillStyle = `rgba(5, 12, 18, ${style.alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayerRotor(x: number, y: number, cam: number, oy: number, t: number): void {
    const { ctx } = this;
    const sweep = 24 + Math.sin(t * 38) * 3;
    ctx.save();
    ctx.translate(Math.round(x - cam), Math.round(y + oy - 16));
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
