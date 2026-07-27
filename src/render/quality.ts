export type QualityTier = 'full' | 'reduced' | 'minimum';

export class QualityMonitor {
  private slow = 0;
  private fast = 0;
  constructor(public tier: QualityTier = 'full') {}

  sample(ms: number): QualityTier {
    if (ms > 21) { this.slow++; this.fast = 0; }
    else if (ms < 15) { this.fast++; this.slow = 0; }
    else { this.slow = 0; this.fast = 0; }
    if (this.slow >= 90) {
      this.tier = this.tier === 'full' ? 'reduced' : 'minimum';
      this.slow = 0;
    } else if (this.fast >= 240) {
      this.tier = this.tier === 'minimum' ? 'reduced' : 'full';
      this.fast = 0;
    }
    return this.tier;
  }
}
