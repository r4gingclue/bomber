const FATAL_TITLE = 'SEA BOMBER FAILED TO START';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Unknown startup error');
}

export function renderFatalBootError(canvas: HTMLCanvasElement, error: unknown): string {
  const detail = errorMessage(error);
  const message = `${FATAL_TITLE}: ${detail}`;
  canvas.setAttribute('role', 'alert');
  canvas.setAttribute('aria-label', message);

  const ctx = canvas.getContext('2d');
  if (!ctx) return message;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#170d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(FATAL_TITLE, canvas.width / 2, canvas.height / 2 - 28);
  ctx.fillStyle = '#ffe2e2';
  ctx.font = '20px monospace';
  ctx.fillText(detail, canvas.width / 2, canvas.height / 2 + 18);
  ctx.restore();
  return message;
}
