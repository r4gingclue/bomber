import { describe, it, expect, vi } from 'vitest';
import { World, scoreBlast, BASE_SCORE, impactParticleColor } from './world';
import { WATERLINE } from './consts';
import { mulberry32 } from '../core/rng';
import { generateTerrain, isWater } from './terrain';

describe('scoreBlast', () => {
  it('adds depth bonus per kill', () => {
    const pts = scoreBlast([{ kind: 'patrol', y: WATERLINE + 80 }]);
    expect(pts).toBe(BASE_SCORE.patrol + 80);
  });
  it('multiplies by kill count for multi-kills', () => {
    const one = scoreBlast([{ kind: 'patrol', y: WATERLINE + 10 }]);
    const two = scoreBlast([
      { kind: 'patrol', y: WATERLINE + 10 },
      { kind: 'patrol', y: WATERLINE + 10 },
    ]);
    expect(two).toBe(one * 2 * 2); // (sum of 2 kills) × 2 multiplier
  });
});

it('chooses impact visuals from terrain water state rather than impact height', () => {
  const coast = generateTerrain('coast', mulberry32(2));
  const waterX = coast.water.findIndex(Boolean) * 8 + 4;
  const landX = coast.water.findIndex(value => !value) * 8 + 4;

  expect(impactParticleColor(coast, waterX)).toBe('#9fd8ff');
  expect(impactParticleColor(coast, landX)).toBe('#ffb347');
});

