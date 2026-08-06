import type { Phase } from '../game/state';

export type MusicState = 'menu' | 'combat-low' | 'combat-high' | 'low-health' | 'silent';

export interface MusicSnapshot {
  phase: Phase;
  pressure: number;
  healthRatio: number;
  muted: boolean;
  visible: boolean;
}

export class MusicStateMonitor {
  private combatState: 'combat-low' | 'combat-high' = 'combat-low';
  private highSamples = 0;
  private lowSamples = 0;

  sample(snapshot: MusicSnapshot): MusicState {
    if (snapshot.muted || !snapshot.visible) return 'silent';
    if (snapshot.phase === 'menu' || snapshot.phase === 'gameover') return 'menu';
    if (snapshot.phase === 'upgrade' || snapshot.phase === 'actIntro') return 'combat-low';
    if (snapshot.healthRatio < 0.3) return 'low-health';

    if (snapshot.pressure >= 6) {
      this.highSamples++;
      this.lowSamples = 0;
      if (this.highSamples >= 12) {
        this.combatState = 'combat-high';
        this.highSamples = 0;
      }
    } else if (snapshot.pressure <= 3) {
      this.lowSamples++;
      this.highSamples = 0;
      if (this.lowSamples >= 30) {
        this.combatState = 'combat-low';
        this.lowSamples = 0;
      }
    } else {
      this.highSamples = 0;
      this.lowSamples = 0;
    }
    return this.combatState;
  }
}
