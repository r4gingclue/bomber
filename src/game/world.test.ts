import { describe, it, expect } from 'vitest';
import { World, scoreBlast, BASE_SCORE } from './world';
import { WATERLINE } from './consts';
import { mulberry32 } from '../core/rng';

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
});
