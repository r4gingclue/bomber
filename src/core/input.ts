import { RENDER_H, RENDER_SCALE, RENDER_W } from '../game/consts';
import { uiLayout, type UiCircle } from '../render/ui-layout';
import { GamepadInput } from './gamepad';
import type { UpgradeAction } from './upgrade-navigation';

export interface Intent {
  move: { x: number; y: number };
  drop: boolean;
  fire: boolean;
  missile: boolean;
  sfxUp?: boolean;
  /** world-space aim point; resolved by main.ts from mouse or aim stick */
  aim?: { x: number; y: number } | null;
}

export interface TouchControls {
  move: UiCircle;
  fire: UiCircle;
  drop: UiCircle;
}

/** CSS-pixel touch controls shared with the screen-space renderer. */
export function touchControls(): TouchControls {
  const layout = uiLayout(RENDER_W, RENDER_H, { top: 0, right: 0, bottom: 0, left: 0 }, true);
  return { move: layout.move, fire: layout.fire, drop: layout.drop };
}

/** Simulation-space button geometry retained for callers that use canvas coordinates. */
export function touchButtons(): Pick<TouchControls, 'fire' | 'drop'> {
  const controls = touchControls();
  const toSimulation = ({ x, y, r }: UiCircle): UiCircle =>
    ({ x: x / RENDER_SCALE, y: y / RENDER_SCALE, r: r / RENDER_SCALE });
  return {
    fire: toSimulation(controls.fire),
    drop: toSimulation(controls.drop),
  };
}

const inCircle = (cx: number, cy: number, b: { x: number; y: number; r: number }) =>
  (cx - b.x) ** 2 + (cy - b.y) ** 2 <= b.r ** 2;

export class Input {
  private keys = new Set<string>();
  private dropQueued = false;
  private missileQueued = false;
  private confirmQueued = false;
  private upgradeActionQueued: UpgradeAction | null = null;
  private mouseFire = false;
  private touchFireQueued = false;
  private controls: TouchControls = touchControls();
  private firePointers = new Map<number, { startedAt: number; missileFired: boolean }>();
  private stick = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
  private aimStick = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
  private mouseAim: { x: number; y: number } | null = null;
  private gamepadAim: { dx: number; dy: number } | null = null;
  /** true once any touch input has been seen (renderer shows touch UI) */
  touchSeen = false;
  gamepadConnected = false;
  /** main.ts sets this to receive screen-space taps for UI hit testing */
  onTap: ((cx: number, cy: number) => boolean) | null = null;
  /** main.ts sets this to convert client coords → simulation coords */
  toCanvas: ((x: number, y: number) => { x: number; y: number }) | null = null;
  /** main.ts uses this to keep mouse clicks outside the game viewport inert. */
  isGamePoint: ((x: number, y: number) => boolean) | null = null;
  /** any user gesture happened (for audio unlock) */
  onGesture: (() => void) | null = null;

  constructor(private readonly gamepad = new GamepadInput()) {}

  attach(el: HTMLElement): void {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.dropQueued = true; e.preventDefault(); }
      if (e.code === 'KeyE') this.missileQueued = true;
      if (e.code === 'Enter') this.confirmQueued = true;
      const upgradeAction = keyboardUpgradeAction(e.code);
      if (upgradeAction) {
        this.upgradeActionQueued = upgradeAction;
        e.preventDefault();
      }
      this.onGesture?.();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.resetTransient());

    el.addEventListener('pointerdown', e => {
      this.onGesture?.();
      if (e.pointerType !== 'mouse') this.touchSeen = true;
      if (this.onTap?.(e.clientX, e.clientY)) return;
      const canvasPt = this.toCanvas ? this.toCanvas(e.clientX, e.clientY) : null;
      if (e.pointerType === 'mouse') {
        if (this.isGamePoint && !this.isGamePoint(e.clientX, e.clientY)) return;
        this.mouseFire = true;
        if (canvasPt) this.mouseAim = canvasPt;
        return;
      }
      const controls = this.controls;
      if (inCircle(e.clientX, e.clientY, controls.move)) {
        this.stick = { active: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 };
        return;
      }
      if (inCircle(e.clientX, e.clientY, controls.fire)) {
        this.firePointers.set(e.pointerId, { startedAt: performance.now(), missileFired: false });
      } else if (inCircle(e.clientX, e.clientY, controls.drop)) {
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

  setTouchControls(controls: TouchControls): void {
    this.controls = controls;
  }

  /** Clears held and queued intent when the page loses interaction ownership. */
  resetTransient(): void {
    this.keys.clear();
    this.discardPhaseQueues();
    this.mouseFire = false;
    this.firePointers.clear();
    this.stick = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
    this.aimStick = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
    this.mouseAim = null;
  }

  /** Discards edge-triggered actions when ownership moves to another game phase. */
  discardPhaseQueues(): void {
    this.gamepad.latchGameplayAliasesUntilRelease();
    this.dropQueued = false;
    this.missileQueued = false;
    this.confirmQueued = false;
    this.upgradeActionQueued = null;
    this.touchFireQueued = false;
  }

  poll(): Intent {
    const gamepad = this.gamepad.poll();
    this.gamepadConnected = gamepad.connected;
    this.gamepadAim = gamepad.aim.x !== 0 || gamepad.aim.y !== 0
      ? { dx: gamepad.aim.x * 40, dy: gamepad.aim.y * 40 }
      : null;
    if (gamepad.confirmPressed) this.confirmQueued = true;
    if (gamepad.upgradeAction) this.upgradeActionQueued = gamepad.upgradeAction;
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
    if (gamepad.move.x !== 0) x = gamepad.move.x;
    if (gamepad.move.y !== 0) y = gamepad.move.y;
    const drop = this.dropQueued || gamepad.dropPressed;
    this.dropQueued = false;
    this.queueHeldTouchMissiles();
    const touchFire = this.touchFireQueued;
    this.touchFireQueued = false;
    const missile = this.missileQueued || gamepad.missilePressed;
    this.missileQueued = false;
    return {
      move: { x, y },
      drop,
      fire: this.keys.has('KeyF') || this.mouseFire || touchFire || gamepad.fire,
      missile,
      sfxUp: gamepad.sfxPressed,
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
    return this.aimStick.active
      ? { dx: this.aimStick.dx, dy: this.aimStick.dy }
      : this.gamepadAim;
  }

  consumeConfirm(): boolean {
    const c = this.confirmQueued;
    this.confirmQueued = false;
    return c;
  }

  consumeUpgradeAction(): UpgradeAction | null {
    const action = this.upgradeActionQueued;
    this.upgradeActionQueued = null;
    return action;
  }
}

function keyboardUpgradeAction(code: string): UpgradeAction | null {
  switch (code) {
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'Enter': return 'select';
    case 'Backspace': return 'refund';
    case 'Space': return 'continue';
    default: return null;
  }
}
