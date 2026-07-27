import { expect, it } from 'vitest';
import { QualityMonitor } from './quality';

it('steps down only after sustained slow frames', () => {
  const q = new QualityMonitor();
  for (let i = 0; i < 89; i++) q.sample(25);
  expect(q.tier).toBe('full');
  q.sample(25);
  expect(q.tier).toBe('reduced');
});

it('does not oscillate after a short recovery', () => {
  const q = new QualityMonitor('reduced');
  for (let i = 0; i < 239; i++) q.sample(12);
  expect(q.tier).toBe('reduced');
  q.sample(12);
  expect(q.tier).toBe('full');
});

it('never drops more than one tier per pressure window', () => {
  const q = new QualityMonitor();
  for (let i = 0; i < 90; i++) q.sample(40);
  expect(q.tier).toBe('reduced');
});
