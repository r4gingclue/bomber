export type DamageFlashMode = 'fill' | 'border';

export function damageFlashMode(reduced: boolean): DamageFlashMode {
  return reduced ? 'border' : 'fill';
}

export function reducedMotionFlag(media: MediaQueryList): { readonly value: boolean; dispose(): void } {
  let value = media.matches;
  const update = (event: MediaQueryListEvent) => { value = event.matches; };
  media.addEventListener('change', update);
  return {
    get value() { return value; },
    dispose: () => media.removeEventListener('change', update),
  };
}
