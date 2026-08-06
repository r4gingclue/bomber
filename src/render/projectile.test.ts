import { expect, it } from 'vitest';
import { projectileHasTrail, projectileRotation, projectileVelocityAngle } from './projectile';

it('rotates right-facing projectile art directly along its velocity', () => {
  expect(projectileRotation('pmissile', 100, 0)).toBeCloseTo(0);
  expect(projectileRotation('pmissile', 0, 100)).toBeCloseTo(Math.PI / 2);
});

it('offsets upward-facing SAM art so its nose follows velocity', () => {
  expect(projectileRotation('sam', 100, 0)).toBeCloseTo(Math.PI / 2);
  expect(projectileRotation('sam', 0, -100)).toBeCloseTo(0);
});

it('keeps SAM trails on the physical velocity heading, without the art offset', () => {
  expect(projectileVelocityAngle(100, 0)).toBeCloseTo(0);
  expect(projectileVelocityAngle(0, -100)).toBeCloseTo(-Math.PI / 2);
});

it('omits the cosmetic trail from submarine SAMs', () => {
  expect(projectileHasTrail('sam')).toBe(false);
  expect(projectileHasTrail('pmissile')).toBe(true);
});
