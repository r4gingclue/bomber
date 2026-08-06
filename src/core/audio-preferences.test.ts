import { describe, expect, it } from 'vitest';
import {
  AUDIO_PREFERENCES_KEY,
  DEFAULT_AUDIO_PREFERENCES,
  loadAudioPreferences,
  saveAudioPreferences,
  type StorageLike,
} from './audio-preferences';

function memoryStorage(initial?: string): StorageLike & { value: string | null } {
  return {
    value: initial ?? null,
    getItem() { return this.value; },
    setItem(_key, value) { this.value = value; },
  };
}

describe('audio preferences', () => {
  it('uses balanced defaults when storage is empty', () => {
    expect(loadAudioPreferences(memoryStorage())).toEqual({ muted: false, music: 0.55, sfx: 0.8 });
  });

  it('uses defaults for malformed JSON', () => {
    expect(loadAudioPreferences(memoryStorage('{bad'))).toEqual(DEFAULT_AUDIO_PREFERENCES);
  });

  it('clamps volumes and preserves valid partial fields', () => {
    const storage = memoryStorage(JSON.stringify({ muted: true, music: 4 }));
    expect(loadAudioPreferences(storage)).toEqual({ muted: true, music: 1, sfx: 0.8 });
  });

  it('saves under the versioned key and round-trips values', () => {
    let usedKey = '';
    const storage = memoryStorage();
    storage.setItem = (key, value) => { usedKey = key; storage.value = value; };
    saveAudioPreferences(storage, { muted: true, music: 0.25, sfx: 0.75 });

    expect(usedKey).toBe(AUDIO_PREFERENCES_KEY);
    expect(loadAudioPreferences(storage)).toEqual({ muted: true, music: 0.25, sfx: 0.75 });
  });
});
