import { WATERLINE, SEA_BOTTOM } from '../consts';
import type { DepthCharge, Projectile, Sub } from './types';

const AIR_GRAVITY = 320;
const PLAYER_DRAG = 3;

export function stepPlayerVelocity(
  body: { vx: number; vy: number },
  move: { x: number; y: number },
  accel: number,
  speedScale: number,
  handlingScale: number,
  dt: number,
): void {
  body.vx += move.x * accel * speedScale * dt;
  body.vy += move.y * accel * speedScale * dt;
  const drag = Math.exp(-PLAYER_DRAG * dt);
  body.vx *= drag;
  body.vy *= drag;

  const rawMagnitude = Math.hypot(move.x, move.y);
  const inputMagnitude = Math.min(1, rawMagnitude);
  if (inputMagnitude === 0 || handlingScale >= 1) return;
  const ux = move.x / rawMagnitude;
  const uy = move.y / rawMagnitude;
  const parallel = body.vx * ux + body.vy * uy;
  const perpendicularX = body.vx - parallel * ux;
  const perpendicularY = body.vy - parallel * uy;
  const handlingDamping = Math.pow(Math.max(0, handlingScale), dt * inputMagnitude);
  body.vx = parallel * ux + perpendicularX * handlingDamping;
  body.vy = parallel * uy + perpendicularY * handlingDamping;
}

export function stepDepthCharge(c: DepthCharge, sinkSpeed: number, dt: number, wet = true): void {
  if (!wet || c.y < WATERLINE) {
    c.vy += AIR_GRAVITY * dt;
  } else {
    c.vy += (sinkSpeed - c.vy) * 4 * dt;
    c.vx *= Math.exp(-2 * dt);
  }
  c.x += c.vx * dt;
  c.y += c.vy * dt;
}

export function steerHoming(
  p: Projectile, tx: number, ty: number,
  speed: number, turnRate: number, dt: number,
): void {
  const cur = Math.atan2(p.vy, p.vx);
  const want = Math.atan2(ty - p.y, tx - p.x);
  let d = want - cur;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const max = turnRate * dt;
  const a = cur + Math.max(-max, Math.min(max, d));
  p.vx = Math.cos(a) * speed;
  p.vy = Math.sin(a) * speed;
}

export function clampSubDepth(s: Sub): void {
  const top = WATERLINE + 14;
  const bot = SEA_BOTTOM - 10;
  if (s.y < top) { s.y = top; s.vy = Math.abs(s.vy); }
  if (s.y > bot) { s.y = bot; s.vy = -Math.abs(s.vy); }
}
