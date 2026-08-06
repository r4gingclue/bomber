import type { RunProgression } from '../game/run-progression';
import { UPGRADE_NODES, type UpgradeBranch, type UpgradeId } from '../game/upgrade-tree';
import type { UiRect } from './ui-layout';

export type UpgradeNodeState = 'purchased' | 'pending' | 'affordable' | 'locked';

export interface UpgradeNodeView {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
  requires: UpgradeId[];
  state: UpgradeNodeState;
  focused: boolean;
  reason?: string;
}

export interface UpgradeTreeView {
  branch: UpgradeBranch;
  points: number;
  nodes: UpgradeNodeView[];
}

export function upgradeNodeWrapWidth(rect: UiRect): number {
  return Math.max(1, rect.w - Math.min(24, rect.w * 0.12));
}

export function perkPointHudText(points: number): string {
  return `perk pts ${points}`;
}

export function buildUpgradeTreeView(
  progression: RunProgression,
  branch: UpgradeBranch,
  focusedNode?: UpgradeId | null,
): UpgradeTreeView {
  return {
    branch,
    points: progression.points,
    nodes: UPGRADE_NODES
      .filter(node => node.branch === branch)
      .map(node => {
        const display = {
          id: node.id,
          name: node.name,
          description: node.description,
          cost: node.cost,
          requires: [...node.requires],
          focused: node.id === focusedNode,
        };
        if (progression.confirmed.has(node.id)) {
          return { ...display, state: 'purchased' as const };
        }
        if (progression.pending.has(node.id)) {
          return { ...display, state: 'pending' as const };
        }
        const purchase = progression.canPurchase(node.id);
        return purchase.ok
          ? { ...display, state: 'affordable' as const }
          : { ...display, state: 'locked' as const, reason: purchase.reason };
      }),
  };
}
