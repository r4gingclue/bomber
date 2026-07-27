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
