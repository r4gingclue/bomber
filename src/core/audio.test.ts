import { expect, it } from 'vitest';
import { AudioSys, type AudioBusControls } from './audio';
import type { StorageLike } from './audio-preferences';
import { SoundBank } from '../audio/sound-bank';
import type { AudioManifest } from '../audio/manifest';
import { MusicDirector, type MusicScheduler } from '../audio/music-director';

function memoryStorage(): StorageLike {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
  };
}

it('controls master, music, and SFX buses independently', () => {
  const levels = { master: -1, music: -1, sfx: -1 };
  const buses: AudioBusControls = {
    setMaster: value => { levels.master = value; },
    setMusic: value => { levels.music = value; },
    setSfx: value => { levels.sfx = value; },
  };
  const audio = new AudioSys(memoryStorage(), buses);

  expect(levels).toEqual({ master: 1, music: 0.55, sfx: 0.8 });
  audio.setMusicVolume(0.2);
  expect(levels).toEqual({ master: 1, music: 0.2, sfx: 0.8 });
  audio.setSfxVolume(0.4);
  expect(levels).toEqual({ master: 1, music: 0.2, sfx: 0.4 });
  audio.toggleMute();
  expect(levels).toEqual({ master: 0, music: 0.2, sfx: 0.4 });
  expect(audio.preferences).toEqual({ muted: true, music: 0.2, sfx: 0.4 });
});

function fakeContext() {
  const starts: AudioBuffer[] = [];
  let resumes = 0;
  let suspends = 0;
  const gain = () => ({
    gain: {
      value: 1,
      setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {},
    },
    connect() {},
  });
  const context = {
    state: 'running', currentTime: 1, sampleRate: 48000, destination: {},
    createGain: gain,
    createBufferSource: () => ({
      buffer: null as AudioBuffer | null, playbackRate: { value: 1 }, connect() {},
      start() { starts.push(this.buffer!); }, stop() {}, onended: null as (() => void) | null,
    }),
    createOscillator: () => ({ type: 'sine', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(1) }),
    createBiquadFilter: () => ({ type: 'lowpass', frequency: { value: 0 }, connect() {} }),
    resume: async () => { resumes++; },
    suspend: async () => { suspends++; },
  } as unknown as AudioContext;
  return { context, starts, get resumes() { return resumes; }, get suspends() { return suspends; } };
}

it('creates and resumes its context idempotently and retries creation failures', async () => {
  const fake = fakeContext();
  let attempts = 0;
  const audio = new AudioSys(memoryStorage(), undefined, {
    createContext: () => {
      attempts++;
      if (attempts === 1) throw new Error('blocked');
      return fake.context;
    },
    setInterval: () => 1,
  });

  await audio.resume();
  expect(audio.ready).toBe(false);
  await audio.resume();
  await audio.resume();
  expect(audio.ready).toBe(true);
  expect(attempts).toBe(2);
});

it('plays a decoded cue and falls back procedurally when its buffer is missing', async () => {
  const decoded = { duration: 1 } as AudioBuffer;
  const manifest = {
    cues: {
      'cannon-fire': { variants: ['/fire.ogg'], bus: 'sfx', gain: 0.8, pitch: [1, 1], cooldownMs: 0, concurrency: 2, priority: 1, loop: false, fallback: 'fire' },
      'sonar-ping': { variants: ['/missing.ogg'], bus: 'sfx', gain: 0.8, pitch: [1, 1], cooldownMs: 0, concurrency: 2, priority: 10, loop: false, fallback: 'ping' },
    }, music: {},
  } as AudioManifest;
  const bank = new SoundBank(manifest, async url => {
    if (url.includes('missing')) throw new Error('404');
    return new ArrayBuffer(1);
  }, async () => decoded);
  await bank.loadSfx();
  const fake = fakeContext();
  const audio = new AudioSys(memoryStorage(), undefined, {
    createContext: () => fake.context, setInterval: () => 1, bank,
  });
  await audio.resume();

  audio.handle('cannon-fire');
  audio.handle('sonar-ping');
  expect(fake.starts).toContain(decoded);
});

it('suspends continuous audio while hidden and resumes when visible', async () => {
  const fake = fakeContext();
  const audio = new AudioSys(memoryStorage(), undefined, {
    createContext: () => fake.context, setInterval: () => 1,
  });
  await audio.resume();
  await audio.setHidden(true);
  await audio.setHidden(false);
  expect(fake.suspends).toBe(1);
  expect(fake.resumes).toBe(1);
});

it('applies adaptive music state without changing the saved music volume', () => {
  let musicLevel = -1;
  const audio = new AudioSys(memoryStorage(), {
    setMaster() {}, setMusic: value => { musicLevel = value; }, setSfx() {},
  });
  const snapshot = { phase: 'playing' as const, pressure: 8, healthRatio: 1, muted: false, visible: true };
  for (let i = 0; i < 12; i++) audio.updateMusic(snapshot);
  expect(audio.musicState).toBe('combat-high');
  audio.updateMusic({ ...snapshot, visible: false });
  expect(audio.musicState).toBe('silent');
  expect(musicLevel).toBe(0);
  expect(audio.preferences.music).toBe(0.55);
});

it('loads decoded adaptive stems and starts them on the shared timeline', async () => {
  const bed = { duration: 60 } as AudioBuffer;
  const tension = { duration: 60 } as AudioBuffer;
  const rotor = { duration: 4 } as AudioBuffer;
  const wind = { duration: 4 } as AudioBuffer;
  const musicSpec = (url: string) => ({
    variants: [url], bus: 'music' as const, gain: 0.8, pitch: [1, 1] as [number, number],
    cooldownMs: 0, concurrency: 1, priority: 1, loop: true,
  });
  const bank = new SoundBank({
    cues: {}, music: {
      bed: musicSpec('/bed.ogg'), tension: musicSpec('/tension.ogg'),
      rotor: musicSpec('/rotor.ogg'), 'ocean-wind': musicSpec('/wind.ogg'),
    },
    musicFamily: { bpm: 128, beatsPerBar: 4, bars: 32, loopDuration: 60, stems: ['bed', 'tension'] },
  }, async url => new TextEncoder().encode(url).buffer, async data => {
    const url = new TextDecoder().decode(data);
    if (url.includes('bed')) return bed;
    if (url.includes('rotor')) return rotor;
    if (url.includes('wind')) return wind;
    return tension;
  });
  const starts: string[] = [];
  const scheduler: MusicScheduler = {
    now: () => 4,
    startLoop: (name) => {
      starts.push(name);
      return { ramp() {}, stop() {} };
    },
    playStinger() {},
  };
  const fake = fakeContext();
  const audio = new AudioSys(memoryStorage(), undefined, {
    createContext: () => fake.context,
    setInterval: () => 1,
    createBank: () => bank,
    createDirector: () => new MusicDirector(scheduler),
  });

  await audio.resume();
  await audio.loadMusic();
  expect(starts).toEqual(['bed', 'tension']);
  expect(fake.starts).toEqual(expect.arrayContaining([rotor, wind]));
});
