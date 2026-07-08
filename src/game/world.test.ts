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
      vx: 0, vy: 0, dir: 1, fireTimer: 99, surfaceTimer: 99, surfaced: false,
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
});
