import { expect, it } from 'vitest';
import { QualityMonitor } from './quality';

it('steps down from sustained rolling delivered-frame pressure', () => {
  const q = new QualityMonitor();
  const mixedDelivery = [28, 28, 12];
  for (let i = 0; i < 89; i++) q.sample(mixedDelivery[i % mixedDelivery.length]);
  expect(q.tier).toBe('full');
  q.sample(mixedDelivery[89 % mixedDelivery.length]);
  expect(q.tier).toBe('reduced');
});

it('does not step down for one long frame inside an otherwise healthy window', () => {
  const q = new QualityMonitor();
  for (let i = 0; i < 180; i++) q.sample(i === 30 ? 80 : 16);
  expect(q.tier).toBe('full');
});

it('uses longer fast-frame hysteresis before recovering', () => {
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

it('ignores invalid delivery intervals and can reset after lifecycle pauses', () => {
  const q = new QualityMonitor();
  q.sample(Number.NaN);
  q.sample(0);
  for (let i = 0; i < 89; i++) q.sample(30);
  q.reset();
  q.sample(30);
  expect(q.tier).toBe('full');
  expect(q.pressure).toBeGreaterThan(1);
});
