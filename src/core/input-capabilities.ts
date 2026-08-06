export interface InputCapabilities {
  maxTouchPoints: number;
  coarsePrimaryPointer: boolean;
  hasFinePointer: boolean;
  canHover: boolean;
}

export function prefersDefaultTouchUi(capabilities: InputCapabilities): boolean {
  return capabilities.maxTouchPoints > 0
    && capabilities.coarsePrimaryPointer
    && !capabilities.hasFinePointer
    && !capabilities.canHover;
}

export function browserPrefersDefaultTouchUi(
  navigatorLike: Pick<Navigator, 'maxTouchPoints'> = navigator,
  matchMediaLike: typeof matchMedia = matchMedia,
): boolean {
  return prefersDefaultTouchUi({
    maxTouchPoints: navigatorLike.maxTouchPoints,
    coarsePrimaryPointer: matchMediaLike('(pointer: coarse)').matches,
    hasFinePointer: matchMediaLike('(any-pointer: fine)').matches,
    canHover: matchMediaLike('(any-hover: hover)').matches,
  });
}
