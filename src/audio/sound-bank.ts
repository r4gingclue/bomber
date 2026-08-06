import type { AudioEvent, ProceduralAudioKind } from '../core/audio-events';
import type { AudioCueSpec, AudioManifest } from './manifest';

type FetchAudio = (url: string) => Promise<ArrayBuffer>;
type DecodeAudio = (data: ArrayBuffer) => Promise<AudioBuffer>;

export interface LoadedCue extends AudioCueSpec {
  buffers: AudioBuffer[];
  fallback?: ProceduralAudioKind;
}

export class SoundBank {
  readonly warnings: string[] = [];
  private readonly cache = new Map<string, Promise<AudioBuffer>>();
  private readonly cues = new Map<string, LoadedCue>();

  constructor(
    private readonly manifest: AudioManifest,
    private readonly fetchAudio: FetchAudio,
    private readonly decodeAudio: DecodeAudio,
  ) {}

  async loadSfx(): Promise<void> {
    await this.loadGroup(Object.entries(this.manifest.cues));
  }

  async loadMusic(): Promise<void> {
    await this.loadGroup(Object.entries(this.manifest.music).map(([name, spec]) => [`music:${name}`, spec]));
  }

  cue(event: AudioEvent): LoadedCue {
    const loaded = this.cues.get(event);
    if (loaded) return loaded;
    const spec = this.manifest.cues[event];
    if (!spec) throw new Error(`Unknown audio cue: ${event}`);
    return { ...spec, variants: [...spec.variants], pitch: [...spec.pitch], buffers: [] };
  }

  music(name: string): LoadedCue | undefined {
    return this.cues.get(`music:${name}`);
  }

  private async loadGroup(entries: [string, AudioCueSpec][]): Promise<void> {
    await Promise.all(entries.map(async ([name, spec]) => {
      const settled = await Promise.allSettled(spec.variants.map(url => this.loadUrl(url)));
      const buffers: AudioBuffer[] = [];
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') buffers.push(result.value);
        else this.warnings.push(`Audio asset failed: ${spec.variants[index]}`);
      });
      this.cues.set(name, { ...spec, variants: [...spec.variants], pitch: [...spec.pitch], buffers });
    }));
  }

  private loadUrl(url: string): Promise<AudioBuffer> {
    let pending = this.cache.get(url);
    if (!pending) {
      pending = this.fetchAudio(url).then(data => this.decodeAudio(data));
      this.cache.set(url, pending);
    }
    return pending;
  }
}
