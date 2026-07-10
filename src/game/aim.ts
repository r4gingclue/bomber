/** Angle from (px,py) to (ax,ay) in radians, canvas convention (y down). */
export function angleTo(px: number, py: number, ax: number, ay: number): number {
  return Math.atan2(ay - py, ax - px);
}

/** Move `current` toward `target` by at most `maxStep`, taking the short way
 * around the circle. Result normalized to (-PI, PI]. */
export function easeAngle(current: number, target: number, maxStep: number): number {
  let d = target - current;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  let a = current + Math.max(-maxStep, Math.min(maxStep, d));
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Bank sprite row from horizontal speed: 0 level, 1 lean, 2 hard. */
export function bankFrame(vx: number): 0 | 1 | 2 {
  const s = Math.abs(vx);
  return s < 30 ? 0 : s < 90 ? 1 : 2;
}

/** Convert an aim-stick displacement into a world aim point `dist` px from
 * the player. Returns null inside the 8px deadzone. */
export function aimFromStick(
  px: number, py: number, dx: number, dy: number, dist = 200,
): { x: number; y: number } | null {
  const len = Math.hypot(dx, dy);
  if (len < 8) return null;
  return { x: px + (dx / len) * dist, y: py + (dy / len) * dist };
}
