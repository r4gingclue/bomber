import type { SpawnKind } from '../waves';

export interface Entity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Sub extends Entity {
  kind: SpawnKind;
  hp: number;
  dir: 1 | -1;
  fireTimer: number;
  surfaceTimer: number;
  surfaced: boolean;
  hitFlash: number;
}

export type DepthCharge = Entity;

export type ProjectileType = 'torpedo' | 'sam' | 'flak' | 'bullet';

export interface Projectile extends Entity {
  ptype: ProjectileType;
  age: number;
  life: number;
  damage: number;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  iframes: number;
  facing: 1 | -1;
  fireCd: number;
  pdCd: number;
  turretAngle: number;
  muzzleT: number;
}
