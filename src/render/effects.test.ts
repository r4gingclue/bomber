import { expect, it } from 'vitest';
import { effectBudget } from './effects';

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
});
