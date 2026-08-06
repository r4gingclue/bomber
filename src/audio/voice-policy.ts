import type { AudioCueSpec } from './manifest';

export interface VoiceDecision {
  variant: number;
  pitch: number;
  gain: number;
  replaceId?: string;
}

interface ActiveVoice {
  id: string;
  cue: string;
  priority: number;
  critical: boolean;
  startedAt: number;
}

export class VoicePolicy {
  private readonly active = new Map<string, ActiveVoice>();
  private readonly lastPlayed = new Map<string, number>();

  constructor(
    private readonly globalLimit = 32,
    private readonly now: () => number = () => performance.now(),
    private readonly random: () => number = Math.random,
  ) {}

  request(cueName: string, cue: AudioCueSpec): VoiceDecision | null {
    const now = this.now();
    const last = this.lastPlayed.get(cueName);
    if (last !== undefined && now - last < cue.cooldownMs) return null;

    const sameCue = [...this.active.values()].filter(voice => voice.cue === cueName);
    let replace: ActiveVoice | undefined;
    if (sameCue.length >= cue.concurrency) replace = this.oldestReplaceable(sameCue, cue.priority);
    if (sameCue.length >= cue.concurrency && !replace) return null;
    if (this.active.size >= this.globalLimit && !replace) {
      replace = this.oldestReplaceable([...this.active.values()], cue.priority);
      if (!replace) return null;
    }

    this.lastPlayed.set(cueName, now);
    const variant = Math.min(cue.variants.length - 1, Math.floor(this.random() * cue.variants.length));
    const pitch = cue.pitch[0] + (cue.pitch[1] - cue.pitch[0]) * this.random();
    const gain = cue.gain * (0.9 + this.random() * 0.2);
    return { variant, pitch, gain, ...(replace ? { replaceId: replace.id } : {}) };
  }

  start(id: string, cue: string, priority: number, critical: boolean): void {
    this.active.set(id, { id, cue, priority, critical, startedAt: this.now() });
  }

  end(id: string): void {
    this.active.delete(id);
  }

  private oldestReplaceable(voices: ActiveVoice[], incomingPriority: number): ActiveVoice | undefined {
    return voices
      .filter(voice => !voice.critical && voice.priority <= incomingPriority)
      .sort((a, b) => a.startedAt - b.startedAt)[0];
  }
}
