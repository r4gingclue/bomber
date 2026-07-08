import { VIEW_W, VIEW_H, WATERLINE } from '../game/consts';
import type { World } from '../game/world';
import type { Phase } from '../game/state';
import type { UpgradeCard } from '../game/upgrades';
import type { Sheet } from './sprites';

export function cardRect(i: number): { x: number; y: number; w: number; h: number } {
  return { x: 40 + i * 140, y: 80, w: 120, h: 110 };
}

interface CloudSpec { x: number; y: number; w: number }
const CLOUDS: CloudSpec[] = Array.from({ length: 10 }, (_, i) => ({
  x: (i * 197) % 960, y: 12 + (i * 37) % 90, w: 30 + (i * 53) % 40,
}));

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D, private sheet: Sheet) {
    ctx.imageSmoothingEnabled = false;
  }

  draw(world: World, phase: Phase, cards: UpgradeCard[], t: number): void {
    const { ctx } = this;
    const cam = world.camX;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, WATERLINE);
    sky.addColorStop(0, '#2a4a9e');
    sky.addColorStop(1, '#7ba6e0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, WATERLINE);
    // parallax clouds
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const cl of CLOUDS) {
      const x = ((cl.x - cam * 0.3) % 960 + 960) % 960 - 240;
      ctx.fillRect(x, cl.y, cl.w, 5);
      ctx.fillRect(x + 6, cl.y - 3, cl.w - 12, 3);
    }
    // sea
    const sea = ctx.createLinearGradient(0, WATERLINE, 0, VIEW_H);
    sea.addColorStop(0, '#0e4a8a');
    sea.addColorStop(1, '#051426');
    ctx.fillStyle = sea;
    ctx.fillRect(0, WATERLINE, VIEW_W, VIEW_H - WATERLINE);
    // light rays
    ctx.fillStyle = 'rgba(159,216,255,0.05)';
    for (let i = 0; i < 4; i++) {
      const rx = ((i * 130 - cam * 0.6) % 960 + 960) % 960 - 240 + Math.sin(t * 0.3 + i) * 8;
      ctx.beginPath();
      ctx.moveTo(rx, WATERLINE);
      ctx.lineTo(rx + 26, WATERLINE);
      ctx.lineTo(rx + 60, VIEW_H);
      ctx.lineTo(rx + 10, VIEW_H);
      ctx.fill();
    }
    // animated waterline strip
    ctx.fillStyle = '#bfe3ff';
    for (let x = 0; x < VIEW_W; x += 4) {
      const h = 1 + Math.round(Math.sin((x + cam) * 0.08 + t * 2.5) + 1);
      ctx.fillRect(x, WATERLINE - h, 4, h);
    }

    // entities (world space → screen space via cam)
    const dr = (frame: string, x: number, y: number, flip = false, rot = 0) => {
      const f = this.sheet.frames[frame];
      ctx.save();
      ctx.translate(Math.round(x - cam), Math.round(y));
      if (flip) ctx.scale(-1, 1);
      if (rot) ctx.rotate(rot);
      ctx.drawImage(this.sheet.canvas, f.x, f.y, f.w, f.h, -f.w / 2, -f.h / 2, f.w, f.h);
      ctx.restore();
    };

    for (const s of world.subs) {
      const frame = s.kind === 'gunboat' ? 'gunboat' : s.kind === 'mine' ? 'mine' : s.kind;
      dr(frame, s.x, s.y, s.dir < 0);
      if (world.sonarTimer > 0 && s.kind !== 'gunboat') {
        ctx.strokeStyle = 'rgba(120,255,160,0.8)';
        ctx.strokeRect(Math.round(s.x - cam) - 12, Math.round(s.y) - 7, 24, 14);
      }
    }
    for (const c of world.charges) dr('charge', c.x, c.y);
    for (const p of world.shots) {
      if (p.ptype === 'bullet') {
        ctx.fillStyle = '#ffe9a0';
        ctx.fillRect(Math.round(p.x - cam) - 1, Math.round(p.y), 3, 1);
      } else {
        const rot = Math.atan2(p.vy, p.vx);
        dr(p.ptype === 'sam' ? 'sam' : 'torpedo', p.x, p.y, false,
          p.ptype === 'sam' ? rot + Math.PI / 2 : rot);
      }
    }
    // player (blink during iframes)
    if (world.player.iframes <= 0 || Math.floor(t * 12) % 2 === 0) {
      dr(Math.floor(t * 20) % 2 === 0 ? 'heli0' : 'heli1',
        world.player.x, world.player.y, world.player.facing < 0);
    }
    // particles
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x - cam), Math.round(pt.y), pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    this.hud(world);
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

  private overlay(): void {
    this.ctx.fillStyle = 'rgba(4,10,20,0.75)';
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private menu(): void {
    this.overlay();
    this.text('SEA BOMBER', VIEW_W / 2, 100, 24, '#ffd866', true);
    this.text('depth-charge the subs · dodge everything', VIEW_W / 2, 125, 8, '#9fd8ff', true);
    this.text('WASD/arrows move · SPACE drop · F fire', VIEW_W / 2, 150, 8, '#e8f2ff', true);
    this.text('touch: left = stick · right-top = fire · right-bottom = drop', VIEW_W / 2, 162, 8, '#e8f2ff', true);
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
