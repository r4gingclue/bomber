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
    let shots = 0;
    for (let i = 0; i < 60 * 6; i++) if (stepGunship(s, 400, 100, 1 / 60)) shots++;
    expect(shots).toBeGreaterThanOrEqual(3);
    expect(shots).toBeLessThanOrEqual(9); // ≤ 2 bursts + margin in 6s
  });
});

describe('stepMchopper', () => {
  it('flees when the player closes within 100px, at speed ≤ 90', () => {
    const s = foe('mchopper', 450, 100);
    for (let i = 0; i < 120; i++) stepMchopper(s, 400, 100, 1 / 60);
    expect(Math.abs(s.x - 400)).toBeGreaterThan(50); // moved away
    expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(90 + 1e-6);
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
});
