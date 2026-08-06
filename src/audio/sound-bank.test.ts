import { expect, it } from 'vitest';
import { SoundBank } from './sound-bank';
import type { AudioManifest } from './manifest';

const base = {
  bus: 'sfx' as const, gain: 1, pitch: [1, 1] as [number, number], cooldownMs: 0,
  concurrency: 2, priority: 1, loop: false, fallback: 'fire' as const,
};

it('caches shared successful files and records optional variant failures', async () => {
  const fetched: string[] = [];
  const manifest = {
    cues: { 'cannon-fire': { ...base, variants: ['/ok.ogg', '/missing.ogg'] } },
    music: { low: { ...base, bus: 'music', variants: ['/ok.ogg'], loop: true } },
  } as AudioManifest;
  const bank = new SoundBank(manifest, async url => {
    fetched.push(url);
    if (url.includes('missing')) throw new Error('404');
    return new ArrayBuffer(1);
  }, async () => ({ duration: 1 } as AudioBuffer));

  await bank.loadSfx();
  await bank.loadMusic();

  expect(fetched.filter(url => url === '/ok.ogg')).toHaveLength(1);
  expect(bank.cue('cannon-fire').buffers).toHaveLength(1);
  expect(bank.warnings).toEqual(['Audio asset failed: /missing.ogg']);
});

it('keeps a wholly missing critical cue callable through its fallback', async () => {
  const manifest = {
    cues: { 'cannon-fire': { ...base, variants: ['/missing.ogg'] } }, music: {},
  } as AudioManifest;
  const bank = new SoundBank(manifest, async () => { throw new Error('404'); }, async () => ({} as AudioBuffer));
  await bank.loadSfx();

  expect(bank.cue('cannon-fire')).toMatchObject({ buffers: [], fallback: 'fire' });
});

it('does not load music during the initial SFX request', async () => {
  const fetched: string[] = [];
  const manifest = {
    cues: { 'cannon-fire': { ...base, variants: ['/fire.ogg'] } },
    music: { low: { ...base, bus: 'music', variants: ['/music.ogg'], loop: true } },
  } as AudioManifest;
  const bank = new SoundBank(manifest, async url => { fetched.push(url); return new ArrayBuffer(1); }, async () => ({} as AudioBuffer));

  await bank.loadSfx();
  expect(fetched).toEqual(['/fire.ogg']);
});
