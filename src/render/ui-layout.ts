import type { Insets } from './viewport';

export interface UiCircle { x: number; y: number; r: number }
export interface UiRect { x: number; y: number; w: number; h: number }

export interface UiLayout {
  viewport: { w: number; h: number };
  hud: { x: number; y: number; w: number; h: number; fontSize: number };
  objective: { x: number; y: number };
  move: UiCircle;
  fire: UiCircle;
  drop: UiCircle;
  cards: UiRect[];
}

/** Positions screen-space UI in CSS pixels while gameplay remains in its fitted 16:9 canvas. */
export function uiLayout(w: number, h: number, i: Insets, touch: boolean): UiLayout {
  const r = touch ? Math.max(28, Math.min(54, Math.round(Math.min(w, h) * 0.1))) : 38;
  const gap = 28;
  const availableW = w - i.left - i.right;
  const availableH = h - i.top - i.bottom;
  const cardW = Math.min(240, Math.max(1, (availableW - 40 - gap * 2) / 3));
  const cardH = Math.min(220, Math.max(1, availableH - 40));
  const cardsW = cardW * 3 + gap * 2;
  const cardsX = i.left + (availableW - cardsW) / 2;
  const cardsY = i.top + (availableH - cardH) / 2;
  const hudW = Math.max(1, Math.min(250, availableW - 40));

  return {
    viewport: { w, h },
    hud: { x: i.left + 20, y: i.top + 20, w: hudW, h: 72, fontSize: 16 },
    objective: { x: i.left + availableW / 2, y: i.top + 36 },
    move: { x: i.left + r + 28, y: h - i.bottom - r - 24, r },
    fire: { x: w - i.right - r - 28, y: h - i.bottom - r - 94, r },
    drop: { x: w - i.right - r - 108, y: h - i.bottom - r - 18, r },
    cards: Array.from({ length: 3 }, (_, index) => ({
      x: cardsX + index * (cardW + gap), y: cardsY, w: cardW, h: cardH,
    })),
  };
}
