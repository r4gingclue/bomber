import type { Insets, ViewportRect } from './viewport';
import { audioSettingsLayout, type AudioSettingsLayout } from './audio-settings';

export interface UiCircle { x: number; y: number; r: number }
export interface UiRect { x: number; y: number; w: number; h: number }

export interface UiLayout {
  viewport: { w: number; h: number };
  battlefield: UiRect;
  hud: { x: number; y: number; w: number; h: number; fontSize: number };
  objective: { x: number; y: number };
  move: UiCircle;
  missile: UiCircle;
  drop: UiCircle;
  /** client-x boundary: touches left of this steer, right of this aim */
  zoneSplitX: number;
  controlsInLetterbox: boolean;
  controlOpacity: number;
  gameplaySafe: UiRect;
  audio: AudioSettingsLayout;
}

function battlefieldRect(
  w: number,
  h: number,
  insets: Insets,
  viewport?: ViewportRect,
): UiRect {
  if (viewport) {
    return { x: viewport.x, y: viewport.y, w: viewport.width, h: viewport.height };
  }
  return {
    x: insets.left,
    y: insets.top,
    w: Math.max(1, w - insets.left - insets.right),
    h: Math.max(1, h - insets.top - insets.bottom),
  };
}

/**
 * Positions CSS-pixel UI around the fitted battlefield. Touch controls prefer
 * real letterbox space; a no-letterbox landscape falls back to compact,
 * translucent edge controls while preserving a broad unobscured center strip.
 */
export function uiLayout(
  w: number,
  h: number,
  i: Insets,
  touch: boolean,
  gameViewport?: ViewportRect,
): UiLayout {
  const availableW = w - i.left - i.right;
  const hudW = Math.max(1, Math.min(250, availableW - 40));
  const battlefield = battlefieldRect(w, h, i, gameViewport);
  const safeRight = w - i.right;
  const safeBottom = h - i.bottom;
  let r = touch ? Math.max(22, Math.min(44, Math.round(Math.min(w, h) * 0.1))) : 38;
  let controlsInLetterbox = false;
  let controlOpacity = 0.54;
  let move: UiCircle;
  let missile: UiCircle;
  let drop: UiCircle;

  const topBar = battlefield.y - i.top;
  const bottomBar = safeBottom - (battlefield.y + battlefield.h);
  const leftBar = battlefield.x - i.left;
  const rightBar = safeRight - (battlefield.x + battlefield.w);
  const stackGap = 12;
  // NOTE: this guard intentionally excludes some 4:3 tablet sizes (e.g. iPad
  // 1024x768 landscape) from the letterbox layout in favor of the compact
  // overlay below. Two stacked 44px buttons need ~100px of bar, and an iPad's
  // ~96px bar can't fit that without shrinking below the 44px touch-target
  // floor, so the compact overlay is the correct fallback here.
  if (touch && bottomBar >= r * 6 + stackGap * 2 + 8) {
    const y = battlefield.y + battlefield.h + bottomBar / 2;
    move = { x: i.left + r + 16, y, r };
    drop = { x: safeRight - r - 16, y, r };
    missile = { x: drop.x, y: drop.y - r * 2 - stackGap, r };
    controlsInLetterbox = true;
    controlOpacity = 0.66;
  } else if (touch && topBar >= r * 6 + stackGap * 2 + 8) {
    const y = i.top + topBar / 2;
    move = { x: i.left + r + 16, y, r };
    drop = { x: safeRight - r - 16, y, r };
    missile = { x: drop.x, y: drop.y - r * 2 - stackGap, r };
    controlsInLetterbox = true;
    controlOpacity = 0.66;
  } else if (touch && leftBar >= r * 2 + 8 && rightBar >= r * 2 + 8) {
    move = {
      x: i.left + leftBar / 2,
      y: Math.min(safeBottom - r - 8, battlefield.y + battlefield.h * 0.72),
      r,
    };
    drop = {
      x: battlefield.x + battlefield.w + rightBar / 2,
      y: Math.min(safeBottom - r - 8, battlefield.y + battlefield.h * 0.72),
      r,
    };
    missile = { x: drop.x, y: drop.y - r * 2 - stackGap, r };
    controlsInLetterbox = true;
    controlOpacity = 0.66;
  } else if (touch) {
    r = 22;
    const edge = 8;
    move = {
      x: battlefield.x + r + edge,
      y: battlefield.y + battlefield.h - r - edge,
      r,
    };
    drop = {
      x: Math.min(battlefield.x + battlefield.w, safeRight) - r - edge,
      y: Math.min(battlefield.y + battlefield.h, safeBottom) - r - edge,
      r,
    };
    missile = { x: drop.x, y: drop.y - r * 2 - stackGap, r };
    controlOpacity = 0.36;
  } else {
    move = { x: i.left + r + 28, y: safeBottom - r - 24, r };
    drop = { x: safeRight - r - 28, y: safeBottom - r - 24, r };
    missile = { x: drop.x, y: drop.y - r * 2 - stackGap, r };
  }

  const safeX = controlsInLetterbox
    ? battlefield.x + 8
    : Math.max(battlefield.x + 8, move.x + move.r + 8);
  const safeRightX = controlsInLetterbox
    ? battlefield.x + battlefield.w - 8
    : Math.min(
      battlefield.x + battlefield.w - 8,
      missile.x - missile.r - 8,
      drop.x - drop.r - 8,
    );

  return {
    viewport: { w, h },
    battlefield,
    hud: { x: i.left + 20, y: i.top + 20, w: hudW, h: 72, fontSize: 16 },
    objective: { x: i.left + availableW / 2, y: i.top + 36 },
    move,
    missile,
    drop,
    zoneSplitX: i.left + availableW / 2,
    controlsInLetterbox,
    controlOpacity,
    gameplaySafe: {
      x: safeX,
      y: battlefield.y + 8,
      w: Math.max(1, safeRightX - safeX),
      h: Math.max(1, battlefield.h - 16),
    },
    audio: audioSettingsLayout(w, h, i),
  };
}
