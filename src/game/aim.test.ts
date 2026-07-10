import { describe, it, expect } from 'vitest';
import { angleTo, easeAngle, bankFrame, aimFromStick } from './aim';

describe('angleTo', () => {
  it('points right at 0', () => {
    expect(angleTo(0, 0, 10, 0)).toBeCloseTo(0);
  });
  it('points down at +PI/2 (canvas y grows downward)', () => {
    expect(angleTo(0, 0, 0, 10)).toBeCloseTo(Math.PI / 2);
  });
  it('points left at PI', () => {
    expect(Math.abs(angleTo(5, 5, -10, 5))).toBeCloseTo(Math.PI);
  });
});

describe('easeAngle', () => {
  it('steps toward target without overshooting', () => {
    expect(easeAngle(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(easeAngle(0.9, 1, 0.25)).toBeCloseTo(1);
  });
  it('takes the short way across the ±PI boundary', () => {
    const a = easeAngle(3.0, -3.0, 0.2); // short way is +0.2 (wrapping past PI)
    expect(a).toBeCloseTo(-Math.PI * 2 + 3.2, 5); // 3.2 wrapped into (-PI, PI]
  });
  it('stays within (-PI, PI]', () => {
    let a = 3.1;
    for (let i = 0; i < 20; i++) a = easeAngle(a, -3.1, 0.3);
    expect(a).toBeGreaterThan(-Math.PI - 1e-9);
    expect(a).toBeLessThanOrEqual(Math.PI + 1e-9);
    expect(Math.cos(a)).toBeCloseTo(Math.cos(-3.1), 1);
  });
});

describe('bankFrame', () => {
  it('selects by |vx| thresholds 30/90', () => {
    expect(bankFrame(0)).toBe(0);
    expect(bankFrame(-29)).toBe(0);
    expect(bankFrame(30)).toBe(1);
    expect(bankFrame(-89)).toBe(1);
    expect(bankFrame(90)).toBe(2);
    expect(bankFrame(-300)).toBe(2);
  });
});

describe('aimFromStick', () => {
  it('returns null inside the deadzone', () => {
    expect(aimFromStick(100, 50, 3, -3)).toBeNull();
  });
  it('projects a point 200px from the player along the stick direction', () => {
    const p = aimFromStick(100, 50, 40, 0)!;
    expect(p.x).toBeCloseTo(300);
    expect(p.y).toBeCloseTo(50);
    const q = aimFromStick(0, 0, 0, -30)!;
    expect(q.x).toBeCloseTo(0);
    expect(q.y).toBeCloseTo(-200);
  });
});
