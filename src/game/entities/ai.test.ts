import { describe, it, expect } from 'vitest';
import { stepScout, stepGunship, stepMchopper, stepAagun, stepTank } from './ai';
import { generateTerrain, surfaceAt } from '../terrain';
import { mulberry32 } from '../../core/rng';
import type { Sub } from './types';

const foe = (kind: Sub['kind'], x: number, y: number): Sub => ({
  id: 1, kind, hp: 10, x, y, vx: 0, vy: 0, dir: 1,
  fireTimer: 0.01, surfaceTimer: 0, surfaced: false, hitFlash: 0,
});

describe('stepScout', () => {
  it('accelerates toward the player and caps speed at 130', () => {
    const s = foe('scout', 0, 100);
    for (let i = 0; i < 300; i++) stepScout(s, 400, 100, 1 / 60);
    expect(s.x).toBeGreaterThan(50);
    expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(130 + 1e-6);
  });
});

describe('stepGunship', () => {
  it('holds a standoff band around 140px', () => {
    const s = foe('gunship', 500, 100);
    for (let i = 0; i < 600; i++) stepGunship(s, 400, 100, 1 / 60);
    const d = Math.abs(s.x - 400);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(200);
  });
  it('fires 3-round bursts on a cooldown', () => {
    const s = foe('gunship', 540, 100);
    const shots: number[] = [];
    const dt = 0.01;
    for (let t = dt; t < 3.2; t += dt) {
      if (stepGunship(s, 400, 100, dt)) shots.push(t);
    }
    expect(shots).toHaveLength(6);
    for (const i of [1, 2, 4, 5]) {
      expect(shots[i] - shots[i - 1]).toBeGreaterThanOrEqual(0.12);
      expect(shots[i] - shots[i - 1]).toBeLessThanOrEqual(0.12 + dt + 1e-9);
    }
    expect(shots[3] - shots[2]).toBeGreaterThanOrEqual(2.5);
    expect(shots[3] - shots[2]).toBeLessThanOrEqual(2.5 + dt + 1e-9);
  });
});

describe('stepMchopper', () => {
  it('flees along the full 2D away vector and caps every step', () => {
    const scenarios = [
      { x: 400, y: 50, px: 400, py: 100 }, // vertical
      { x: 450, y: 50, px: 400, py: 100 }, // diagonal
    ];
    for (const c of scenarios) {
      const s = foe('mchopper', c.x, c.y);
      const initialDistance = Math.hypot(s.x - c.px, s.y - c.py);
      for (let i = 0; i < 120; i++) {
        stepMchopper(s, c.px, c.py, 1 / 60);
        expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(90 + 1e-6);
      }
      expect(Math.hypot(s.x - c.px, s.y - c.py)).toBeGreaterThan(initialDistance);
    }
  });
});

describe('stepAagun', () => {
  it('is static and fires on cadence', () => {
    const s = foe('aagun', 300, 140);
    let fires = 0;
    for (let i = 0; i < 60 * 5; i++) if (stepAagun(s, 400, 60, 1 / 60)) fires++;
    expect(s.x).toBe(300);
    expect(fires).toBeGreaterThanOrEqual(2);
  });
});

describe('stepTank', () => {
  it('patrols along the terrain surface', () => {
    const t = generateTerrain('inland', mulberry32(4));
    const span = t.lz[1]; // plateau
    const s = foe('tank', (span.x0 + span.x1) / 2, 0);
    for (let i = 0; i < 240; i++) stepTank(s, t, 100, 1 / 60);
    expect(Math.abs(s.y - (surfaceAt(t, s.x) - 4))).toBeLessThan(2);
  });

  it('reverses at both arena edges and never leaves the arena', () => {
    const t = generateTerrain('inland', mulberry32(4));
    for (const [x, dir] of [[0, -1], [960, 1]] as const) {
      const s = foe('tank', x, 0);
      s.dir = dir;
      stepTank(s, t, 100, 1 / 60);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(960);
      expect(s.dir).toBe(-dir);
    }
  });

  it('reverses at both ends of its flat plateau patrol span', () => {
    const t = generateTerrain('inland', mulberry32(4));
    const plateau = t.lz[1];
    const patrol = { x0: plateau.x0 + 9, x1: plateau.x1 - 9 };
    for (const [x, dir] of [[patrol.x0, -1], [patrol.x1, 1]] as const) {
      const s = foe('tank', x, 0) as Sub & { patrol?: typeof patrol };
      s.dir = dir;
      s.patrol = patrol;
      stepTank(s, t, 100, 1 / 60);
      expect(s.x).toBeGreaterThanOrEqual(patrol.x0);
      expect(s.x).toBeLessThanOrEqual(patrol.x1);
      expect(s.dir).toBe(-dir);
    }
  });
});
