export interface ScreenCanvasSize {
  cssWidth: number;
  cssHeight: number;
  backingWidth: number;
  backingHeight: number;
}

/** Keeps a high-DPR backing store mapped one-to-one to CSS-pixel UI geometry. */
export function screenCanvasSize(width: number, height: number, devicePixelRatio: number): ScreenCanvasSize {
  const pixelRatio = Math.max(1, devicePixelRatio || 1);
  return {
    cssWidth: width,
    cssHeight: height,
    backingWidth: Math.round(width * pixelRatio),
    backingHeight: Math.round(height * pixelRatio),
  };
}

const normalizedPixelRatio = (value: number): number =>
  Math.max(1, Number.isFinite(value) ? value : 1);

/** Detects display-scale changes even when the CSS viewport did not resize. */
export class DevicePixelRatioMonitor {
  private current: number;

  constructor(initial: number) {
    this.current = normalizedPixelRatio(initial);
  }

  changed(next: number): boolean {
    const normalized = normalizedPixelRatio(next);
    if (normalized === this.current) return false;
    this.current = normalized;
    return true;
  }
}
