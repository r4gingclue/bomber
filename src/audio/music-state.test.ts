import { expect, it } from 'vitest';
import { MusicStateMonitor, type MusicSnapshot } from './music-state';

const snapshot = (overrides: Partial<MusicSnapshot> = {}): MusicSnapshot => ({
  phase: 'playing', pressure: 2, healthRatio: 1, muted: false, visible: true, ...overrides,
});

it('selects immediate non-combat, danger, and silent states', () => {
  const state = new MusicStateMonitor();
  expect(state.sample(snapshot({ phase: 'menu' }))).toBe('menu');
  expect(state.sample(snapshot({ healthRatio: 0.29 }))).toBe('low-health');
  expect(state.sample(snapshot({ muted: true }))).toBe('silent');
  expect(state.sample(snapshot({ visible: false }))).toBe('silent');
  expect(state.sample(snapshot({ phase: 'upgrade' }))).toBe('combat-low');
  expect(state.sample(snapshot({ phase: 'actIntro' }))).toBe('combat-low');
});

it('requires sustained pressure and recovery to avoid oscillation', () => {
  const state = new MusicStateMonitor();
  for (let i = 0; i < 11; i++) expect(state.sample(snapshot({ pressure: 8 }))).toBe('combat-low');
  expect(state.sample(snapshot({ pressure: 8 }))).toBe('combat-high');
  for (let i = 0; i < 29; i++) expect(state.sample(snapshot({ pressure: 1 }))).toBe('combat-high');
  expect(state.sample(snapshot({ pressure: 1 }))).toBe('combat-low');
});
