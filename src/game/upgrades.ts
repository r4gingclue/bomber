export interface PlayerStats {
  maxHp: number;
  accel: number;
  speedScale: number;
  handlingScale: number;
  blastRadius: number;
  chargeDamage: number;
  maxCharges: number;
  sinkSpeed: number;
  cannonCooldown: number;
  cannonDamage: number;
  cannonPierce: number;
  cannonShots: number;
  missileCap: number;
  missileRefill: number;
  missileSteering: number;
  missileAcquireScale: number;
  dualDrop: boolean;
  magnetic: boolean;
  sonar: boolean;
  sonarInterval: number;
  pointDefense: boolean;
  pointDefenseCooldown: number;
  fieldRepair: number;
}

export function defaultStats(): PlayerStats {
  return {
    maxHp: 100,
    accel: 340,
    speedScale: 1,
    handlingScale: 1,
    blastRadius: 26,
    chargeDamage: 24,
    maxCharges: 2,
    sinkSpeed: 34,
    cannonCooldown: 0.12,
    cannonDamage: 8,
    cannonPierce: 0,
    cannonShots: 1,
    missileCap: 0,
    missileRefill: 1,
    missileSteering: 1,
    missileAcquireScale: 1,
    dualDrop: false,
    magnetic: false,
    sonar: false,
    sonarInterval: 8,
    pointDefense: false,
    pointDefenseCooldown: 0.4,
    fieldRepair: 0,
  };
}
