import { RENDER_H, RENDER_SCALE, RENDER_W } from '../game/consts';

export interface Insets { top: number; right: number; bottom: number; left: number }
export interface ViewportRect { x: number; y: number; width: number; height: number; scale: number }

export function fitViewport(w: number, h: number, inset: Insets): ViewportRect {
  const aw = Math.max(1, w - inset.left - inset.right);
  const ah = Math.max(1, h - inset.top - inset.bottom);
  const widthConstrained = aw / RENDER_W <= ah / RENDER_H;
  const constrained = Math.max(1, widthConstrained ? aw : ah);
  const width = widthConstrained ? constrained : constrained * RENDER_W / RENDER_H;
  const height = widthConstrained ? constrained * RENDER_H / RENDER_W : constrained;
  const scale = width / RENDER_W;
  return {
    x: inset.left + (aw - width) / 2,
    y: inset.top + (ah - height) / 2,
    width, height, scale,
  };
}

export const worldToRender = (x: number, y: number) =>
  ({ x: x * RENDER_SCALE, y: y * RENDER_SCALE });

export function clientToWorld(x: number, y: number, v: ViewportRect) {
  return {
    x: (x - v.x) * RENDER_W / v.width / RENDER_SCALE,
    y: (y - v.y) * RENDER_H / v.height / RENDER_SCALE,
  };
}
