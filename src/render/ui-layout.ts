import type { Insets, ViewportRect } from './viewport';

export interface UiCircle { x: number; y: number; r: number }
export interface UiRect { x: number; y: number; w: number; h: number }

export interface UiLayout {
  viewport: { w: number; h: number };
  battlefield: UiRect;
  hud: { x: number; y: number; w: number; h: number; fontSize: number };
  objective: { x: number; y: number };
  move: UiCircle;
  fire: UiCircle;
  drop: UiCircle;
  cards: UiRect[];
  controlsInLetterbox: boolean;
  controlOpacity: number;
  gameplaySafe: UiRect;
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
  const gap = 28;
  const availableW = w - i.left - i.right;
  const availableH = h - i.top - i.bottom;
  const cardW = Math.min(240, Math.max(1, (availableW - 40 - gap * 2) / 3));
  const cardH = Math.min(220, Math.max(1, availableH - 40));
  const cardsW = cardW * 3 + gap * 2;
  const cardsX = i.left + (availableW - cardsW) / 2;
  const cardsY = i.top + (availableH - cardH) / 2;
  const hudW = Math.max(1, Math.min(250, availableW - 40));
  const battlefield = battlefieldRect(w, h, i, gameViewport);
  const safeRight = w - i.right;
  const safeBottom = h - i.bottom;
  let r = touch ? Math.max(22, Math.min(44, Math.round(Math.min(w, h) * 0.1))) : 38;
  let controlsInLetterbox = false;
  let controlOpacity = 0.54;
  let move: UiCircle;
  let fire: UiCircle;
  let drop: UiCircle;

  const topBar = battlefield.y - i.top;
  const bottomBar = safeBottom - (battlefield.y + battlefield.h);
  const leftBar = battlefield.x - i.left;
  const rightBar = safeRight - (battlefield.x + battlefield.w);
  if (touch && bottomBar >= r * 2 + 8) {
    const y = battlefield.y + battlefield.h + bottomBar / 2;
    move = { x: i.left + r + 16, y, r };
    fire = { x: safeRight - r - 16, y, r };
    drop = { x: fire.x - r * 2 - 16, y, r };
    controlsInLetterbox = true;
    controlOpacity = 0.66;
  } else if (touch && topBar >= r * 2 + 8) {
    const y = i.top + topBar / 2;
    move = { x: i.left + r + 16, y, r };
    fire = { x: safeRight - r - 16, y, r };
    drop = { x: fire.x - r * 2 - 16, y, r };
    controlsInLetterbox = true;
    controlOpacity = 0.66;
  } else if (touch && leftBar >= r * 2 + 8 && rightBar >= r * 2 + 8) {
    move = {
      x: i.left + leftBar / 2,
      y: Math.min(safeBottom - r - 8, battlefield.y + battlefield.h * 0.72),
      r,
    };
    fire = {
      x: battlefield.x + battlefield.w + rightBar / 2,
      y: Math.min(safeBottom - r - 8, battlefield.y + battlefield.h * 0.72),
      r,
    };
    drop = {
      x: fire.x,
      y: Math.max(i.top + r + 8, battlefield.y + battlefield.h * 0.28),
      r,
    };
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
    fire = {
      x: battlefield.x + battlefield.w - r - edge,
      y: battlefield.y + battlefield.h - r - edge,
      r,
    };
    drop = {
      x: fire.x,
      y: fire.y - r * 2 - 12,
      r,
    };
    controlOpacity = 0.36;
  } else {
    move = { x: i.left + r + 28, y: safeBottom - r - 24, r };
    fire = { x: safeRight - r - 28, y: safeBottom - r - 94, r };
    drop = { x: safeRight - r - 108, y: safeBottom - r - 18, r };
  }

  const safeX = controlsInLetterbox
    ? battlefield.x + 8
    : Math.max(battlefield.x + 8, move.x + move.r + 8);
  const safeRightX = controlsInLetterbox
    ? battlefield.x + battlefield.w - 8
    : Math.min(
      battlefield.x + battlefield.w - 8,
      fire.x - fire.r - 8,
      drop.x - drop.r - 8,
    );

  return {
    viewport: { w, h },
    battlefield,
    hud: { x: i.left + 20, y: i.top + 20, w: hudW, h: 72, fontSize: 16 },
    objective: { x: i.left + availableW / 2, y: i.top + 36 },
    move,
    fire,
    drop,
    cards: Array.from({ length: 3 }, (_, index) => ({
      x: cardsX + index * (cardW + gap), y: cardsY, w: cardW, h: cardH,
    })),
    controlsInLetterbox,
    controlOpacity,
    gameplaySafe: {
      x: safeX,
      y: battlefield.y + 8,
      w: Math.max(1, safeRightX - safeX),
      h: Math.max(1, battlefield.h - 16),
    },
  };
}
