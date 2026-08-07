import type { Insets } from './viewport';
import type { UiRect } from './ui-layout';

export interface AudioSettingsLayout {
  panel: UiRect;
  music: UiRect;
  sfx: UiRect;
  mute: UiRect;
  credits: UiRect;
  toggle: UiRect;
  start: UiRect;
}

export type AudioSettingsHit =
  | { control: 'music' | 'sfx'; value: number }
  | { control: 'mute' | 'credits' | 'toggle' | 'start' };

export interface AudioSettingsView {
  music: number;
  sfx: number;
  muted: boolean;
  creditsOpen: boolean;
  settingsCollapsed: boolean;
}

export const AUDIO_CREDIT_LINES = [
  'Music: Potriel / Foozle',
  'SFX: Kenney, FacadeGaikan',
  'Water: jcpmcdonald · Sonar: Spiceman',
  'Ambience: Mish7913, IgnasD · CC0',
] as const;

export function audioSettingsLayout(w: number, h: number, insets: Insets): AudioSettingsLayout {
  const availableW = w - insets.left - insets.right;
  const availableH = h - insets.top - insets.bottom;
  const isSmall = h < 700 || w < 500;
  const panelW = isSmall
    ? Math.min(280, Math.max(240, availableW - 32))
    : Math.min(360, Math.max(280, availableW - 24));
  const panelH = isSmall ? 140 : 200;
  const x = insets.left + (availableW - panelW) / 2;
  // Position panel at bottom
  const y = insets.top + availableH - panelH - 4;
  const labelW = isSmall ? 48 : 56;
  const trackX = x + 12 + labelW;
  const trackW = panelW - labelW - 28;
  const btnW = (panelW - 32) / 2;

  if (isSmall) {
    // Rows are laid out top-down so slider and button rows never collide.
    const sliderH = 22;
    const rowH = 32;
    const musicY = y + 6;
    const sfxY = musicY + sliderH + 4;
    const secondRowY = sfxY + sliderH + 6;
    const bottomY = secondRowY + rowH + 6;
    return {
      panel: { x, y, w: panelW, h: panelH },
      music: { x: trackX, y: musicY, w: trackW, h: sliderH },
      sfx: { x: trackX, y: sfxY, w: trackW, h: sliderH },
      mute: { x: x + 12, y: secondRowY, w: btnW, h: rowH },
      credits: { x: x + 16 + btnW, y: secondRowY, w: btnW, h: rowH },
      toggle: { x: x + 12, y: bottomY, w: btnW, h: rowH },
      start: { x: x + 16 + btnW, y: bottomY, w: btnW, h: rowH },
    };
  }

  // Bottom row: toggle (left) and start (right) - always visible
  const bottomY = y + panelH - 44;
  // Second row from bottom: mute (left) and credits (right) - hidden when collapsed
  const secondRowY = y + panelH - 96;
  const sliderGap = 40;
  return {
    panel: { x, y, w: panelW, h: panelH },
    music: { x: trackX, y: y + 16, w: trackW, h: 32 },
    sfx: { x: trackX, y: y + 16 + sliderGap, w: trackW, h: 32 },
    mute: { x: x + 12, y: secondRowY, w: btnW, h: 40 },
    credits: { x: x + 16 + btnW, y: secondRowY, w: btnW, h: 40 },
    toggle: { x: x + 12, y: bottomY, w: btnW, h: 40 },
    start: { x: x + 16 + btnW, y: bottomY, w: btnW, h: 40 },
  };
}

export function sliderValue(track: UiRect, x: number): number {
  return Math.max(0, Math.min(1, (x - track.x) / track.w));
}

export function audioSettingsHit(layout: AudioSettingsLayout, point: { x: number; y: number }): AudioSettingsHit | null {
  if (contains(layout.music, point)) return { control: 'music', value: sliderValue(layout.music, point.x) };
  if (contains(layout.sfx, point)) return { control: 'sfx', value: sliderValue(layout.sfx, point.x) };
  if (contains(layout.toggle, point)) return { control: 'toggle' };
  if (contains(layout.start, point)) return { control: 'start' };
  if (contains(layout.mute, point)) return { control: 'mute' };
  if (contains(layout.credits, point)) return { control: 'credits' };
  return null;
}

function contains(rect: UiRect, point: { x: number; y: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w
    && point.y >= rect.y && point.y <= rect.y + rect.h;
}
