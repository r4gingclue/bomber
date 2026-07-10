import { VIEW_W, VIEW_H, WATERLINE } from '../game/consts';
import type { World } from '../game/world';
import type { Phase } from '../game/state';
import type { UpgradeCard } from '../game/upgrades';
import { bankFrame } from '../game/aim';
import { touchButtons } from '../core/input';
import type { Sheet } from './sprites';

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

export class Renderer {
  private lastT = 0;
  private turnScale = 1;

  constructor(private ctx: CanvasRenderingContext2D, private sheet: Sheet) {
    ctx.imageSmoothingEnabled = false;
  }

  draw(world: World, phase: Phase, cards: UpgradeCard[], t: number, touchUI: boolean): void {
    const { ctx } = this;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    const shx = world.shake ? (Math.random() * 2 - 1) * world.shake : 0;
    const shy = world.shake ? (Math.random() * 2 - 1) * world.shake : 0;
    const cam = world.camX + shx;
    const oy = shy; // vertical shake offset for world-space drawing

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, WATERLINE);
    sky.addColorStop(0, '#2a4a9e');
    sky.addColorStop(1, '#7ba6e0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // far clouds
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (const cl of CLOUDS_FAR) {
      const x = wrapX(cl.x, cam, 0.15);
      ctx.fillRect(x, cl.y + oy * 0.3, cl.w, 4);
      ctx.fillRect(x + 8, cl.y - 2 + oy * 0.3, cl.w - 16, 2);
    }
    // horizon haze
    ctx.fillStyle = 'rgba(230,240,255,0.25)';
    ctx.fillRect(0, WATERLINE - 22 + oy, VIEW_W, 22);
    // near clouds
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const cl of CLOUDS_NEAR) {
      const x = wrapX(cl.x, cam, 0.4);
      ctx.fillRect(x, cl.y + oy * 0.6, cl.w, 5);
      ctx.fillRect(x + 6, cl.y - 3 + oy * 0.6, cl.w - 12, 3);
    }
    // sea with depth fog
    const sea = ctx.createLinearGradient(0, WATERLINE, 0, VIEW_H);
    sea.addColorStop(0, '#0e4a8a');
    sea.addColorStop(0.5, '#082d58');
    sea.addColorStop(1, '#03101f');
    ctx.fillStyle = sea;
    ctx.fillRect(0, WATERLINE + oy, VIEW_W, VIEW_H - WATERLINE);
    // light rays (fade out by mid-depth)
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
    // sun glare on water
    const glx = wrapX(300, cam, 0.9);
    const glare = ctx.createRadialGradient(glx, WATERLINE + 6 + oy, 2, glx, WATERLINE + 6 + oy, 60);
    glare.addColorStop(0, 'rgba(255,244,200,0.25)');
    glare.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(glx - 60, WATERLINE - 4 + oy, 120, 24);
    // waterline: two wave rows + foam caps
    for (let x = 0; x < VIEW_W; x += 4) {
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
      if (world.sonarTimer > 0 && s.kind !== 'gunboat') {
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
      } else {
        const rot = Math.atan2(p.vy, p.vx);
        dr(p.ptype === 'sam' ? 'sam' : 'torpedo', p.x, p.y, false,
          p.ptype === 'sam' ? rot + Math.PI / 2 : rot);
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
    // player with turn motion
    const pl = world.player;
    const target = pl.facing;
    this.turnScale += (target - this.turnScale) * Math.min(1, dt * 16);
    let ts = this.turnScale;
    if (Math.abs(ts) < 0.08) ts = ts < 0 ? -0.08 : 0.08;
    const pitch = Math.max(-0.15, Math.min(0.15, pl.vy * 0.002));
    if (pl.iframes <= 0 || Math.floor(t * 12) % 2 === 0) {
      const frame = `heli${bankFrame(pl.vx)}${Math.floor(t * 20) % 2}`;
      const f = this.sheet.frames[frame];
      ctx.save();
      ctx.translate(Math.round(pl.x - cam), Math.round(pl.y + oy));
      ctx.rotate(pitch * (ts < 0 ? -1 : 1));
      ctx.scale(ts, 1);
      ctx.drawImage(this.sheet.canvas, f.x, f.y, f.w, f.h, -f.w / 2, -f.h / 2, f.w, f.h);
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
    if (phase === 'gameover') this.gameover(world);
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
    ctx.fillStyle = '#e8f2ff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`WAVE ${world.wave}`, VIEW_W - 8, 12);
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
}
