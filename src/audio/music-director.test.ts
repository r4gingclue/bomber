import { expect, it } from 'vitest';
import { MusicDirector, nextBarBoundary, type MusicScheduler } from './music-director';

function scheduler() {
  const starts: { name: string; at: number; duration: number }[] = [];
  const ramps: { name: string; value: number; duration: number }[] = [];
  const stingers: string[] = [];
  const api: MusicScheduler = {
    now: () => 10,
    startLoop: (name, _buffer, at, duration) => {
      starts.push({ name, at, duration });
      return { ramp: (value, _at, rampDuration) => ramps.push({ name, value, duration: rampDuration }), stop() {} };
    },
    playStinger: name => { stingers.push(name); },
  };
  return { api, starts, ramps, stingers };
}

it('starts every available stem on one shared timeline', () => {
  const fake = scheduler();
  const director = new MusicDirector(fake.api);
  director.start({ bed: {} as AudioBuffer, tension: {} as AudioBuffer }, 16);
  expect(fake.starts).toEqual([
    { name: 'bed', at: 10.05, duration: 16 },
    { name: 'tension', at: 10.05, duration: 16 },
  ]);
});

it('crossfades existing lanes without restarting and supports missing stems', () => {
  const fake = scheduler();
  const director = new MusicDirector(fake.api);
  director.start({ bed: {} as AudioBuffer, action: undefined }, 16);
  director.setState('combat-high');
  expect(fake.starts).toHaveLength(1);
  expect(fake.ramps).toContainEqual({ name: 'bed', value: 1, duration: 2 });
});

it('plays transition stingers without resetting loops', () => {
  const fake = scheduler();
  const director = new MusicDirector(fake.api);
  director.start({ bed: {} as AudioBuffer }, 16);
  director.stinger('wave-clear');
  expect(fake.stingers).toEqual(['wave-clear']);
  expect(fake.starts).toHaveLength(1);
});

it('keeps the bed quietly audible on the menu', () => {
  const fake = scheduler();
  const director = new MusicDirector(fake.api);
  director.start({ bed: {} as AudioBuffer }, 16);
  director.setState('menu');
  expect(fake.ramps).toContainEqual({ name: 'bed', value: 0.45, duration: 2 });
});

it('calculates the next shared bar boundary', () => {
  expect(nextBarBoundary(10.1, 120, 4)).toBe(12);
});
