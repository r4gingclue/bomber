export const STEP = 1 / 60;
const MAX_FRAME = 0.25;

export class FixedStepper {
  private acc = 0;
  constructor(private step = STEP, private maxFrame = MAX_FRAME) {}

  advance(dt: number): number {
    this.acc += Math.min(dt, this.maxFrame);
    let n = 0;
    while (this.acc >= this.step) {
      this.acc -= this.step;
      n++;
    }
    return n;
  }

  get alpha(): number {
    return this.acc / this.step;
  }
}

export class Loop {
  private stepper = new FixedStepper();
  private last = 0;
  private raf = 0;
  running = false;

  constructor(
    private update: (dt: number) => void,
    private render: (alpha: number, deliveredFrameMs: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const deliveredFrameMs = now - this.last;
      const dt = deliveredFrameMs / 1000;
      this.last = now;
      const n = this.stepper.advance(dt);
      for (let i = 0; i < n; i++) this.update(STEP);
      this.render(this.stepper.alpha, deliveredFrameMs);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
