import { RunProgression } from './run-progression';
import type { WaveRating } from './wave-rating';

export interface PostWaveView {
  rating: WaveRating;
  award: ReturnType<RunProgression['awardWave']>;
  balance: number;
}

export function buildPostWaveView(rating: WaveRating, progression: RunProgression): PostWaveView {
  const award = progression.awardWave(rating.total);
  return { rating, award, balance: progression.points };
}
