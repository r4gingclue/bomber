import { expect, it } from 'vitest';
import {
  budgetedParticlesNewestFirst,
  effectBudget,
  particleBudgetClass,
} from './effects';

it('reduces cosmetics while retaining hit feedback', () => {
  expect(effectBudget('full')).toEqual({
    particles: 320,
    debris: 80,
    haze: true,
    reflections: true,
  });
  expect(effectBudget('minimum')).toEqual({
    particles: 80,
    debris: 16,
    haze: false,
    reflections: false,
  });
  expect(effectBudget('reduced')).toEqual({
    particles: 180,
    debris: 40,
    haze: true,
    reflections: false,
  });
});

it('separates explosion debris from other particles', () => {
  expect(particleBudgetClass({ color: '#ffb347', maxLife: 0.8 })).toBe('debris');
  expect(particleBudgetClass({ color: '#9fd8ff', maxLife: 0.8 })).toBe('debris');
  expect(particleBudgetClass({ color: '#3a3f46', maxLife: 0.8 })).toBe('particle');
  expect(particleBudgetClass({ color: '#cfe8ff', maxLife: 0.5 })).toBe('particle');
  expect(particleBudgetClass({ color: '#ff9a44', maxLife: 0.25 })).toBe('particle');
});

it('clamps each category newest-first at minimum quality', () => {
  const particles = Array.from({ length: 400 }, (_, id) => ({
    id,
    color: id % 2 === 0 ? '#cfe8ff' : '#ffb347',
    maxLife: id % 2 === 0 ? 0.5 : 0.8,
  }));
  const selected = budgetedParticlesNewestFirst(particles, 'minimum');
  const debris = selected.filter(p => particleBudgetClass(p) === 'debris');
  const cosmetics = selected.filter(p => particleBudgetClass(p) === 'particle');

  expect(debris).toHaveLength(16);
  expect(cosmetics).toHaveLength(80);
  expect(debris.map(p => p.id)).toEqual(Array.from({ length: 16 }, (_, i) => 399 - i * 2));
  expect(cosmetics.map(p => p.id)).toEqual(Array.from({ length: 80 }, (_, i) => 398 - i * 2));
});
