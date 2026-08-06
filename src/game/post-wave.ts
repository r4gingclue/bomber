import type { Rng } from '../core/rng';
import { RunProgression } from './run-progression';
import { rateWave, type WaveRating } from './wave-rating';
import { World } from './world';

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

export function completeWave(world: World, progression: RunProgression): PostWaveView {
  const existing = world.postWaveView();
  if (existing) return existing;

  const rating = rateWave(world.wavePerformance());
  const award = progression.awardWave(rating.total);
  const view = buildPostWaveView(rating, award, progression.points);
  world.recordPostWaveView(view);
  return view;
}

export function previewUpgrades(world: World, progression: RunProgression): void {
  world.setStats(progression.stats);
}

export function confirmUpgrades(world: World, progression: RunProgression): void {
  if (!world.claimUpgradeConfirmation()) return;
  previewUpgrades(world, progression);
  progression.confirm();
  world.applyWaveRecovery();
}

export function createRun(rng: Rng): { world: World; progression: RunProgression } {
  return { world: new World(rng), progression: new RunProgression() };
}
