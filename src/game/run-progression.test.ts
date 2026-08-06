import { describe, expect, it } from 'vitest';
import { RunProgression } from './run-progression';
import type { UpgradeId } from './upgrade-tree';

describe('RunProgression', () => {
  it('awards one clear point plus one rating bonus at 75', () => {
    const progression = new RunProgression();

    expect(progression.awardWave(74)).toEqual({ base: 1, bonus: 0, total: 1 });
    expect(progression.awardWave(75)).toEqual({ base: 1, bonus: 1, total: 2 });
    expect(progression.points).toBe(3);
  });

  it('rejects duplicate, unknown, unaffordable, and prerequisite-blocked purchases', () => {
    const progression = new RunProgression({ points: 2 });

    expect(progression.canPurchase('rapid-fire-2')).toEqual({ ok: false, reason: 'Requires Rapid Fire I.' });
    expect(progression.purchase('rapid-fire-2')).toBe(false);
    expect(progression.purchase('rapid-fire-1')).toBe(true);
    expect(progression.purchase('rapid-fire-1')).toBe(false);
    expect(progression.canPurchase('rapid-fire-2')).toEqual({ ok: false, reason: 'Requires 2 points.' });
    expect(progression.canPurchase('not-an-upgrade' as UpgradeId)).toEqual({ ok: false, reason: 'Unknown upgrade.' });
    expect(progression.purchase('not-an-upgrade' as UpgradeId)).toBe(false);
  });

  it('allows pending prerequisites and restores each refunded node cost exactly', () => {
    const progression = new RunProgression({ points: 3 });

    expect(progression.purchase('rapid-fire-1')).toBe(true);
    expect(progression.purchase('rapid-fire-2')).toBe(true);
    expect(progression.points).toBe(0);
    expect(progression.refund('rapid-fire-2')).toBe(true);
    expect(progression.points).toBe(2);
    expect(progression.refund('rapid-fire-1')).toBe(true);
    expect(progression.points).toBe(3);
  });

  it('blocks refunds that would leave a pending dependant without its prerequisite', () => {
    const progression = new RunProgression({ points: 3 });

    progression.purchase('rapid-fire-1');
    progression.purchase('rapid-fire-2');

    expect(progression.canRefund('rapid-fire-1')).toEqual({ ok: false, reason: 'Required by Rapid Fire II.' });
    expect(progression.refund('rapid-fire-1')).toBe(false);
    expect(progression.pending).toEqual(new Set(['rapid-fire-1', 'rapid-fire-2']));
  });

  it('enforces the cannon specialist exclusion across pending and confirmed nodes', () => {
    const progression = new RunProgression({ points: 9 });

    for (const id of ['rapid-fire-1', 'rapid-fire-2', 'cannon-damage-1', 'heavy-rounds', 'piercing'] as const) {
      expect(progression.purchase(id)).toBe(true);
    }
    expect(progression.purchase('multishot')).toBe(false);
    progression.confirm();
    expect(progression.purchase('multishot')).toBe(false);
  });

  it('enforces the ordnance specialist exclusion', () => {
    const progression = new RunProgression({ points: 9 });

    for (const id of ['lead-casing', 'payload-damage', 'bigger-boom-1', 'bigger-boom-2', 'dual-drop'] as const) {
      expect(progression.purchase(id)).toBe(true);
    }
    expect(progression.purchase('magnetic-charges')).toBe(false);
  });

  it('confirms pending nodes, exposes their derived stats, and prevents their refund', () => {
    const progression = new RunProgression({ points: 3 });

    progression.purchase('rapid-fire-1');
    progression.purchase('rapid-fire-2');
    expect(progression.stats.cannonCooldown).toBeCloseTo(0.12 / 1.12 / 1.15);
    progression.confirm();

    expect(progression.confirmed).toEqual(new Set(['rapid-fire-1', 'rapid-fire-2']));
    expect(progression.pending.size).toBe(0);
    expect(progression.canRefund('rapid-fire-1')).toEqual({ ok: false, reason: 'Confirmed upgrades cannot be refunded.' });
    expect(progression.refund('rapid-fire-1')).toBe(false);
  });

  it('resets points, purchases, and derived stats for a new run', () => {
    const progression = new RunProgression({ points: 1 });

    progression.purchase('armor-1');
    progression.confirm();
    progression.awardWave(75);
    progression.reset();

    expect(progression.points).toBe(0);
    expect(progression.confirmed.size).toBe(0);
    expect(progression.pending.size).toBe(0);
    expect(progression.stats.maxHp).toBe(100);
  });
});
