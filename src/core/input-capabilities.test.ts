import { describe, expect, it } from 'vitest';
import { prefersDefaultTouchUi } from './input-capabilities';

describe('prefersDefaultTouchUi', () => {
  it('shows touch controls on a touch-first device without a fine pointer', () => {
    expect(prefersDefaultTouchUi({
      maxTouchPoints: 5,
      coarsePrimaryPointer: true,
      hasFinePointer: false,
      canHover: false,
    })).toBe(true);
  });

  it('keeps touch controls hidden on touchscreen laptops with mouse-like input', () => {
    expect(prefersDefaultTouchUi({
      maxTouchPoints: 10,
      coarsePrimaryPointer: false,
      hasFinePointer: true,
      canHover: true,
    })).toBe(false);
  });

  it('keeps touch controls hidden when a fine pointer is attached to a tablet', () => {
    expect(prefersDefaultTouchUi({
      maxTouchPoints: 5,
      coarsePrimaryPointer: true,
      hasFinePointer: true,
      canHover: true,
    })).toBe(false);
  });

  it('does not infer touch input from coarse pointer media alone', () => {
    expect(prefersDefaultTouchUi({
      maxTouchPoints: 0,
      coarsePrimaryPointer: true,
      hasFinePointer: false,
      canHover: false,
    })).toBe(false);
  });
});