describe('World', () => {
  it('emits specific player weapon and charge events', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.events.length = 0;
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: true, fire: true, missile: false });

    expect(w.events).toContain('cannon-fire');
    expect(w.events).toContain('depth-charge-drop');
  });

  it('emits a specific player missile launch event', () => {
    const w = new World(mulberry32(1));
    w.stats.missileCap = 1;
    w.missileStock = 1;
    w.subs.push({ id: 800, kind: 'scout', hp: 8, x: w.player.x + 100, y: w.player.y, vx: 0, vy: 0, dir: -1, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 });

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: true });

    expect(w.events).toContain('player-missile-launch');
  });

  it('emits a specific SAM launch event from a missile submarine', () => {
    const w = new World(mulberry32(1));
    w.subs.push({ id: 801, kind: 'missile', hp: 25, x: w.player.x + 100, y: WATERLINE + 20, vx: 0, vy: 0, dir: -1, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 });

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });

    expect(w.events).toContain('enemy-sam-launch');
  });

  it('distinguishes water entry and underwater detonation', () => {
    const w = new World(mulberry32(1));
    const waterCol = w.terrain.water.findIndex(Boolean);
    const x = waterCol * 8 + 4;
    w.charges.push({ id: 802, x, y: WATERLINE, vx: 0, vy: 20 });
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    expect(w.events).toContain('water-entry');

    w.events.length = 0;
    w.charges[0].y = 269;
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    expect(w.events).toContain('underwater-explosion');
  });

  it('emits specific impact, destruction, damage, and death events', () => {
    const w = new World(mulberry32(1));
    const target = { id: 803, kind: 'scout' as const, hp: 16, x: w.player.x + 50, y: w.player.y, vx: 0, vy: 0, dir: -1 as const, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 };
    w.subs.push(target);
    w.shots.push({ id: 804, ptype: 'bullet', x: target.x, y: target.y, vx: 0, vy: 0, age: 0, life: 1, damage: 8 });
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    expect(w.events).toContain('armor-hit');

    w.events.length = 0;
    target.hp = 1;
    w.shots.push({ id: 805, ptype: 'bullet', x: target.x, y: target.y, vx: 0, vy: 0, age: 0, life: 1, damage: 8 });
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    expect(w.events).toContain('aircraft-explosion');

    w.events.length = 0;
    w.player.hp = 10;
    w.player.iframes = 0;
    w.shots.push({ id: 806, ptype: 'sam', x: w.player.x, y: w.player.y, vx: 0, vy: 0, age: 0, life: 1, damage: 25 });
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    expect(w.events).toContain('player-damaged');
    expect(w.events).toContain('game-over');
  });

  it('emits a specific sonar cue', () => {
    const w = new World(mulberry32(1));
    w.stats.sonar = true;
    w.startWave();
    expect(w.events).toContain('sonar-ping');
  });

  it('wave 1 spawns only patrol subs and is not cleared', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    expect(w.wave).toBe(1);
    expect(w.subs.length).toBeGreaterThan(0);
    expect(w.subs.every(s => s.kind === 'patrol')).toBe(true);
    expect(w.cleared).toBe(false);
  });

  it('reports only the current wave score and charge performance with health loss', () => {
    const w = new World(mulberry32(1));
    w.score = 800;
    w.drops = 2;
    w.hitDrops = 1;
    w.startWave();

    w.score += 300;
    w.drops++;
    w.hitDrops++;
    w.player.hp = 85;

    expect(w.wavePerformance()).toMatchObject({
      scoreEarned: 300,
      scoreTarget: expect.any(Number),
      drops: 1,
      hitDrops: 1,
      hpStart: 100,
      hpEnd: 85,
      maxHpStart: 100,
      hadChargeTargets: true,
    });
    expect(w.wavePerformance().scoreTarget).toBeGreaterThan(0);
  });

  it('is cleared when all subs are gone', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    expect(w.cleared).toBe(true);
  });
  it('dropping respects maxCharges in flight', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    const intent = { move: { x: 0, y: 0 }, drop: true, fire: false, missile: false };
    w.update(1 / 60, intent);
    w.update(1 / 60, intent);
    w.update(1 / 60, intent);
    expect(w.charges.length).toBeLessThanOrEqual(w.stats.maxCharges);
  });
  it('autocannon can destroy a near-surface mine', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.subs.push({
      id: 999, kind: 'mine', hp: 1, x: w.player.x + 30, y: WATERLINE + 6,
      vx: 0, vy: 0, dir: 1, fireTimer: 99, surfaceTimer: 99, surfaced: false, hitFlash: 0,
    });
    // put the player at the water-contact line so bullets fire near the mine's depth
    w.player.y = WATERLINE - 6;
    const fire = { move: { x: 0, y: 0 }, drop: false, fire: true, missile: false };
    for (let i = 0; i < 30 && w.subs.length > 0; i++) w.update(1 / 60, fire);
    expect(w.subs.length).toBe(0);
  });
  it('a throwing entity is removed instead of crashing the frame', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    const bad = w.subs[0];
    Object.defineProperty(bad, 'x', { get() { throw new Error('boom'); } });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false })).not.toThrow();
    expect(w.subs.includes(bad)).toBe(false);
    expect(error).toHaveBeenCalledWith('entity removed after error', expect.any(Error));
    error.mockRestore();
  });

  it('fires bullets toward the aim point', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.turretAngle = 0;
    const aim = { x: w.player.x + 100, y: w.player.y - 100 }; // up-right
    // let the turret settle on the target first
    for (let i = 0; i < 60; i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false, aim });
    }
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: true, missile: false, aim });
    const bullet = w.shots.find(s => s.ptype === 'bullet')!;
    expect(bullet).toBeDefined();
    expect(bullet.vx).toBeGreaterThan(0);
    expect(bullet.vy).toBeLessThan(0);
    expect(Math.hypot(bullet.vx, bullet.vy)).toBeCloseTo(300, 0);
  });

  it('turret eases toward the aim target instead of snapping', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.turretAngle = 0;
    const aim = { x: w.player.x, y: w.player.y + 100 }; // straight down: target PI/2
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false, aim });
    expect(w.player.turretAngle).toBeGreaterThan(0);
    expect(w.player.turretAngle).toBeLessThan(Math.PI / 2); // not snapped
  });

  it('shake decays toward zero and is capped', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.shake = 8; // cap value, max reachable in play
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    expect(w.shake).toBeLessThan(8);
    for (let i = 0; i < 120; i++) w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    expect(w.shake).toBe(0);
  });

  it('blast rings expire after 0.3s', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.rings.push({ x: 0, y: 200, age: 0 });
    for (let i = 0; i < 30; i++) w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    expect(w.rings.length).toBe(0);
  });

  it('skips the shot instead of spawning a bullet underwater', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.y = WATERLINE - 6;
    w.player.turretAngle = Math.PI / 2; // straight down
    const aim = { x: w.player.x, y: w.player.y + 100 };
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: true, missile: false, aim });
    expect(w.shots.filter(s => s.ptype === 'bullet').length).toBe(0);
    expect(w.events).not.toContain('cannon-fire');
  });

  it('facing does not flip while firing near-vertical', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.facing = 1;
    w.player.turretAngle = Math.PI / 2 - 0.01;
    const aim = { x: w.player.x - 0.5, y: w.player.y + 100 }; // wobble across vertical
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: true, missile: false, aim });
    expect(w.player.facing).toBe(1);
  });

  it('starts in act 1 sea with terrain and counts waves in act', () => {
    const w = new World(mulberry32(1));
    expect(w.act).toBe(1);
    expect(w.terrain.biome).toBe('sea');
    w.startWave();
    expect(w.waveInAct).toBe(1);
  });

  it('startAct advances biome, heals 25%, resets wave counter', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.hp = 40;
    w.startAct();
    expect(w.act).toBe(2);
    expect(w.terrain.biome).toBe('coast');
    expect(w.waveInAct).toBe(0);
    expect(w.player.hp).toBe(40 + 25);
    expect(w.charges.length).toBe(0);
  });

  it('actComplete after finale slot cleared', () => {
    const w = new World(mulberry32(1));
    for (let i = 0; i < 4; i++) { w.startWave(); w.subs.length = 0; }
    expect(w.waveInAct).toBe(4);
    expect(w.actComplete).toBe(true);
  });

  it('gentle touchdown on an LZ does no damage', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.terrain = generateTerrain('coast', mulberry32(2));
    const s = w.terrain.lz[0];
    const x = (s.x0 + s.x1) / 2;
    w.player.x = x;
    w.player.y = w.terrain.surface[Math.floor(x / 8)] - 7;
    w.player.vx = 0;
    w.player.vy = 20; // gentle descent
    const hp = w.player.hp;
    // a few frames for the slow descent to actually reach the surface
    for (let i = 0; i < 5; i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    }
    expect(w.player.hp).toBe(hp);
    expect(w.player.vy).toBe(0);
  });

  it('crashing into a building damages the player', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.terrain = generateTerrain('coast', mulberry32(2));
    // find the tallest building column
    const iTall = w.terrain.surface.indexOf(Math.min(...w.terrain.surface));
    w.player.x = iTall * 8 + 4;
    w.player.y = w.terrain.surface[iTall] - 2;
    w.player.vy = 100; // fast
    const hp = w.player.hp;
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('bombs detonate on contact with land', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.terrain = generateTerrain('coast', mulberry32(2));
    const iLand = w.terrain.water.findIndex(v => !v) + 5;
    w.charges.push({ id: 991, x: iLand * 8 + 4, y: w.terrain.surface[iLand] - 4, vx: 0, vy: 60 });
    for (let i = 0; i < 20 && w.charges.length > 0; i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    }
    expect(w.charges.length).toBe(0);
    expect(w.rings.length).toBeGreaterThan(0); // blast happened
  });

  it('water enemies turn back at the shoreline', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.terrain = generateTerrain('coast', mulberry32(2));
    w.subs.length = 0;
    const shoreX = w.terrain.water.lastIndexOf(true) * 8;
    w.subs.push({
      id: 501, kind: 'patrol', hp: 1, x: shoreX - 10, y: 200,
      vx: 30, vy: 0, dir: 1, fireTimer: 99, surfaceTimer: 99, surfaced: false, hitFlash: 0,
    });
    for (let i = 0; i < 120; i++) w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    const s = w.subs.find(o => o.id === 501)!;
    expect(s).toBeDefined();
    expect(isWater(w.terrain, s.x)).toBe(true);
    // sprite nose must stay clear of the sand too
    expect(isWater(w.terrain, s.x + 15)).toBe(true);
    expect(isWater(w.terrain, s.x - 15)).toBe(true);
  });

  it('water enemies only spawn over water on the coast', () => {
    const w = new World(mulberry32(1));
    w.act = 2;
    w.terrain = generateTerrain('coast', mulberry32(3));
    w.startWave();
    for (const s of w.subs) {
      if (s.kind !== 'gunboat') continue; // gunboat sits on surface — must be wet too
    }
    for (const s of w.subs) {
      expect(w.terrain.water[Math.max(0, Math.min(119, Math.floor(s.x / 8)))]).toBe(true);
    }
  });

  it('air enemies spawn in the sky, ground enemies on land', () => {
    const w = new World(mulberry32(1));
    w.act = 3;
    w.terrain = generateTerrain('inland', mulberry32(4));
    w.wave = 8; // next startWave → 9, all inland kinds unlocked
    w.startWave();
    expect(w.subs.length).toBeGreaterThan(0);
    for (const s of w.subs) {
      if (s.kind === 'scout' || s.kind === 'gunship' || s.kind === 'mchopper') {
        expect(s.y).toBeLessThan(120);
      }
      if (s.kind === 'aagun' || s.kind === 'tank') {
        expect(Math.abs(s.y - (w.terrain.surface[Math.floor(s.x / 8)] - 4))).toBeLessThan(3);
      }
    }
  });

  it('spawns tanks inside a flat plateau patrol span', () => {
    const w = new World(mulberry32(1));
    w.act = 3;
    w.terrain = generateTerrain('inland', mulberry32(4));
    w.wave = 8;
    w.startWave();
    const tanks = w.subs.filter(s => s.kind === 'tank') as Array<typeof w.subs[number] & { patrol?: { x0: number; x1: number } }>;
    expect(tanks.length).toBeGreaterThan(0);
    for (const tank of tanks) {
      expect(tank.patrol).toBeDefined();
      expect(tank.x).toBeGreaterThanOrEqual(tank.patrol!.x0);
      expect(tank.x).toBeLessThanOrEqual(tank.patrol!.x1);
      expect(tank.patrol!.x0).toBeGreaterThanOrEqual(w.terrain.lz[1].x0);
      expect(tank.patrol!.x1).toBeLessThanOrEqual(w.terrain.lz[1].x1);
    }
  });

  it('scout death blast does not chain mines', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.subs.push(
      { id: 601, kind: 'scout', hp: 1, x: 300, y: 140, vx: 0, vy: 0, dir: 1, fireTimer: 9, surfaceTimer: 0, surfaced: false, hitFlash: 0 },
      { id: 602, kind: 'mine', hp: 1, x: 300, y: 160, vx: 0, vy: 0, dir: 1, fireTimer: 9, surfaceTimer: 9, surfaced: false, hitFlash: 0 },
    );
    // kill the scout with a bullet
    w.player.x = 260; w.player.y = 140; w.player.turretAngle = 0;
    w.shots.push({ id: 603, ptype: 'bullet', x: 295, y: 140, vx: 300, vy: 0, age: 0, life: 0.7, damage: 8 });
    for (let i = 0; i < 10 && w.subs.some(s => s.id === 601); i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    }
    expect(w.subs.some(s => s.id === 601)).toBe(false); // scout dead
    expect(w.subs.some(s => s.id === 602)).toBe(true);  // mine untouched
  });

  it('bullets chip ground enemies at half damage', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.terrain = generateTerrain('inland', mulberry32(4));
    const tank = { id: 604, kind: 'tank' as const, hp: 20, x: 840, y: w.terrain.surface[105] - 4, vx: 0, vy: 0, dir: 1 as const, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 };
    w.subs.push(tank);
    w.shots.push({ id: 605, ptype: 'bullet', x: 830, y: tank.y, vx: 300, vy: 0, age: 0, life: 0.7, damage: 8 });
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    expect(tank.hp).toBe(16); // 8 * 0.5 = 4 chip
  });

  it('scout depth-charge deaths do not hit a far player or chain nearby mines', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.subs.push(
      { id: 607, kind: 'scout', hp: 8, x: 300, y: 180, vx: 0, vy: 0, dir: 1, fireTimer: 9, surfaceTimer: 0, surfaced: false, hitFlash: 0 },
      { id: 608, kind: 'mine', hp: 1, x: 300, y: 215, vx: 0, vy: 0, dir: 1, fireTimer: 9, surfaceTimer: 9, surfaced: false, hitFlash: 0 },
    );
    w.charges.push({ id: 609, x: 300, y: 180, vx: 0, vy: 0 });

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });

    expect(w.subs.some(s => s.id === 607)).toBe(false);
    expect(w.subs.some(s => s.id === 608)).toBe(true);
    expect(w.player.hp).toBe(100);
    expect(w.kills).toBe(1);
    expect(w.score).toBe(BASE_SCORE.scout + 32);
  });

  it('scout death blasts only damage a nearby player', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.player.x = 300;
    w.player.y = 120;
    w.subs.push({ id: 620, kind: 'scout', hp: 1, x: 300, y: 135, vx: 0, vy: 0, dir: 1, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 });
    w.shots.push({ id: 621, ptype: 'bullet', x: 295, y: 135, vx: 300, vy: 0, age: 0, life: 0.7, damage: 8 });

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });

    expect(w.subs).toHaveLength(0);
    expect(w.player.hp).toBe(80);
  });

  it('unrelated AA guns do not let terrain-embedded bullets hit gunships', () => {
    const gunshipHpAfter = (withAagun: boolean): number => {
      const w = new World(mulberry32(1));
      w.startWave();
      w.subs.length = 0;
      w.terrain = generateTerrain('inland', mulberry32(4));
      const y = w.terrain.surface[105] + 2;
      const gunship = { id: 610, kind: 'gunship' as const, hp: 24, x: 840, y, vx: 0, vy: 0, dir: -1 as const, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 };
      w.subs.push(gunship);
      if (withAagun) {
        w.subs.push({ id: 611, kind: 'aagun', hp: 1, x: 600, y: w.terrain.surface[75] - 4, vx: 0, vy: 0, dir: 1, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 });
      }
      w.shots.push({ id: 612, ptype: 'bullet', x: 830, y, vx: 300, vy: 0, age: 0, life: 0.7, damage: 8 });
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
      return gunship.hp;
    };

    expect(gunshipHpAfter(false)).toBe(24);
    expect(gunshipHpAfter(true)).toBe(24);
  });

  it('gunship shots travel straight at the player', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.subs.push({ id: 606, kind: 'gunship', hp: 24, x: w.player.x + 140, y: w.player.y, vx: 0, vy: 0, dir: -1, fireTimer: 0.01, surfaceTimer: 0, surfaced: false, hitFlash: 0 });
    for (let i = 0; i < 30 && !w.shots.some(p => p.ptype === 'shot'); i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    }
    const shot = w.shots.find(p => p.ptype === 'shot')!;
    expect(shot).toBeDefined();
    expect(shot.vx).toBeLessThan(0); // toward player on the left
  });

  it('missile stock refills +1 per wave up to cap', () => {
    const w = new World(mulberry32(1));
    w.stats.missileCap = 4;
    w.startWave();
    expect(w.missileStock).toBe(1);
    for (let i = 0; i < 9; i++) w.startWave();
    expect(w.missileStock).toBe(4);
  });

  it('fires a homing missile at the nearest air enemy and kills a scout in one hit', () => {
    const w = new World(mulberry32(1));
    w.stats.missileCap = 2;
    w.startWave();
    w.missileStock = 2;
    w.subs.length = 0;
    w.subs.push({ id: 701, kind: 'scout', hp: 8, x: w.player.x + 120, y: w.player.y, vx: 0, vy: 0, dir: -1, fireTimer: 9, surfaceTimer: 0, surfaced: false, hitFlash: 0 });
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: true });
    expect(w.missileStock).toBe(1);
    expect(w.shots.some(p => p.ptype === 'pmissile')).toBe(true);
    for (let i = 0; i < 180 && w.subs.length > 0; i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });
    }
    expect(w.subs.length).toBe(0);
  });

  it('missile input is ignored with zero stock', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: true });
    expect(w.shots.some(p => p.ptype === 'pmissile')).toBe(false);
  });

  it('point defense does not destroy player missiles', () => {
    const w = new World(mulberry32(1));
    w.stats.missileCap = 1;
    w.stats.pointDefense = true;
    w.startWave();
    w.subs.length = 0;
    w.subs.push({ id: 702, kind: 'scout', hp: 8, x: w.player.x + 120, y: w.player.y, vx: 0, vy: 0, dir: -1, fireTimer: 9, surfaceTimer: 0, surfaced: false, hitFlash: 0 });

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: true });

    expect(w.shots.some(p => p.ptype === 'pmissile')).toBe(true);
  });

  it('point defense only intercepts hostile projectiles at close range', () => {
    const w = new World(mulberry32(1));
    w.stats.pointDefense = true;
    w.startWave();
    w.subs.length = 0;
    w.shots.push({
      id: 719,
      ptype: 'shot',
      x: w.player.x + 40,
      y: w.player.y,
      vx: 0,
      vy: 0,
      age: 0,
      life: 4,
      damage: 10,
    });

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });

    expect(w.shots.some(p => p.id === 719)).toBe(true);

    w.shots.push({
      id: 718,
      ptype: 'shot',
      x: w.player.x + 30,
      y: w.player.y,
      vx: 0,
      vy: 0,
      age: 0,
      life: 4,
      damage: 10,
    });
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });

    expect(w.shots.some(p => p.id === 718)).toBe(false);
  });

  it('autocannon bullets can shoot down enemy SAM rockets', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    const x = w.player.x + 80;
    const y = w.player.y;
    w.shots.push(
      { id: 720, ptype: 'sam', x, y, vx: 0, vy: 0, age: 0, life: 4, damage: 25 },
      { id: 721, ptype: 'bullet', x, y, vx: 0, vy: 0, age: 0, life: 0.7, damage: 8 },
    );

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });

    expect(w.shots.some(p => p.id === 720)).toBe(false);
    expect(w.shots.some(p => p.id === 721)).toBe(false);
  });

  it('uses the visible SAM sprite bounds for autocannon interception', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    const x = w.player.x + 80;
    const y = w.player.y;
    w.shots.push(
      { id: 722, ptype: 'sam', x, y: y + 7, vx: -140, vy: 0, age: 0, life: 4, damage: 25 },
      { id: 723, ptype: 'bullet', x, y, vx: 300, vy: 0, age: 0, life: 0.7, damage: 8 },
    );

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });

    expect(w.shots.some(p => p.id === 722)).toBe(false);
    expect(w.shots.some(p => p.id === 723)).toBe(false);
    expect(w.events).toContain('armor-hit');
    expect(w.rings.some(r => r.x === x && r.y === y + 7)).toBe(true);
  });

  it.each(['sam', 'flak', 'shot', 'torpedo'] as const)(
    'autocannon bullets can intercept hostile %s projectiles',
    ptype => {
      const w = new World(mulberry32(1));
      w.startWave();
      w.subs.length = 0;
      const x = w.player.x + 80;
      const y = w.player.y;
      w.shots.push(
        { id: 724, ptype, x, y: y + 6, vx: -140, vy: 0, age: 0, life: 4, damage: 20 },
        { id: 725, ptype: 'bullet', x, y, vx: 300, vy: 0, age: 0, life: 0.7, damage: 8 },
      );

      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });

      expect(w.shots.some(p => p.id === 724)).toBe(false);
      expect(w.shots.some(p => p.id === 725)).toBe(false);
    },
  );

  it('spawns player missiles with the specified speed, damage, and lifetime', () => {
    const w = new World(mulberry32(1));
    w.stats.missileCap = 1;
    w.startWave();
    w.subs.length = 0;
    w.subs.push({ id: 703, kind: 'scout', hp: 8, x: w.player.x + 120, y: w.player.y, vx: 0, vy: 0, dir: -1, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 });

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: true });

    const missile = w.shots.find(p => p.ptype === 'pmissile')!;
    expect(Math.hypot(missile.vx, missile.vy)).toBeCloseTo(200, 8);
    expect(missile.damage).toBe(24);
    expect(missile.life).toBe(4);
  });

  it('targets the nearest air enemy while ignoring a nearer ground enemy', () => {
    const w = new World(mulberry32(1));
    w.stats.missileCap = 1;
    w.startWave();
    w.subs.length = 0;
    w.subs.push(
      { id: 704, kind: 'aagun', hp: 1, x: w.player.x - 20, y: w.player.y, vx: 0, vy: 0, dir: 1, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 },
      { id: 705, kind: 'scout', hp: 8, x: w.player.x + 120, y: w.player.y, vx: 0, vy: 0, dir: -1, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 },
    );

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: true });

    expect(w.shots.find(p => p.ptype === 'pmissile')!.vx).toBeGreaterThan(0);
  });

  it('preserves missile stock when no air target exists', () => {
    const w = new World(mulberry32(1));
    w.stats.missileCap = 1;
    w.startWave();
    w.subs.length = 0;
    w.subs.push({ id: 706, kind: 'aagun', hp: 1, x: w.player.x + 40, y: w.player.y, vx: 0, vy: 0, dir: 1, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 });

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: true });

    expect(w.missileStock).toBe(1);
    expect(w.shots.some(p => p.ptype === 'pmissile')).toBe(false);
  });

  it('expires player missiles on land terrain', () => {
    const w = new World(mulberry32(1));
    w.terrain = generateTerrain('inland', mulberry32(2));
    const x = w.player.x;
    w.shots.push({ id: 707, ptype: 'pmissile', x, y: w.terrain.surface[Math.floor(x / 8)], vx: 200, vy: 0, age: 0, life: 4, damage: 24 });

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });

    expect(w.shots.some(p => p.id === 707)).toBe(false);
    expect(w.particles.length).toBeGreaterThan(0);
  });

  it('caps player missile homing turns at 3 radians per second', () => {
    const w = new World(mulberry32(1));
    w.subs.push({ id: 708, kind: 'scout', hp: 8, x: w.player.x - 200, y: w.player.y, vx: 0, vy: 0, dir: 1, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 });
    const missile = { id: 709, ptype: 'pmissile' as const, x: w.player.x, y: w.player.y, vx: 200, vy: 0, age: 0, life: 4, damage: 24 };
    w.shots.push(missile);

    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: false });

    expect(Math.atan2(missile.vy, missile.vx)).toBeCloseTo(3 / 60, 8);
  });

  it('applies a scout missile kill blast, score, and reward exactly once', () => {
    const w = new World(mulberry32(1));
    w.stats.missileCap = 1;
    w.startWave();
    w.subs.length = 0;
    w.subs.push({ id: 710, kind: 'scout', hp: 8, x: w.player.x + 120, y: w.player.y, vx: 0, vy: 0, dir: -1, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 });

    for (let i = 0; i < 180 && w.subs.length > 0; i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, missile: i === 0 });
    }

    expect(w.subs).toHaveLength(0);
    expect(w.player.hp).toBe(100);
    expect(w.score).toBe(BASE_SCORE.scout);
    expect(w.kills).toBe(1);
    expect(w.events.filter(e => e === 'aircraft-explosion')).toHaveLength(1);
  });
});
