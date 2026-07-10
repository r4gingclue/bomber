import type { Rng } from '../core/rng';
import type { Intent } from '../core/input';
import { ARENA_W, VIEW_W, WATERLINE, SEA_BOTTOM } from './consts';
import { composeWave, type SpawnKind } from './waves';
import { defaultStats, type PlayerStats } from './upgrades';
import { resolveBlasts, circlesOverlap, type Blast, type BlastTarget } from './collision';
import { stepDepthCharge, steerHoming, clampSubDepth } from './entities/physics';
import type { Sub, DepthCharge, Projectile, Particle, Player } from './entities/types';
import { angleTo, easeAngle } from './aim';

export const BASE_SCORE: Record<SpawnKind, number> = {
  patrol: 100, hunter: 200, missile: 250, gunboat: 150, mine: 50,
};

const SUB_SPEED: Record<SpawnKind, number> = {
  patrol: 30, hunter: 40, missile: 25, gunboat: 0, mine: 6,
};

const PLAYER_R = 8;
const SUB_R = 9;
const MINE_CHAIN_R = 30;
const FUSE_R = 12;
const DAMAGE = { torpedo: 20, sam: 25, flak: 15, water: 10 } as const;

export function scoreBlast(
  killed: { kind: SpawnKind; y: number }[],
): number {
  let pts = 0;
  for (const k of killed) pts += BASE_SCORE[k.kind] + Math.max(0, Math.round(k.y - WATERLINE));
  return pts * Math.max(1, killed.length);
}

export class World {
  player: Player = { x: VIEW_W / 2, y: 60, vx: 0, vy: 0, hp: 100, iframes: 0, facing: 1, fireCd: 0, pdCd: 0, turretAngle: 0, muzzleT: 0 };
  stats: PlayerStats = defaultStats();
  owned = new Set<string>();
  subs: Sub[] = [];
  charges: DepthCharge[] = [];
  shots: Projectile[] = [];
  particles: Particle[] = [];
  wave = 0;
  score = 0;
  kills = 0;
  drops = 0;
  hitDrops = 0;
  sonarTimer = 0;
  sonarCycle = 0;
  camX = 0;
  shake = 0;
  rings: { x: number; y: number; age: number }[] = [];
  private smokeT = 0;
  /** drained (cleared) by the frame consumer every update; never self-clears */
  events: string[] = [];
  private nextId = 1;

  constructor(private rng: Rng) {}

  get cleared(): boolean {
    return this.subs.length === 0;
  }

  startWave(): void {
    this.wave++;
    for (const kind of composeWave(this.wave, this.rng)) this.spawn(kind);
    if (this.stats.sonar) {
      this.sonarTimer = 3;
      this.sonarCycle = 8;
      this.events.push('ping');
    }
  }

  private spawn(kind: SpawnKind): void {
    const s: Sub = {
      id: this.nextId++, kind, hp: kind === 'gunboat' ? 24 : 1,
      x: this.rng() * ARENA_W,
      y: kind === 'gunboat' ? WATERLINE - 3
        : WATERLINE + 20 + this.rng() * (SEA_BOTTOM - WATERLINE - 34),
      vx: 0, vy: 0,
      dir: this.rng() < 0.5 ? -1 : 1,
      fireTimer: 2 + this.rng() * 3,
      surfaceTimer: 3 + this.rng() * 4,
      surfaced: false,
      hitFlash: 0,
    };
    s.vx = SUB_SPEED[kind] * s.dir;
    if (kind === 'mine') s.vy = (this.rng() - 0.5) * 8;
    this.subs.push(s);
  }

