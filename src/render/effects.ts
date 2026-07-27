import type { QualityTier } from './quality';

export interface EffectBudget {
  particles: number;
  debris: number;
  haze: boolean;
  reflections: boolean;
  animatedClouds: boolean;
  animatedWater: boolean;
  softShadows: boolean;
}

export interface BudgetedParticle {
  color: string;
  maxLife: number;
}

export type ParticleBudgetClass = 'particle' | 'debris';

export function effectBudget(tier: QualityTier): EffectBudget {
  if (tier === 'full') {
    return {
      particles: 320,
      debris: 80,
      haze: true,
      reflections: true,
      animatedClouds: true,
      animatedWater: true,
      softShadows: true,
    };
  }
  if (tier === 'reduced') {
    return {
      particles: 180,
      debris: 40,
      haze: true,
      reflections: false,
      animatedClouds: true,
      animatedWater: true,
      softShadows: false,
    };
  }
  return {
    particles: 80,
    debris: 16,
    haze: false,
    reflections: false,
    animatedClouds: false,
    animatedWater: false,
    softShadows: false,
  };
}

export function particleBudgetClass(particle: BudgetedParticle): ParticleBudgetClass {
  const isExplosionShard = particle.color !== '#3a3f46' && particle.maxLife === 0.8;
  return isExplosionShard ? 'debris' : 'particle';
}

export function budgetedParticlesOldestFirst<T extends BudgetedParticle>(
  particles: readonly T[],
  tier: QualityTier,
): T[] {
  const budget = effectBudget(tier);
  let particleCount = 0;
  let debrisCount = 0;
  const selected: T[] = [];

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    if (particleBudgetClass(particle) === 'debris') {
      if (debrisCount >= budget.debris) continue;
      debrisCount++;
    } else {
      if (particleCount >= budget.particles) continue;
      particleCount++;
    }
    selected.push(particle);
  }

  return selected.reverse();
}
