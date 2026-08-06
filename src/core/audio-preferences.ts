export interface AudioPreferences {
  muted: boolean;
  music: number;
  sfx: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const AUDIO_PREFERENCES_KEY = 'sea-bomber.audio.v1';
export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  muted: false,
  music: 0.55,
  sfx: 0.8,
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function loadAudioPreferences(storage?: StorageLike): AudioPreferences {
  if (!storage) return { ...DEFAULT_AUDIO_PREFERENCES };
  try {
    const raw = storage.getItem(AUDIO_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_PREFERENCES };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_AUDIO_PREFERENCES.muted,
      music: typeof parsed.music === 'number' && Number.isFinite(parsed.music)
        ? clamp(parsed.music) : DEFAULT_AUDIO_PREFERENCES.music,
      sfx: typeof parsed.sfx === 'number' && Number.isFinite(parsed.sfx)
        ? clamp(parsed.sfx) : DEFAULT_AUDIO_PREFERENCES.sfx,
    };
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }
}

export function saveAudioPreferences(storage: StorageLike | undefined, value: AudioPreferences): void {
  if (!storage) return;
  try {
    storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing; audio still works in-memory.
  }
}
