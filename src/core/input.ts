import { RENDER_H, RENDER_SCALE, RENDER_W, VIEW_W } from '../game/consts';
import { uiLayout, type UiCircle } from '../render/ui-layout';

export interface Intent {
  move: { x: number; y: number };
  drop: boolean;
  fire: boolean;
  missile: boolean;
  /** world-space aim point; resolved by main.ts from mouse or aim stick */
  aim?: { x: number; y: number } | null;
}

export interface TouchButtons {
  fire: UiCircle;
  drop: UiCircle;
}

/** Simulation-space controls derived from the render-space UI layout. */
export function touchButtons(): {
  fire: UiCircle;
  drop: UiCircle;
} {
  const layout = uiLayout(RENDER_W, RENDER_H, { top: 0, right: 0, bottom: 0, left: 0 }, true);
  const toSimulation = ({ x, y, r }: UiCircle): UiCircle =>
    ({ x: x / RENDER_SCALE, y: y / RENDER_SCALE, r: r / RENDER_SCALE });
  return {
    fire: toSimulation(layout.fire),
    drop: toSimulation(layout.drop),
  };
}

const inCircle = (cx: number, cy: number, b: { x: number; y: number; r: number }) =>
  (cx - b.x) ** 2 + (cy - b.y) ** 2 <= b.r ** 2;

export class Input {
  private keys = new Set<string>();
  private dropQueued = false;
  private missileQueued = false;
  private confirmQueued = false;
  private cardKeyQueued = -1;
  private mouseFire = false;
  private touchFireQueued = false;
  private buttons: TouchButtons = touchButtons();
  private firePointers = new Map<number, { startedAt: number; missileFired: boolean }>();
  private stick = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
  private aimStick = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
  private mouseAim: { x: number; y: number } | null = null;
  /** true once any touch input has been seen (renderer shows touch UI) */
  touchSeen = false;
  /** main.ts sets this to receive canvas-space taps for UI hit testing */
  onTap: ((cx: number, cy: number) => void) | null = null;
  /** main.ts sets this to convert client coords → simulation coords */
  toCanvas: ((x: number, y: number) => { x: number; y: number }) | null = null;
  /** any user gesture happened (for audio unlock) */
  onGesture: (() => void) | null = null;

  attach(el: HTMLElement): void {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.dropQueued = true; e.preventDefault(); }
      if (e.code === 'KeyE') this.missileQueued = true;
      if (e.code === 'Enter') this.confirmQueued = true;
      if (e.code === 'Digit1') this.cardKeyQueued = 0;
      if (e.code === 'Digit2') this.cardKeyQueued = 1;
      if (e.code === 'Digit3') this.cardKeyQueued = 2;
      this.onGesture?.();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    el.addEventListener('pointerdown', e => {
      this.onGesture?.();
      const canvasPt = this.toCanvas ? this.toCanvas(e.clientX, e.clientY) : null;
      if (canvasPt && this.onTap) this.onTap(canvasPt.x, canvasPt.y);
      if (e.pointerType === 'mouse') {
        this.mouseFire = true;
        if (canvasPt) this.mouseAim = canvasPt;
        return;
      }
      this.touchSeen = true;
      // zone split in canvas space so letterboxing can't misroute edge touches
      const leftHalf = canvasPt ? canvasPt.x < VIEW_W / 2 : e.clientX < window.innerWidth / 2;
      if (leftHalf) {
        this.stick = { active: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 };
        return;
      }
      const b = this.buttons;
      if (canvasPt && inCircle(canvasPt.x, canvasPt.y, b.fire)) {
        this.firePointers.set(e.pointerId, { startedAt: performance.now(), missileFired: false });
      } else if (canvasPt && inCircle(canvasPt.x, canvasPt.y, b.drop)) {
        this.dropQueued = true;
      } else {
        this.aimStick = { active: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 };
      }
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' && this.toCanvas) {
        this.mouseAim = this.toCanvas(e.clientX, e.clientY);
        return;
      }
      if (this.stick.active && e.pointerId === this.stick.id) {
        this.stick.dx = e.clientX - this.stick.sx;
        this.stick.dy = e.clientY - this.stick.sy;
      }
      if (this.aimStick.active && e.pointerId === this.aimStick.id) {
        this.aimStick.dx = e.clientX - this.aimStick.sx;
        this.aimStick.dy = e.clientY - this.aimStick.sy;
      }
    });
    const release = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.mouseFire = false;
      if (this.stick.active && e.pointerId === this.stick.id) this.stick.active = false;
      if (this.aimStick.active && e.pointerId === this.aimStick.id) this.aimStick.active = false;
      this.releaseFirePointer(e.pointerId, false);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.mouseFire = false;
      if (this.stick.active && e.pointerId === this.stick.id) this.stick.active = false;
      if (this.aimStick.active && e.pointerId === this.aimStick.id) this.aimStick.active = false;
      this.releaseFirePointer(e.pointerId, true);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', cancel);
  }

  poll(): Intent {
    let x = 0, y = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) x += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) y -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) y += 1;
    if (this.stick.active) {
      const nx = Math.max(-1, Math.min(1, this.stick.dx / 40));
      const ny = Math.max(-1, Math.min(1, this.stick.dy / 40));
      if (Math.abs(nx) > 0.15) x = nx;
      if (Math.abs(ny) > 0.15) y = ny;
    }
    const drop = this.dropQueued;
    this.dropQueued = false;
    this.queueHeldTouchMissiles();
    const touchFire = this.touchFireQueued;
    this.touchFireQueued = false;
    const missile = this.missileQueued;
    this.missileQueued = false;
    return {
      move: { x, y },
      drop,
      fire: this.keys.has('KeyF') || this.mouseFire || touchFire,
      missile,
      aim: null,
    };
  }

  private queueHeldTouchMissiles(): void {
    const now = performance.now();
    for (const fire of this.firePointers.values()) {
      if (!fire.missileFired && now - fire.startedAt >= 350) {
        this.missileQueued = true;
        fire.missileFired = true;
      }
    }
  }

  private releaseFirePointer(pointerId: number, cancelled: boolean): void {
    const fire = this.firePointers.get(pointerId);
    if (!fire) return;
    if (!cancelled) {
      if (fire.missileFired || performance.now() - fire.startedAt >= 350) {
        if (!fire.missileFired) this.missileQueued = true;
      } else {
        this.touchFireQueued = true;
      }
    }
    this.firePointers.delete(pointerId);
  }

  /** Latest mouse position in canvas coords, or null before any mouse motion. */
  aimCanvasPoint(): { x: number; y: number } | null {
    return this.mouseAim;
  }

  /** Raw aim-stick displacement in client px while active, else null. */
  aimStickDir(): { dx: number; dy: number } | null {
    return this.aimStick.active ? { dx: this.aimStick.dx, dy: this.aimStick.dy } : null;
  }

  consumeConfirm(): boolean {
    const c = this.confirmQueued;
    this.confirmQueued = false;
    return c;
  }

  consumeCardKey(): number {
    const c = this.cardKeyQueued;
    this.cardKeyQueued = -1;
    return c;
  }
}
