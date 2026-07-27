import { expect, it } from 'vitest';
import { damageFlashMode, reducedMotionFlag } from './motion';

it('uses a border pulse rather than a fill when motion reduction is enabled', () => {
  expect(damageFlashMode(false)).toBe('fill');
  expect(damageFlashMode(true)).toBe('border');
});

it('caches the media preference and updates when it changes', () => {
  let listener: ((event: MediaQueryListEvent) => void) | undefined;
  const media = {
    matches: false,
    addEventListener: (_: 'change', cb: (event: MediaQueryListEvent) => void) => { listener = cb; },
    removeEventListener: () => undefined,
  } as unknown as MediaQueryList;
  const flag = reducedMotionFlag(media);

  expect(flag.value).toBe(false);
  listener?.({ matches: true } as MediaQueryListEvent);
  expect(flag.value).toBe(true);
  flag.dispose();
});
