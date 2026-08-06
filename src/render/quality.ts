export type QualityTier = 'full' | 'reduced' | 'minimum';

const TARGET_FRAME_MS = 1000 / 60;
const WINDOW_SIZE = 60;
const STEP_DOWN_AFTER_SAMPLES = 90;
const STEP_UP_AFTER_SAMPLES = 240;
const SLOW_PRESSURE = 21 / TARGET_FRAME_MS;
const FAST_PRESSURE = 15 / TARGET_FRAME_MS;
const MAX_DELIVERED_FRAME_MS = 100;

/**
 * Tracks pressure from delivered animation-frame intervals. Each decision uses
 * a rolling one-second window, then requires sustained pressure with wider
 * recovery hysteresis before changing a cosmetic tier.
 */
export class QualityMonitor {
  private samples: number[] = [];
  private sum = 0;
  private slowWindows = 0;
  private fastWindows = 0;

  constructor(public tier: QualityTier = 'full') {}

  get pressure(): number {
    if (this.samples.length === 0) return 1;
    return (this.sum / this.samples.length) / TARGET_FRAME_MS;
  }

  sample(deliveredFrameMs: number): QualityTier {
    if (!Number.isFinite(deliveredFrameMs) || deliveredFrameMs <= 0) return this.tier;
    const sample = Math.min(deliveredFrameMs, MAX_DELIVERED_FRAME_MS);
    this.samples.push(sample);
    this.sum += sample;
    if (this.samples.length > WINDOW_SIZE) {
      this.sum -= this.samples.shift()!;
    }
    if (this.samples.length < WINDOW_SIZE) return this.tier;

    if (this.pressure > SLOW_PRESSURE) {
      this.slowWindows++;
      this.fastWindows = 0;
    } else if (this.pressure < FAST_PRESSURE) {
      this.fastWindows++;
      this.slowWindows = 0;
    } else {
      this.slowWindows = 0;
      this.fastWindows = 0;
    }

    const slowWindowTarget = STEP_DOWN_AFTER_SAMPLES - WINDOW_SIZE + 1;
    const fastWindowTarget = STEP_UP_AFTER_SAMPLES - WINDOW_SIZE + 1;
    if (this.slowWindows >= slowWindowTarget) {
      this.tier = this.tier === 'full' ? 'reduced' : 'minimum';
      this.resetWindow();
    } else if (this.fastWindows >= fastWindowTarget) {
      this.tier = this.tier === 'minimum' ? 'reduced' : 'full';
      this.resetWindow();
    }
    return this.tier;
  }

  reset(): void {
    this.resetWindow();
  }

  private resetWindow(): void {
    this.samples = [];
    this.sum = 0;
    this.slowWindows = 0;
    this.fastWindows = 0;
  }
}
