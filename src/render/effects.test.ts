import { expect, it } from 'vitest';
import {
  budgetedParticlesOldestFirst,
  effectBudget,
  particleBudgetClass,
} from './effects';

it('reduces cosmetics while retaining hit feedback', () => {
  expect(effectBudget('full')).toEqual({
    particles: 320,
    debris: 80,
    haze: true,
    reflections: true,
    animatedClouds: true,
    animatedWater: true,
    softShadows: true,
  });
  expect(effectBudget('minimum')).toEqual({
    particles: 80,
    debris: 16,
    haze: false,
    reflections: false,
    animatedClouds: false,
    animatedWater: false,
    softShadows: false,
  });
  expect(effectBudget('reduced')).toEqual({
    particles: 180,
    debris: 40,
    haze: true,
    reflections: false,
    animatedClouds: true,
    animatedWater: true,
    softShadows: false,
  });
});

it('separates explosion debris from other particles', () => {
  expect(particleBudgetClass({ color: '#ffb347', maxLife: 0.8 })).toBe('debris');
  expect(particleBudgetClass({ color: '#9fd8ff', maxLife: 0.8 })).toBe('debris');
  expect(particleBudgetClass({ color: '#3a3f46', maxLife: 0.8 })).toBe('particle');
  expect(particleBudgetClass({ color: '#cfe8ff', maxLife: 0.5 })).toBe('particle');
  expect(particleBudgetClass({ color: '#ff9a44', maxLife: 0.25 })).toBe('particle');
});

it('selects newest feedback but draws the selected particles oldest-first', () => {
  const particles = Array.from({ length: 400 }, (_, id) => ({
    id,
    color: id % 2 === 0 ? '#cfe8ff' : '#ffb347',
    maxLife: id % 2 === 0 ? 0.5 : 0.8,
  }));
  const selected = budgetedParticlesOldestFirst(particles, 'minimum');
  const debris = selected.filter(p => particleBudgetClass(p) === 'debris');
  const cosmetics = selected.filter(p => particleBudgetClass(p) === 'particle');

  expect(debris).toHaveLength(16);
  expect(cosmetics).toHaveLength(80);
  expect(debris.map(p => p.id)).toEqual(Array.from({ length: 16 }, (_, i) => 369 + i * 2));
  expect(cosmetics.map(p => p.id)).toEqual(Array.from({ length: 80 }, (_, i) => 240 + i * 2));
  expect(selected.at(-1)?.id).toBe(399);
});
