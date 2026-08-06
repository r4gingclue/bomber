import { describe, it, expect } from 'vitest';
import { stepDepthCharge, steerHoming, clampSubDepth, stepPlayerVelocity } from './physics';
import { WATERLINE, SEA_BOTTOM } from '../consts';
import type { DepthCharge, Projectile, Sub } from './types';

const charge = (y: number, vy = 0): DepthCharge => ({ id: 1, x: 0, y, vx: 0, vy });

describe('stepDepthCharge', () => {
  it('accelerates downward above water', () => {
    const c = charge(50);
    stepDepthCharge(c, 34, 1 / 60);
    expect(c.vy).toBeGreaterThan(0);
  });
  it('converges to terminal sink speed underwater', () => {
    const c = charge(WATERLINE + 10, 200);
    for (let i = 0; i < 600; i++) stepDepthCharge(c, 34, 1 / 60);
    expect(c.vy).toBeCloseTo(34, 0);
  });
  it('keeps falling under gravity over land (wet=false)', () => {
    const c = charge(WATERLINE + 10, 50);
    stepDepthCharge(c, 34, 1 / 60, false);
    expect(c.vy).toBeGreaterThan(50);
  });
});

describe('steerHoming', () => {
  it('caps turn rate per step', () => {
    const p: Projectile = { id: 1, x: 0, y: 0, vx: 100, vy: 0, ptype: 'torpedo', age: 0, life: 5, damage: 20 };
    steerHoming(p, -100, 0, 100, 2.5, 1 / 60); // target directly behind
    const angle = Math.abs(Math.atan2(p.vy, p.vx));
    expect(angle).toBeLessThanOrEqual(2.5 / 60 + 1e-9);
    expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(100, 5);
  });
});

describe('stepPlayerVelocity', () => {
  it('preserves default terminal movement and scales it with speedScale', () => {
    const baseline = { vx: 0, vy: 0 };
    const faster = { vx: 0, vy: 0 };
    for (let i = 0; i < 600; i++) {
      stepPlayerVelocity(baseline, { x: 1, y: 0 }, 340, 1, 1, 1 / 60);
      stepPlayerVelocity(faster, { x: 1, y: 0 }, 340, 1.12, 1, 1 / 60);
    }

    expect(baseline.vx).toBeCloseTo(110.5236, 3);
    expect(faster.vx).toBeCloseTo(123.7864, 3);
    expect(faster.vy).toBe(0);
  });

  it('preserves default overspeed and decays it only through legacy drag', () => {
    const rebound = { vx: 0, vy: -140 };

    stepPlayerVelocity(rebound, { x: 0, y: 0 }, 340, 1, 1, 1 / 60);

    expect(rebound.vy).toBeCloseTo(-133.1721, 3);
  });

  it('damps only velocity perpendicular to non-zero input when handlingScale is lower', () => {
    const baseline = { vx: 20, vy: 100 };
    const improved = { vx: 20, vy: 100 };

    stepPlayerVelocity(baseline, { x: 1, y: 0 }, 340, 1, 1, 0.5);
    stepPlayerVelocity(improved, { x: 1, y: 0 }, 340, 1, 0.9, 0.5);

    expect(improved.vx).toBeCloseTo(baseline.vx, 8);
    expect(Math.abs(improved.vy)).toBeLessThan(Math.abs(baseline.vy));
  });

  it('adds no handling damping when input is zero', () => {
    const baseline = { vx: 40, vy: -25 };
    const improved = { vx: 40, vy: -25 };

    stepPlayerVelocity(baseline, { x: 0, y: 0 }, 340, 1, 1, 0.25);
    stepPlayerVelocity(improved, { x: 0, y: 0 }, 340, 1, 0.9, 0.25);

    expect(improved).toEqual(baseline);
  });
});

describe('clampSubDepth', () => {
  const sub = (y: number, vy: number): Sub =>
    ({ id: 1, x: 0, y, vx: 0, vy, kind: 'patrol', hp: 1, dir: 1, fireTimer: 0, surfaceTimer: 0, surfaced: false, hitFlash: 0 });
  it('bounces off the waterline ceiling', () => {
    const s = sub(WATERLINE + 2, -10);
    clampSubDepth(s);
    expect(s.y).toBeGreaterThanOrEqual(WATERLINE + 14);
    expect(s.vy).toBeGreaterThan(0);
  });
  it('bounces off the sea floor', () => {
    const s = sub(SEA_BOTTOM - 2, 10);
    clampSubDepth(s);
    expect(s.y).toBeLessThanOrEqual(SEA_BOTTOM - 10);
    expect(s.vy).toBeLessThan(0);
  });
});
