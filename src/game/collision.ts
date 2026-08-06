export interface Circle { x: number; y: number; r: number }

export function circlesOverlap(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x, dy = a.y - b.y, rr = a.r + b.r;
  return dx * dx + dy * dy <= rr * rr;
}

export interface Blast { x: number; y: number; r: number; damage: number }
export interface BlastTarget extends Circle {
  id: number;
  /** set for mines: detonating them adds a new blast of this radius */
  chainRadius?: number;
}

/** Resolve blasts including mine chain reactions. Each target is hit at most once. */
export function resolveBlasts(initial: Blast[], targets: BlastTarget[]): Map<number, number> {
  const hit = new Map<number, number>();
  const queue: Blast[] = [...initial];
  while (queue.length > 0) {
    const b = queue.pop()!;
    for (const t of targets) {
      if (hit.has(t.id)) continue;
      if (!circlesOverlap({ x: b.x, y: b.y, r: b.r }, t)) continue;
      hit.set(t.id, b.damage);
      if (t.chainRadius) queue.push({ x: t.x, y: t.y, r: t.chainRadius, damage: b.damage });
    }
  }
  return hit;
}
