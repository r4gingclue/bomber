import type { PlayerStats } from './upgrades';
import { deriveStats, nodeById, type UpgradeId } from './upgrade-tree';

export interface RunProgressionOptions {
  points?: number;
}

export class RunProgression {
  points: number;
  readonly confirmed = new Set<UpgradeId>();
  readonly pending = new Set<UpgradeId>();

  constructor({ points = 0 }: RunProgressionOptions = {}) {
    this.points = points;
  }

  awardWave(rating: number): { base: 1; bonus: 0 | 1; total: 1 | 2 } {
    const bonus = rating >= 75 ? 1 : 0;
    const total = bonus ? 2 : 1;
    this.points += total;
    return { base: 1, bonus, total };
  }

  canPurchase(id: UpgradeId): { ok: boolean; reason?: string } {
    const node = nodeById(id);
    if (!node) return { ok: false, reason: 'Unknown upgrade.' };
    if (this.confirmed.has(id) || this.pending.has(id)) return { ok: false, reason: 'Already purchased.' };

    const purchased = this.purchased;
    const missing = node.requires.find(required => !purchased.has(required));
    if (missing) return { ok: false, reason: `Requires ${nodeById(missing)!.name}.` };

    const excluded = node.exclusionGroup && [...purchased]
      .map(purchasedId => nodeById(purchasedId))
      .find(purchasedNode => purchasedNode?.exclusionGroup === node.exclusionGroup);
    if (excluded) return { ok: false, reason: `Excludes ${excluded.name}.` };

    if (this.points < node.cost) return { ok: false, reason: `Requires ${node.cost} points.` };
    return { ok: true };
  }

  purchase(id: UpgradeId): boolean {
    const validation = this.canPurchase(id);
    const node = nodeById(id);
    if (!validation.ok || !node) return false;

    this.points -= node.cost;
    this.pending.add(id);
    return true;
  }

  canRefund(id: UpgradeId): { ok: boolean; reason?: string } {
    const node = nodeById(id);
    if (!node) return { ok: false, reason: 'Unknown upgrade.' };
    if (this.confirmed.has(id)) return { ok: false, reason: 'Confirmed upgrades cannot be refunded.' };
    if (!this.pending.has(id)) return { ok: false, reason: 'Upgrade is not pending.' };

    const dependant = [...this.pending]
      .map(pendingId => nodeById(pendingId))
      .find(pendingNode => pendingNode?.requires.includes(id));
    if (dependant) return { ok: false, reason: `Required by ${dependant.name}.` };

    return { ok: true };
  }

  refund(id: UpgradeId): boolean {
    const validation = this.canRefund(id);
    const node = nodeById(id);
    if (!validation.ok || !node) return false;

    this.pending.delete(id);
    this.points += node.cost;
    return true;
  }

  confirm(): void {
    for (const id of this.pending) this.confirmed.add(id);
    this.pending.clear();
  }

  reset(): void {
    this.points = 0;
    this.confirmed.clear();
    this.pending.clear();
  }

  get stats(): PlayerStats {
    return deriveStats(this.purchased);
  }

  private get purchased(): Set<UpgradeId> {
    return new Set([...this.confirmed, ...this.pending]);
  }
}
