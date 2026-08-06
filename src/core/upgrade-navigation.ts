export type UpgradeAction = 'left' | 'right' | 'up' | 'down' | 'select' | 'refund' | 'continue';

export interface UpgradeFocus {
  branch: number;
  node: number;
}

export interface UpgradeFocusModel extends UpgradeFocus {
  nodeCounts: readonly number[];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Moves tree focus without reading or mutating UI or progression state. */
export function moveUpgradeFocus(model: UpgradeFocusModel, action: UpgradeAction): UpgradeFocus {
  const lastBranch = Math.max(0, model.nodeCounts.length - 1);
  let branch = clamp(model.branch, 0, lastBranch);
  if (action === 'left') branch = clamp(branch - 1, 0, lastBranch);
  if (action === 'right') branch = clamp(branch + 1, 0, lastBranch);

  const lastNode = Math.max(0, (model.nodeCounts[branch] ?? 0) - 1);
  let node = clamp(model.node, 0, lastNode);
  if (action === 'up') node = clamp(node - 1, 0, lastNode);
  if (action === 'down') node = clamp(node + 1, 0, lastNode);

  return { branch, node };
}
