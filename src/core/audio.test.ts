import { expect, it } from 'vitest';
import { AudioSys, type AudioBusControls } from './audio';
import type { StorageLike } from './audio-preferences';

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
