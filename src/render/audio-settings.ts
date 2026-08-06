import type { Insets } from './viewport';
import type { UiRect } from './ui-layout';

export interface AudioSettingsLayout {
  panel: UiRect;
  music: UiRect;
  sfx: UiRect;
  mute: UiRect;
  credits: UiRect;
}

export type AudioSettingsHit =
  | { control: 'music' | 'sfx'; value: number }
  | { control: 'mute' | 'credits' };

export interface AudioSettingsView {
  music: number;
  sfx: number;
  muted: boolean;
  creditsOpen: boolean;
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
  const panelW = Math.min(360, Math.max(280, availableW - 24));
  const panelH = Math.min(190, availableH - 24);
  const x = insets.left + (availableW - panelW) / 2;
  const y = insets.top + Math.max(12, availableH - panelH - 16);
  const labelW = 72;
  const trackX = x + 16 + labelW;
  const trackW = panelW - labelW - 32;
  return {
    panel: { x, y, w: panelW, h: panelH },
    music: { x: trackX, y: y + 20, w: trackW, h: 36 },
    sfx: { x: trackX, y: y + 68, w: trackW, h: 36 },
    mute: { x: x + 16, y: y + panelH - 52, w: (panelW - 40) / 2, h: 40 },
    credits: { x: x + 24 + (panelW - 40) / 2, y: y + panelH - 52, w: (panelW - 40) / 2, h: 40 },
  };
}

export function sliderValue(track: UiRect, x: number): number {
  return Math.max(0, Math.min(1, (x - track.x) / track.w));
}

export function audioSettingsHit(layout: AudioSettingsLayout, point: { x: number; y: number }): AudioSettingsHit | null {
  if (contains(layout.music, point)) return { control: 'music', value: sliderValue(layout.music, point.x) };
  if (contains(layout.sfx, point)) return { control: 'sfx', value: sliderValue(layout.sfx, point.x) };
  if (contains(layout.mute, point)) return { control: 'mute' };
  if (contains(layout.credits, point)) return { control: 'credits' };
  return null;
}

function contains(rect: UiRect, point: { x: number; y: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w
    && point.y >= rect.y && point.y <= rect.y + rect.h;
}
