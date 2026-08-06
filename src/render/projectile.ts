import type { ProjectileType } from '../game/entities/types';

export function projectileRotation(type: ProjectileType, vx: number, vy: number): number {
  const velocityAngle = projectileVelocityAngle(vx, vy);
  return type === 'sam' ? velocityAngle + Math.PI / 2 : velocityAngle;
}

export function projectileVelocityAngle(vx: number, vy: number): number {
  return Math.atan2(vy, vx);
}

export function projectileHasTrail(type: ProjectileType): boolean {
  return type === 'pmissile';
}
