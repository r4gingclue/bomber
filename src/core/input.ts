export interface Intent {
  move: { x: number; y: number };
  drop: boolean;
  fire: boolean;
}

export class Input {
  private keys = new Set<string>();
  private dropQueued = false;
  private confirmQueued = false;
  private cardKeyQueued = -1;
  private mouseFire = false;
  private touchFire = false;
  private stick = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
  /** main.ts sets this to receive canvas-space taps for UI hit testing */
  onTap: ((cx: number, cy: number) => void) | null = null;
  /** main.ts sets this to convert client coords → canvas coords */
  toCanvas: ((x: number, y: number) => [number, number]) | null = null;
  /** any user gesture happened (for audio unlock) */
  onGesture: (() => void) | null = null;

  attach(el: HTMLElement): void {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.dropQueued = true; e.preventDefault(); }
      if (e.code === 'Enter') this.confirmQueued = true;
      if (e.code === 'Digit1') this.cardKeyQueued = 0;
      if (e.code === 'Digit2') this.cardKeyQueued = 1;
      if (e.code === 'Digit3') this.cardKeyQueued = 2;
      this.onGesture?.();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));

    el.addEventListener('pointerdown', e => {
      this.onGesture?.();
      if (this.toCanvas && this.onTap) {
        const [cx, cy] = this.toCanvas(e.clientX, e.clientY);
        this.onTap(cx, cy);
      }
      if (e.pointerType === 'mouse') {
        this.mouseFire = true;
        return;
      }
      const half = window.innerWidth / 2;
      if (e.clientX < half) {
        this.stick = { active: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 };
      } else if (e.clientY < window.innerHeight / 2) {
        this.touchFire = true;
      } else {
        this.dropQueued = true;
      }
    });
    el.addEventListener('pointermove', e => {
      if (this.stick.active && e.pointerId === this.stick.id) {
        this.stick.dx = e.clientX - this.stick.sx;
        this.stick.dy = e.clientY - this.stick.sy;
      }
    });
    const release = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.mouseFire = false;
      if (this.stick.active && e.pointerId === this.stick.id) this.stick.active = false;
      else if (e.pointerType !== 'mouse') this.touchFire = false;
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  poll(): Intent {
    let x = 0, y = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) x += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) y -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) y += 1;
    if (this.stick.active) {
      // touch stick overrides keys (last-writer wins per axis when moved)
      const nx = Math.max(-1, Math.min(1, this.stick.dx / 40));
      const ny = Math.max(-1, Math.min(1, this.stick.dy / 40));
      if (Math.abs(nx) > 0.15) x = nx;
      if (Math.abs(ny) > 0.15) y = ny;
    }
    const drop = this.dropQueued;
    this.dropQueued = false;
    return {
      move: { x, y },
      drop,
      fire: this.keys.has('KeyF') || this.mouseFire || this.touchFire,
    };
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
