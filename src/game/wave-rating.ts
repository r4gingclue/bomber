export interface WavePerformance {
  scoreEarned: number;
  scoreTarget: number;
  drops: number;
  hitDrops: number;
  hpStart: number;
  hpEnd: number;
  maxHpStart: number;
  hadChargeTargets?: boolean;
}

export interface WaveRating {
  score: number;
  accuracy: number;
  survival: number;
  total: number;
  bonusPoint: boolean;
}

const ratio = (value: number, target: number) => target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;

export function rateWave(p: WavePerformance): WaveRating {
  const score = Math.round(40 * ratio(p.scoreEarned, p.scoreTarget));
  const accuracyRatio = p.drops > 0 ? ratio(Math.min(p.hitDrops, p.drops), p.drops) : (p.hadChargeTargets === false ? 1 : 0);
  const accuracy = Math.round(30 * accuracyRatio);
  const lost = Math.max(0, Math.min(p.maxHpStart, p.hpStart - p.hpEnd));
  const survival = Math.round(30 * (1 - ratio(lost, p.maxHpStart)));
  const total = Math.max(0, Math.min(100, score + accuracy + survival));
  return { score, accuracy, survival, total, bonusPoint: total >= 75 };
}
