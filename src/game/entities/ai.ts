import type { Sub } from './types';
import { surfaceAt, type Terrain } from '../terrain';
import { ARENA_W } from '../consts';

const cap = (s: Sub, max: number) => {
  const v = Math.hypot(s.vx, s.vy);
  if (v > max) {
    s.vx = (s.vx / v) * max;
    s.vy = (s.vy / v) * max;
  }
};

/** kamikaze: accelerate straight at the player, speed cap 130 */
export function stepScout(s: Sub, px: number, py: number, dt: number): void {
  const d = Math.hypot(px - s.x, py - s.y) || 1;
  s.vx += ((px - s.x) / d) * 260 * dt;
  s.vy += ((py - s.y) / d) * 260 * dt;
  cap(s, 130);
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.dir = s.vx >= 0 ? 1 : -1;
}

/** hover-strafe: hold ~140px horizontal standoff, match altitude, 3-round bursts.
 * surfaceTimer counts remaining shots in the current burst. */
export function stepGunship(s: Sub, px: number, py: number, dt: number): boolean {
  const dx = px - s.x;
  const want = Math.abs(dx) > 140 ? Math.sign(dx) : -Math.sign(dx);
  s.vx += want * 180 * dt;
  s.vy += Math.sign(py - s.y) * 120 * dt;
  cap(s, 100);
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.dir = dx >= 0 ? 1 : -1;
  s.fireTimer -= dt;
  if (s.fireTimer <= 0) {
    if (s.surfaceTimer <= 0) s.surfaceTimer = 3;
    s.surfaceTimer -= 1;
    s.fireTimer = s.surfaceTimer > 0 ? 0.12 : 2.5;
    return true;
  }
  return false;
}

/** missile chopper: keep ~220px range, flee at 90 when closer than 100, lob homing shots */
export function stepMchopper(s: Sub, px: number, py: number, dt: number): boolean {
  const dx = px - s.x;
  const dy = py - s.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 100) {
    const away = dist || 1;
    s.vx += (-dx / away) * 240 * dt;
    s.vy += (-dy / away) * 240 * dt;
    cap(s, 90); // MUST stay below player max (~113): guardrail
  } else {
    const want = dist > 220 ? Math.sign(dx) : dist < 180 ? -Math.sign(dx) : 0;
    s.vx += want * 140 * dt;
    s.vy += Math.sign(py - s.y) * 80 * dt;
    cap(s, 80);
  }
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.dir = dx >= 0 ? 1 : -1;
  s.fireTimer -= dt;
  if (s.fireTimer <= 0 && dist >= 100) {
    s.fireTimer = 4;
    return true;
  }
  return false;
}

/** fixed AA emplacement */
export function stepAagun(s: Sub, _px: number, _py: number, dt: number): boolean {
  s.fireTimer -= dt;
  if (s.fireTimer <= 0) {
    s.fireTimer = 2.2;
    return true;
  }
  return false;
}

/** tank: patrol horizontally, glued to the terrain surface, reverse at its limits or slope > 6px */
export function stepTank(s: Sub, t: Terrain, _px: number, dt: number): boolean {
  const minX = Math.max(0, s.patrol?.x0 ?? 0);
  const maxX = Math.min(ARENA_W, s.patrol?.x1 ?? ARENA_W);
  const nx = s.x + s.dir * 20 * dt;
  const drop = Math.abs(surfaceAt(t, nx + s.dir * 10) - surfaceAt(t, s.x));
  if (nx < minX || nx > maxX || drop > 6) {
    s.x = Math.max(minX, Math.min(maxX, s.x));
    s.dir = s.dir === 1 ? -1 : 1;
  } else s.x = nx;
  s.y = surfaceAt(t, s.x) - 4;
  s.vx = s.dir * 20;
  s.fireTimer -= dt;
  if (s.fireTimer <= 0) {
    s.fireTimer = 3;
    return true;
  }
  return false;
}
