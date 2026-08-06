export type HelicopterPose = 'level' | 'accelerate' | 'brake' | 'climb' | 'descend';

const DISPLAY_SIZE = { width: 64, height: 32 } as const;

export function helicopterDisplaySize(): { width: number; height: number } {
  return DISPLAY_SIZE;
}

export function helicopterPose(vx: number, vy: number, facing: 1 | -1): HelicopterPose {
  if (vy < -70) return 'climb';
  if (vy > 70) return 'descend';
  const forward = vx * facing;
  if (forward > 70) return 'accelerate';
  if (forward < -70) return 'brake';
  return 'level';
}

export function shadowStyle(altitude: number): { alpha: number; scale: number; blur: number } {
  const t = Math.max(0, Math.min(1, altitude / 140));
  return {
    alpha: 0.34 - t * 0.22,
    scale: 0.55 + t * 0.65,
    blur: 2 + t * 8,
  };
}