  update(dt: number, intent: Intent): void {
    this.updatePlayer(dt, intent);
    this.updateCharges(dt);
    this.guardedEach(this.subs, s => this.updateSub(s, dt));
    this.guardedEach(this.shots, p => this.updateShot(p, dt));
    this.shots = this.shots.filter(p => p.age < p.life);
    this.updateParticles(dt);
    if (this.sonarTimer > 0) this.sonarTimer -= dt;
    if (this.stats.sonar) {
      this.sonarCycle -= dt;
      if (this.sonarCycle <= 0) {
        this.sonarCycle = 8;
        this.sonarTimer = 3;
        this.events.push('ping');
      }
    }
    this.shake = Math.max(0, this.shake - 10 * dt);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].age += dt;
      if (this.rings[i].age > 0.3) this.rings.splice(i, 1);
    }
    // camera follows player
    const target = Math.max(0, Math.min(ARENA_W - VIEW_W, this.player.x - VIEW_W / 2));
    this.camX += (target - this.camX) * Math.min(1, 5 * dt);
  }

  private guardedEach<T>(list: T[], fn: (e: T) => void): void {
    for (let i = list.length - 1; i >= 0; i--) {
      try {
        fn(list[i]);
      } catch (err) {
        if ((import.meta as any).env?.DEV) console.error('entity removed after error', err);
        list.splice(i, 1);
      }
    }
  }

  private updatePlayer(dt: number, intent: Intent): void {
    const p = this.player;
    p.vx += intent.move.x * this.stats.accel * dt;
    p.vy += intent.move.y * this.stats.accel * dt;
    const drag = Math.exp(-3 * dt);
    p.vx *= drag;
    p.vy *= drag;
    p.x = Math.max(PLAYER_R, Math.min(ARENA_W - PLAYER_R, p.x + p.vx * dt));
    p.y = Math.max(10, p.y + p.vy * dt);
    const aim = intent.aim ?? null;
    if (aim) {
      const target = angleTo(p.x, p.y, aim.x, aim.y);
      p.turretAngle = easeAngle(p.turretAngle, target, 10 * dt);
    }
    if (intent.fire && aim) p.facing = Math.cos(p.turretAngle) >= 0 ? 1 : -1;
    else if (Math.abs(p.vx) > 15) p.facing = p.vx > 0 ? 1 : -1;
    if (p.muzzleT > 0) p.muzzleT -= dt;
    if (p.iframes > 0) p.iframes -= dt;
    // water contact
    if (p.y > WATERLINE - 6) {
      p.y = WATERLINE - 6;
      p.vy = -140;
      this.damagePlayer(DAMAGE.water);
      this.events.push('splash');
      this.splashParticles(p.x);
    }
    // drop
    if (intent.drop && this.charges.length < this.stats.maxCharges) {
      const n = this.stats.dualDrop ? 2 : 1;
      for (let i = 0; i < n && this.charges.length < this.stats.maxCharges; i++) {
        this.charges.push({
          id: this.nextId++,
          x: p.x + (i === 0 ? -3 : 3), y: p.y + 6,
          vx: p.vx * 0.5 + (i === 0 ? -8 : 8) * (n - 1), vy: Math.max(0, p.vy),
        });
        this.drops++;
      }
      this.events.push('drop');
    }
    // autocannon
    if (p.fireCd > 0) p.fireCd -= dt;
    if (intent.fire && p.fireCd <= 0) {
      p.fireCd = 0.12;
      const a = (intent.aim ?? null) ? p.turretAngle : (p.facing > 0 ? 0 : Math.PI);
      this.shots.push({
        id: this.nextId++, ptype: 'bullet',
        x: p.x + Math.cos(a) * 12, y: p.y + 4 + Math.sin(a) * 12,
        vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
        age: 0, life: 0.7, damage: 8,
      });
      p.muzzleT = 0.05;
      this.events.push('fire');
    }
    // point defense
    if (this.stats.pointDefense) {
      if (p.pdCd > 0) p.pdCd -= dt;
      if (p.pdCd <= 0) {
        const near = this.shots.find(s =>
          s.ptype !== 'bullet' && Math.hypot(s.x - p.x, s.y - p.y) < 45);
        if (near) {
          near.age = near.life;
          p.pdCd = 0.4;
          this.events.push('fire');
          this.boomParticles(near.x, near.y, 4);
        }
      }
    }
    if (p.hp > 0 && p.hp < this.stats.maxHp * 0.4) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.08;
        this.particles.push({
          id: this.nextId++, x: p.x - p.facing * 10, y: p.y,
          vx: -p.facing * 20, vy: -10,
          life: 0.8, maxLife: 0.8, color: '#3a3f46', size: 2,
        });
      }
    }
  }

  private damagePlayer(amount: number): void {
    const p = this.player;
    if (p.iframes > 0) return;
    p.hp -= amount;
    p.iframes = 0.8;
    this.events.push('hit');
    this.shake = Math.min(8, this.shake + 4);
    if (p.hp <= 0) this.events.push('die');
  }

  private updateCharges(dt: number): void {
    const blasts: Blast[] = [];
    for (let i = this.charges.length - 1; i >= 0; i--) {
      const c = this.charges[i];
      if (c.y >= WATERLINE && c.y - c.vy * dt < WATERLINE) {
        this.events.push('splash');
        this.splashParticles(c.x);
      }
      stepDepthCharge(c, this.stats.sinkSpeed, dt);
      if (this.stats.magnetic && c.y > WATERLINE) {
        let best: Sub | null = null, bd = 70;
        for (const s of this.subs) {
          if (s.kind === 'gunboat') continue;
          const d = Math.hypot(s.x - c.x, s.y - c.y);
          if (d < bd) { bd = d; best = s; }
        }
        if (best) {
          c.vx += Math.sign(best.x - c.x) * 50 * dt;
          c.vy += Math.sign(best.y - c.y) * 30 * dt;
        }
      }
      const nearTarget = this.subs.some(s =>
        circlesOverlap({ x: c.x, y: c.y, r: FUSE_R }, { x: s.x, y: s.y, r: SUB_R }));
      if ((c.y > WATERLINE && nearTarget) || c.y >= SEA_BOTTOM - 4) {
        blasts.push({ x: c.x, y: c.y, r: this.stats.blastRadius });
        this.charges.splice(i, 1);
      }
    }
    if (blasts.length === 0) return;
    const targets: BlastTarget[] = this.subs.map(s => ({
      id: s.id, x: s.x, y: s.y,
      r: s.kind === 'mine' ? 5 : SUB_R,
      chainRadius: s.kind === 'mine' ? MINE_CHAIN_R : undefined,
    }));
    const hitIds = resolveBlasts(blasts, targets);
    const killed = this.subs.filter(s => hitIds.has(s.id));
    if (killed.length > 0) {
      this.score += scoreBlast(killed.map(k => ({ kind: k.kind, y: k.y })));
      this.kills += killed.length;
      this.hitDrops++;
      for (const k of killed) this.boomParticles(k.x, k.y, 12);
      this.subs = this.subs.filter(s => !hitIds.has(s.id));
    }
    for (const b of blasts) this.boomParticles(b.x, b.y, 10);
    for (const b of blasts) this.rings.push({ x: b.x, y: b.y, age: 0 });
    this.shake = Math.min(6, this.shake + 2);
    this.events.push('boom');
  }

  private updateSub(s: Sub, dt: number): void {
    if (s.hitFlash > 0) s.hitFlash -= dt;
    if (s.kind !== 'gunboat' && s.kind !== 'mine' && this.rng() < dt * 3) {
      this.particles.push({
        id: this.nextId++, x: s.x - s.dir * 12, y: s.y, vx: 0, vy: -12,
        life: 1, maxLife: 1, color: '#9fd8ff', size: 1,
      });
    }
    const p = this.player;
    if (s.kind === 'gunboat') {
      s.fireTimer -= dt;
      if (s.fireTimer <= 0) {
        s.fireTimer = 2.5;
        const dx = p.x - s.x;
        this.shots.push({
          id: this.nextId++, ptype: 'flak',
          x: s.x, y: s.y - 4,
          vx: Math.max(-120, Math.min(120, dx * 0.8)), vy: -180,
          age: 0, life: 3, damage: DAMAGE.flak,
        });
        this.events.push('fire');
      }
      return;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.x < SUB_R) { s.x = SUB_R; s.dir = 1; s.vx = Math.abs(s.vx); }
    if (s.x > ARENA_W - SUB_R) { s.x = ARENA_W - SUB_R; s.dir = -1; s.vx = -Math.abs(s.vx); }
    if (s.kind === 'mine') {
      const top = WATERLINE + 6, bot = SEA_BOTTOM - 10;
      if (s.y < top) { s.y = top; s.vy = Math.abs(s.vy); }
      if (s.y > bot) { s.y = bot; s.vy = -Math.abs(s.vy); }
    } else if (s.kind !== 'missile' || !s.surfaced) clampSubDepth(s);

    if (s.kind === 'hunter') {
      s.fireTimer -= dt;
      if (s.fireTimer <= 0) {
        s.fireTimer = 3 + this.rng() * 2;
        this.shots.push({
          id: this.nextId++, ptype: 'torpedo',
          x: s.x, y: s.y - 8, vx: 0, vy: -90,
          age: 0, life: 5, damage: DAMAGE.torpedo,
        });
        this.events.push('ping');
      }
    } else if (s.kind === 'missile') {
      s.surfaceTimer -= dt;
      if (!s.surfaced && s.surfaceTimer <= 0) {
        s.surfaced = true;
        s.surfaceTimer = 2.5;
        s.vy = 0;
        s.y = WATERLINE + 6;
        this.shots.push({
          id: this.nextId++, ptype: 'sam',
          x: s.x, y: WATERLINE - 2, vx: 0, vy: -140,
          age: 0, life: 4, damage: DAMAGE.sam,
        });
        this.events.push('fire');
        this.splashParticles(s.x);
      } else if (s.surfaced && s.surfaceTimer <= 0) {
        s.surfaced = false;
        s.surfaceTimer = 5 + this.rng() * 3;
        s.y = WATERLINE + 30;
      }
    }
  }

  private isBulletTarget(s: Sub): boolean {
    return s.kind === 'gunboat' || (s.kind === 'mine' && s.y < WATERLINE + 16);
  }

  private updateShot(p: Projectile, dt: number): void {
    if (p.age >= p.life) return;
    p.age += dt;
    const pl = this.player;
    if (p.ptype === 'torpedo' && p.age < 3.5) {
      steerHoming(p, pl.x, pl.y, 90, 2.5, dt);
    } else if (p.ptype === 'sam') {
      steerHoming(p, pl.x, pl.y, 140, 1.2, dt);
      if (this.rng() < dt * 40) {
        this.particles.push({
          id: this.nextId++, x: p.x, y: p.y + 5, vx: (this.rng() - 0.5) * 20, vy: 40,
          life: 0.25, maxLife: 0.25, color: '#ff9a44', size: 2,
        });
      }
    } else if (p.ptype === 'flak') {
      p.vy += 200 * dt;
    }
    const wasAbove = p.y < WATERLINE;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.ptype === 'torpedo' && wasAbove !== p.y < WATERLINE) this.events.push('splash');
    if (p.ptype === 'bullet') {
      if (p.y > WATERLINE) { p.age = p.life; return; }
      for (const s of this.subs) {
        if (!this.isBulletTarget(s)) continue;
        if (circlesOverlap({ x: p.x, y: p.y, r: 2 }, { x: s.x, y: s.y, r: SUB_R })) {
          s.hp -= p.damage;
          s.hitFlash = 0.1;
          p.age = p.life;
          if (s.hp <= 0) {
            this.subs = this.subs.filter(o => o.id !== s.id);
            this.score += BASE_SCORE[s.kind];
            this.kills++;
            this.boomParticles(s.x, s.y, 10);
            this.rings.push({ x: s.x, y: s.y, age: 0 });
            this.shake = Math.min(6, this.shake + 2);
            this.events.push('boom');
          }
          return;
        }
      }
      return;
    }
    // enemy projectile vs player
    if (circlesOverlap({ x: p.x, y: p.y, r: 3 }, { x: pl.x, y: pl.y, r: PLAYER_R })) {
      p.age = p.life;
      this.damagePlayer(p.damage);
      this.boomParticles(pl.x, pl.y, 6);
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.y > WATERLINE) pt.vy -= 30 * dt; // bubbles rise
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  private splashParticles(x: number): void {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        id: this.nextId++, x: x + (this.rng() - 0.5) * 10, y: WATERLINE,
        vx: (this.rng() - 0.5) * 40, vy: -30 - this.rng() * 40,
        life: 0.5, maxLife: 0.5, color: '#cfe8ff', size: 2,
      });
    }
  }

  private boomParticles(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = 20 + this.rng() * 60;
      this.particles.push({
        id: this.nextId++, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + this.rng() * 0.4, maxLife: 0.8,
        color: y > WATERLINE ? '#9fd8ff' : '#ffb347', size: 2,
      });
    }
  }
}
