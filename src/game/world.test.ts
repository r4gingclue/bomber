import { describe, it, expect } from 'vitest';
import { World, scoreBlast, BASE_SCORE } from './world';
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

describe('World', () => {
  it('wave 1 spawns only patrol subs and is not cleared', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    expect(w.wave).toBe(1);
    expect(w.subs.length).toBeGreaterThan(0);
    expect(w.subs.every(s => s.kind === 'patrol')).toBe(true);
    expect(w.cleared).toBe(false);
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
    const intent = { move: { x: 0, y: 0 }, drop: true, fire: false };
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
    const fire = { move: { x: 0, y: 0 }, drop: false, fire: true };
    for (let i = 0; i < 30 && w.subs.length > 0; i++) w.update(1 / 60, fire);
    expect(w.subs.length).toBe(0);
  });
  it('a throwing entity is removed instead of crashing the frame', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    const bad = w.subs[0];
    Object.defineProperty(bad, 'x', { get() { throw new Error('boom'); } });
    expect(() => w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false })).not.toThrow();
    expect(w.subs.includes(bad)).toBe(false);
  });

  it('fires bullets toward the aim point', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.turretAngle = 0;
    const aim = { x: w.player.x + 100, y: w.player.y - 100 }; // up-right
    // let the turret settle on the target first
    for (let i = 0; i < 60; i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, aim });
    }
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: true, aim });
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
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false, aim });
    expect(w.player.turretAngle).toBeGreaterThan(0);
    expect(w.player.turretAngle).toBeLessThan(Math.PI / 2); // not snapped
  });

  it('shake decays toward zero and is capped', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.shake = 8; // cap value, max reachable in play
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    expect(w.shake).toBeLessThan(8);
    for (let i = 0; i < 120; i++) w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    expect(w.shake).toBe(0);
  });

  it('blast rings expire after 0.3s', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.rings.push({ x: 0, y: 200, age: 0 });
    for (let i = 0; i < 30; i++) w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    expect(w.rings.length).toBe(0);
  });

  it('skips the shot instead of spawning a bullet underwater', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.y = WATERLINE - 6;
    w.player.turretAngle = Math.PI / 2; // straight down
    const aim = { x: w.player.x, y: w.player.y + 100 };
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: true, aim });
    expect(w.shots.filter(s => s.ptype === 'bullet').length).toBe(0);
    expect(w.events).not.toContain('fire');
  });

  it('facing does not flip while firing near-vertical', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.player.facing = 1;
    w.player.turretAngle = Math.PI / 2 - 0.01;
    const aim = { x: w.player.x - 0.5, y: w.player.y + 100 }; // wobble across vertical
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: true, aim });
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
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
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
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
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
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
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
    for (let i = 0; i < 120; i++) w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
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
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    }
    expect(w.subs.some(s => s.id === 601)).toBe(false); // scout dead
    expect(w.subs.some(s => s.id === 602)).toBe(true);  // mine untouched
  });

  it('bullets chip ground enemies at half damage', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.terrain = generateTerrain('inland', mulberry32(4));
    const tank = { id: 604, kind: 'tank' as const, hp: 20, x: 500, y: 140, vx: 0, vy: 0, dir: 1 as const, fireTimer: 99, surfaceTimer: 0, surfaced: false, hitFlash: 0 };
    w.subs.push(tank);
    w.shots.push({ id: 605, ptype: 'bullet', x: 490, y: tank.y, vx: 300, vy: 0, age: 0, life: 0.7, damage: 8 });
    w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    expect(tank.hp).toBe(16); // 8 * 0.5 = 4 chip
  });

  it('gunship shots travel straight at the player', () => {
    const w = new World(mulberry32(1));
    w.startWave();
    w.subs.length = 0;
    w.subs.push({ id: 606, kind: 'gunship', hp: 24, x: w.player.x + 140, y: w.player.y, vx: 0, vy: 0, dir: -1, fireTimer: 0.01, surfaceTimer: 0, surfaced: false, hitFlash: 0 });
    for (let i = 0; i < 30 && !w.shots.some(p => p.ptype === 'shot'); i++) {
      w.update(1 / 60, { move: { x: 0, y: 0 }, drop: false, fire: false });
    }
    const shot = w.shots.find(p => p.ptype === 'shot')!;
    expect(shot).toBeDefined();
    expect(shot.vx).toBeLessThan(0); // toward player on the left
  });
});
