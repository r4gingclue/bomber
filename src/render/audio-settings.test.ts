import { expect, it } from 'vitest';
import { audioSettingsHit, audioSettingsLayout, sliderValue } from './audio-settings';

it.each([
  [960, 540, { top: 0, right: 0, bottom: 0, left: 0 }],
  [844, 390, { top: 0, right: 47, bottom: 21, left: 47 }],
  [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }],
] as const)('keeps the audio panel inside the %ix%i safe area', (w, h, insets) => {
  const layout = audioSettingsLayout(w, h, insets);
  expect(layout.panel.x).toBeGreaterThanOrEqual(insets.left);
  expect(layout.panel.y).toBeGreaterThanOrEqual(insets.top);
  expect(layout.panel.x + layout.panel.w).toBeLessThanOrEqual(w - insets.right);
  expect(layout.panel.y + layout.panel.h).toBeLessThanOrEqual(h - insets.bottom);
});

it('maps slider edges to zero and one and clamps outside points', () => {
  const track = { x: 100, y: 20, w: 200, h: 24 };
  expect(sliderValue(track, 50)).toBe(0);
  expect(sliderValue(track, 100)).toBe(0);
  expect(sliderValue(track, 300)).toBe(1);
  expect(sliderValue(track, 350)).toBe(1);
});

it('distinguishes music, SFX, mute, credits, and outside taps', () => {
  const layout = audioSettingsLayout(960, 540, { top: 0, right: 0, bottom: 0, left: 0 });
  const center = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  expect(audioSettingsHit(layout, center(layout.music))).toMatchObject({ control: 'music' });
  expect(audioSettingsHit(layout, center(layout.sfx))).toMatchObject({ control: 'sfx' });
  expect(audioSettingsHit(layout, center(layout.mute))).toEqual({ control: 'mute' });
  expect(audioSettingsHit(layout, center(layout.credits))).toEqual({ control: 'credits' });
  expect(audioSettingsHit(layout, { x: 0, y: 0 })).toBeNull();
});
