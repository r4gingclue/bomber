import type { UpgradeBranch, UpgradeNode } from '../game/upgrade-tree';
import type { Insets } from './viewport';
import type { UiRect } from './ui-layout';

export interface UpgradeNodeLayout {
  node: UpgradeNode;
  rect: UiRect;
}

export interface UpgradeLayout {
  panel: UiRect;
  tabs: UiRect[];
  nodes: UpgradeNodeLayout[];
  detail: UiRect | null;
  continueButton: UiRect;
  resultsContinueButton: UiRect;
}

const BRANCH_COUNT = 4;

function centeredRect(x: number, y: number, w: number, h: number, maxW: number, maxH: number): UiRect {
  const width = Math.max(1, Math.min(maxW, w));
  const height = Math.max(1, Math.min(maxH, h));
  return { x: x + (maxW - width) / 2, y: y + (maxH - height) / 2, w: width, h: height };
}

/**
 * Calculates the CSS-pixel rectangles shared by the upgrade renderer and its
 * touch hit testing. The caller supplies all branch nodes so this remains a
 * presentation-only module.
 */
export function upgradeLayout(
  width: number,
  height: number,
  insets: Insets,
  branch: UpgradeBranch,
  allNodes: readonly UpgradeNode[],
): UpgradeLayout {
  const safeW = Math.max(1, width - insets.left - insets.right);
  const safeH = Math.max(1, height - insets.top - insets.bottom);
  const portrait = safeH > safeW * 1.1;
  const compact = !portrait && safeH < 520;
  const outerInset = portrait ? 12 : Math.min(32, Math.max(12, safeW * 0.04));
  const panel = centeredRect(
    insets.left,
    insets.top,
    portrait ? safeW - outerInset * 2 : Math.min(1080, safeW - outerInset * 2),
    portrait ? safeH - outerInset * 2 : Math.min(840, safeH - outerInset * 2),
    safeW,
    safeH,
  );
  const panelInset = Math.min(portrait ? 12 : 28, Math.max(8, Math.min(panel.w, panel.h) * 0.05));
  const contentX = panel.x + panelInset;
  const contentW = Math.max(1, panel.w - panelInset * 2);
  const tabGap = compact ? 4 : 8;
  const tabH = compact ? 32 : portrait ? 36 : 44;
  const tabW = Math.max(1, (contentW - tabGap * (BRANCH_COUNT - 1)) / BRANCH_COUNT);
  const tabs = Array.from({ length: BRANCH_COUNT }, (_, index) => ({
    x: contentX + index * (tabW + tabGap),
    y: panel.y + panelInset,
    w: tabW,
    h: tabH,
  }));
  const buttonH = compact ? 36 : 44;
  const buttonW = Math.max(1, Math.min(contentW, portrait ? contentW : compact ? 220 : 300));
  const continueButton = {
    x: contentX + (contentW - buttonW) / 2,
    y: panel.y + panel.h - panelInset - buttonH,
    w: buttonW,
    h: buttonH,
  };
  const resultsContinueButton = { ...continueButton };
  const nodes = allNodes.filter(node => node.branch === branch);
  const columns = portrait ? 1 : 2;
  const rows = Math.max(1, Math.ceil(nodes.length / columns));
  const nodeGap = compact ? 6 : portrait ? 8 : 18;
  const nodeTop = tabs[0].y + tabs[0].h + nodeGap;
  const footerClearance = compact || portrait ? 18 : nodeGap;
  const contentBottom = continueButton.y - footerClearance;
  const compactDetailW = compact ? Math.min(240, Math.max(160, contentW * 0.34)) : 0;
  const detail = compact
    ? {
        x: contentX + contentW - compactDetailW,
        y: nodeTop,
        w: compactDetailW,
        h: Math.max(1, contentBottom - nodeTop),
      }
    : portrait
      ? {
        x: contentX,
        y: contentBottom - 66,
        w: contentW,
        h: 66,
      }
      : null;
  const nodeBottom = compact
    ? contentBottom
    : detail
      ? detail.y - nodeGap
      : continueButton.y - nodeGap;
  const nodeAreaW = compact && detail
    ? Math.max(1, detail.x - nodeGap - contentX)
    : contentW;
  const nodeAreaH = Math.max(1, nodeBottom - nodeTop);
  const nodeH = Math.max(1, Math.min(
    compact ? 54 : portrait ? 64 : 108,
    (nodeAreaH - nodeGap * (rows - 1)) / rows,
  ));
  const nodeW = Math.max(1, (nodeAreaW - nodeGap * (columns - 1)) / columns);

  return {
    panel,
    tabs,
    detail,
    nodes: nodes.map((node, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        node,
        rect: {
          x: contentX + column * (nodeW + nodeGap),
          y: nodeTop + row * (nodeH + nodeGap),
          w: nodeW,
          h: nodeH,
        },
      };
    }),
    continueButton,
    resultsContinueButton,
  };
}
