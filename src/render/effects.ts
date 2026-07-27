import type { QualityTier } from './quality';

export function effectBudget(tier: QualityTier): {
  particles: number;
  debris: number;
  haze: boolean;
  reflections: boolean;
} {
  if (tier === 'full') return { particles: 320, debris: 80, haze: true, reflections: true };
  if (tier === 'reduced') return { particles: 180, debris: 40, haze: true, reflections: false };
  return { particles: 80, debris: 16, haze: false, reflections: false };
}
