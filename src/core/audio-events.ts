export const AUDIO_EVENTS = [
  'cannon-fire', 'player-missile-launch', 'enemy-sam-launch',
  'depth-charge-drop', 'water-entry', 'underwater-explosion',
  'aircraft-explosion', 'armor-hit', 'player-damaged', 'sonar-ping',
  'ui-confirm', 'upgrade-selected', 'wave-start', 'wave-clear', 'game-over',
] as const;

export type AudioEvent = typeof AUDIO_EVENTS[number];
export type ProceduralAudioKind = 'boom' | 'splash' | 'drop' | 'fire' | 'hit' | 'ping' | 'ui' | 'die';

const EVENT_SET = new Set<string>(AUDIO_EVENTS);

export function isAudioEvent(value: unknown): value is AudioEvent {
  return typeof value === 'string' && EVENT_SET.has(value);
}

export function proceduralAudioKind(event: AudioEvent): ProceduralAudioKind {
  switch (event) {
    case 'cannon-fire':
    case 'player-missile-launch':
    case 'enemy-sam-launch': return 'fire';
    case 'depth-charge-drop': return 'drop';
    case 'water-entry': return 'splash';
    case 'underwater-explosion':
    case 'aircraft-explosion': return 'boom';
    case 'armor-hit':
    case 'player-damaged': return 'hit';
    case 'sonar-ping': return 'ping';
    case 'ui-confirm':
    case 'upgrade-selected':
    case 'wave-start':
    case 'wave-clear': return 'ui';
    case 'game-over': return 'die';
  }
}
