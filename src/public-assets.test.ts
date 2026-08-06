import { describe, expect, it } from 'vitest';
import { AUDIO_MANIFEST } from './audio/manifest';
import { GRAPHICS_MANIFEST } from './render/assets';

const deploymentUrl = 'https://r4gingclue.github.io/bomber/';

function assetUrls(): string[] {
  const graphics = [
    ...Object.values(GRAPHICS_MANIFEST.player).map(sprite => sprite.url),
    ...Object.values(GRAPHICS_MANIFEST.enemy).map(frame => frame.url),
    ...Object.values(GRAPHICS_MANIFEST.vehicle).map(frame => frame.url),
    ...Object.values(GRAPHICS_MANIFEST.weapon).map(frame => frame.url),
    ...Object.values(GRAPHICS_MANIFEST.scenery),
  ];
  const audio = [
    ...Object.values(AUDIO_MANIFEST.music).flatMap(cue => cue.variants),
    ...Object.values(AUDIO_MANIFEST.cues).flatMap(cue => cue?.variants ?? []),
  ];
  return [...graphics, ...audio];
}

describe('public asset URLs', () => {
  it('stay beneath the GitHub Pages repository path', () => {
    for (const asset of assetUrls()) {
      expect(new URL(asset, deploymentUrl).pathname).toMatch(/^\/bomber\/assets\//);
    }
  });
});
