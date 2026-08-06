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

export type UpgradeTextRole = 'name' | 'cost' | 'description' | 'status';

export interface UpgradeTextLinePlan {
  text: string;
  role: UpgradeTextRole;
  x: number;
  baseline: number;
  fontSize: number;
  align: 'left' | 'right';
}

export interface UpgradeTextRegionPlan {
  rect: UiRect;
  lines: UpgradeTextLinePlan[];
}

export interface UpgradeNodeRenderPlan {
  card: UpgradeTextRegionPlan;
  detail?: UpgradeTextRegionPlan;
}

export type UpgradeTextMeasure = (text: string, fontSize: number) => number;

export function upgradeNodeWrapWidth(rect: UiRect): number {
  return Math.max(1, rect.w - Math.min(24, rect.w * 0.12));
}

export function perkPointHudText(points: number): string {
  return `perk pts ${points}`;
}

function statusText(node: UpgradeNodeView, detailed: boolean): string {
  if (node.state === 'purchased') return 'PURCHASED';
  if (node.state === 'pending') return detailed ? 'PENDING — SELECT TO REFUND' : 'PENDING';
  if (node.state === 'affordable') return 'AVAILABLE';
  return detailed ? node.reason ?? 'LOCKED' : 'LOCKED';
}

function wrapLines(
  value: string,
  maxWidth: number,
  fontSize: number,
  measure: UpgradeTextMeasure,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function detailLines(
  node: UpgradeNodeView,
  rect: UiRect,
  measure: UpgradeTextMeasure,
): UpgradeTextLinePlan[] {
  const inset = Math.min(12, rect.w * 0.04);
  const maxWidth = Math.max(1, rect.w - inset * 2);
  const titleSize = rect.h < 64 ? 10 : 11;
  const titleBaseline = rect.y + titleSize + 2;
  let bodySize = rect.h < 64 ? 9 : 10;
  let description: string[] = [];
  let status: string[] = [];
  let lineHeight = bodySize + 2;
  const bodyStart = titleBaseline + titleSize + 2;
  while (bodySize >= 7) {
    description = wrapLines(node.description, maxWidth, bodySize, measure);
    status = wrapLines(statusText(node, true), maxWidth, bodySize, measure);
    lineHeight = bodySize + 2;
    const lineCount = description.length + status.length;
    const lastBaseline = bodyStart + Math.max(0, lineCount - 1) * lineHeight;
    if (lastBaseline + Math.ceil(bodySize * 0.25) <= rect.y + rect.h - 2) break;
    bodySize -= 1;
  }

  const lines: UpgradeTextLinePlan[] = [{
    text: node.name,
    role: 'name',
    x: rect.x + inset,
    baseline: titleBaseline,
    fontSize: titleSize,
    align: 'left',
  }];
  let baseline = bodyStart;
  for (const text of description) {
    lines.push({ text, role: 'description', x: rect.x + inset, baseline, fontSize: bodySize, align: 'left' });
    baseline += lineHeight;
  }
  for (const text of status) {
    lines.push({ text, role: 'status', x: rect.x + inset, baseline, fontSize: bodySize, align: 'left' });
    baseline += lineHeight;
  }
  return lines;
}

export function buildUpgradeNodeRenderPlan(
  node: UpgradeNodeView,
  cardRect: UiRect,
  detailRect: UiRect | null,
  measure: UpgradeTextMeasure,
): UpgradeNodeRenderPlan {
  const inset = (cardRect.w - upgradeNodeWrapWidth(cardRect)) / 2;
  const maxWidth = upgradeNodeWrapWidth(cardRect);
  const usesDetail = detailRect !== null;
  const cardLines: UpgradeTextLinePlan[] = [];

  if (usesDetail) {
    const nameSize = Math.max(6, Math.min(10, Math.floor((cardRect.h - 5) / 2)));
    const statusSize = Math.max(6, Math.min(8, nameSize - 1));
    cardLines.push(
      {
        text: node.name,
        role: 'name',
        x: cardRect.x + inset,
        baseline: cardRect.y + nameSize + 1,
        fontSize: nameSize,
        align: 'left',
      },
      {
        text: `${node.cost} ${node.cost === 1 ? 'pt' : 'pts'}`,
        role: 'cost',
        x: cardRect.x + cardRect.w - inset,
        baseline: cardRect.y + nameSize + 1,
        fontSize: nameSize,
        align: 'right',
      },
      {
        text: statusText(node, false),
        role: 'status',
        x: cardRect.x + inset,
        baseline: cardRect.y + cardRect.h - Math.ceil(statusSize * 0.25),
        fontSize: statusSize,
        align: 'left',
      },
    );
  } else {
    const nameSize = 14;
    const bodySize = 11;
    const statusSize = 10;
    const nameBaseline = cardRect.y + 21;
    const statusBaseline = cardRect.y + cardRect.h - Math.ceil(statusSize * 0.25) - 2;
    cardLines.push(
      { text: node.name, role: 'name', x: cardRect.x + inset, baseline: nameBaseline, fontSize: nameSize, align: 'left' },
      {
        text: `${node.cost} ${node.cost === 1 ? 'pt' : 'pts'}`,
        role: 'cost',
        x: cardRect.x + cardRect.w - inset,
        baseline: nameBaseline,
        fontSize: nameSize,
        align: 'right',
      },
    );
    let baseline = nameBaseline + 18;
    for (const text of wrapLines(node.description, maxWidth, bodySize, measure)) {
      cardLines.push({ text, role: 'description', x: cardRect.x + inset, baseline, fontSize: bodySize, align: 'left' });
      baseline += bodySize + 2;
    }
    cardLines.push({
      text: statusText(node, true),
      role: 'status',
      x: cardRect.x + inset,
      baseline: statusBaseline,
      fontSize: statusSize,
      align: 'left',
    });
  }

  return {
    card: { rect: cardRect, lines: cardLines },
    detail: detailRect && node.focused
      ? { rect: detailRect, lines: detailLines(node, detailRect, measure) }
      : undefined,
  };
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
