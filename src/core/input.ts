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
  missile: UiCircle;
  drop: UiCircle;
  aim: UiCircle;
  /** client-x boundary: touches left of this move, right of this aim */
  zoneSplitX: number;
}

/** CSS-pixel touch controls shared with the screen-space renderer. */
export function touchControls(): TouchControls {
  const layout = uiLayout(RENDER_W, RENDER_H, { top: 0, right: 0, bottom: 0, left: 0 }, true);
  return {
    move: layout.move,
    aim: layout.aim,
    missile: layout.missile,
    drop: layout.drop,
    zoneSplitX: layout.zoneSplitX,
  };
}

/** Simulation-space button geometry retained for callers that use canvas coordinates. */
export function touchButtons(): Pick<TouchControls, 'missile' | 'drop'> {
  const controls = touchControls();
  const toSimulation = ({ x, y, r }: UiCircle): UiCircle =>
    ({ x: x / RENDER_SCALE, y: y / RENDER_SCALE, r: r / RENDER_SCALE });
  return {
    missile: toSimulation(controls.missile),
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
  private controls: TouchControls = touchControls();
  private steerPointer: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null;
  private aimPointer: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null;
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
      if (e.clientX < controls.zoneSplitX) {
        // Left zone: movement joystick
        if (this.steerPointer) return;
        this.steerPointer = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
      } else {
        // Right zone: check buttons first, then aim joystick
        if (inCircle(e.clientX, e.clientY, controls.missile)) {
          this.missileQueued = true;
          return;
        }
        if (inCircle(e.clientX, e.clientY, controls.drop)) {
          this.dropQueued = true;
          return;
        }
        if (this.aimPointer) return;
        this.aimPointer = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
      }
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' && this.toCanvas) {
        this.mouseAim = this.toCanvas(e.clientX, e.clientY);
        return;
      }
      if (this.steerPointer && e.pointerId === this.steerPointer.id) {
        this.steerPointer.dx = e.clientX - this.steerPointer.ox;
        this.steerPointer.dy = e.clientY - this.steerPointer.oy;
      }
      if (this.aimPointer && e.pointerId === this.aimPointer.id) {
        this.aimPointer.dx = e.clientX - this.aimPointer.ox;
        this.aimPointer.dy = e.clientY - this.aimPointer.oy;
      }
    });
    const endPointer = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.mouseFire = false;
      if (this.steerPointer?.id === e.pointerId) this.steerPointer = null;
      if (this.aimPointer?.id === e.pointerId) this.aimPointer = null;
    };
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
  }

  setTouchControls(controls: TouchControls): void {
    this.controls = controls;
  }

  /** Clears held and queued intent when the page loses interaction ownership. */
  resetTransient(): void {
    this.keys.clear();
    this.discardPhaseQueues();
    this.mouseFire = false;
    this.steerPointer = null;
    this.aimPointer = null;
    this.mouseAim = null;
  }

  /** Discards edge-triggered actions when ownership moves to another game phase. */
  discardPhaseQueues(): void {
    this.gamepad.latchGameplayAliasesUntilRelease();
    this.dropQueued = false;
    this.missileQueued = false;
    this.confirmQueued = false;
    this.upgradeActionQueued = null;
    this.steerPointer = null;
    this.aimPointer = null;
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
    if (this.steerPointer) {
      const nx = Math.max(-1, Math.min(1, this.steerPointer.dx / 40));
      const ny = Math.max(-1, Math.min(1, this.steerPointer.dy / 40));
      if (Math.abs(nx) > 0.15) x = nx;
      if (Math.abs(ny) > 0.15) y = ny;
    }
    if (gamepad.move.x !== 0) x = gamepad.move.x;
    if (gamepad.move.y !== 0) y = gamepad.move.y;
    const drop = this.dropQueued || gamepad.dropPressed;
    this.dropQueued = false;
    const missile = this.missileQueued || gamepad.missilePressed;
    this.missileQueued = false;
    return {
      move: { x, y },
      drop,
      fire: this.keys.has('KeyF') || this.mouseFire || this.aimPointer !== null || gamepad.fire,
      missile,
      sfxUp: gamepad.sfxPressed,
      aim: null,
    };
  }

  /** Latest aim point in simulation coords: held touch first, else the mouse. */
  aimCanvasPoint(): { x: number; y: number } | null {
    if (this.aimPointer && this.toCanvas) {
      const base = this.controls.aim;
      const len = Math.hypot(this.aimPointer.dx, this.aimPointer.dy);
      const cap = len > base.r ? base.r / len : 1;
      const simX = this.aimPointer.ox + this.aimPointer.dx * cap;
      const simY = this.aimPointer.oy + this.aimPointer.dy * cap;
      return this.toCanvas(simX, simY);
    }
    return this.mouseAim;
  }

  /** Relative aim displacement from right joystick — touch or gamepad. */
  aimStickDir(): { dx: number; dy: number } | null {
    if (this.aimPointer) {
      const base = this.controls.aim;
      const len = Math.hypot(this.aimPointer.dx, this.aimPointer.dy);
      const cap = len > base.r ? base.r / len : 1;
      return { dx: this.aimPointer.dx * cap, dy: this.aimPointer.dy * cap };
    }
    return this.gamepadAim;
  }

  /** Live floating-control state for the screen-space renderer. */
  touchVisuals(): {
    steer: { ox: number; oy: number; dx: number; dy: number } | null;
    aim: { ox: number; oy: number; dx: number; dy: number } | null;
  } {
    return {
      steer: this.steerPointer
        ? {
          ox: this.steerPointer.ox,
          oy: this.steerPointer.oy,
          dx: this.steerPointer.dx,
          dy: this.steerPointer.dy,
        }
        : null,
      aim: this.aimPointer
        ? {
          ox: this.aimPointer.ox,
          oy: this.aimPointer.oy,
          dx: this.aimPointer.dx,
          dy: this.aimPointer.dy,
        }
        : null,
    };
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
