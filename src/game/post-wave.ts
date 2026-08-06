import type { WaveRating } from './wave-rating';

export interface PostWaveView {
  rating: WaveRating;
  award: { base: 1; bonus: 0 | 1; total: 1 | 2 };
  balance: number;
}

export function buildPostWaveView(
  rating: WaveRating,
  award: { base: 1; bonus: 0 | 1; total: 1 | 2 },
  balance: number,
): PostWaveView {
  return { rating, award, balance };
}
