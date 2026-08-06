import { describe, it, expect } from 'vitest';
import { defaultStats } from './upgrades';

describe('stat application', () => {
  it('provides explicit baseline combat stats', () => {
    expect(defaultStats()).toEqual({
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
    });
  });
});
