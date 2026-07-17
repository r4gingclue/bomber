export type Biome = 'sea' | 'coast' | 'inland';

/** inland joins the rotation in Plan 2 when its ground/air roster exists */
export const BIOME_ORDER: Biome[] = ['sea', 'coast'];

export function biomeForAct(act: number): Biome {
  return BIOME_ORDER[(act - 1) % BIOME_ORDER.length];
}

const BIOME_NAMES: Record<Biome, string> = {
  sea: 'OPEN SEA',
  coast: 'COASTAL STRIKE',
  inland: 'INLAND ASSAULT',
};

export function actTitle(act: number): string {
  return `ACT ${act} — ${BIOME_NAMES[biomeForAct(act)]}`;
}

export interface BiomePalette {
  skyTop: string;
  skyBottom: string;
  seaTop: string;
  seaDeep: string;
  ground: string;
  groundDark: string;
}

export const PALETTES: Record<Biome, BiomePalette> = {
  sea:    { skyTop: '#2a4a9e', skyBottom: '#7ba6e0', seaTop: '#0e4a8a', seaDeep: '#03101f', ground: '#c8b078', groundDark: '#8a7550' },
  coast:  { skyTop: '#3a5aae', skyBottom: '#9ab8e8', seaTop: '#0e5a8a', seaDeep: '#052030', ground: '#c8b078', groundDark: '#8a7550' },
  inland: { skyTop: '#4a6a9e', skyBottom: '#a8c0d8', seaTop: '#0e4a8a', seaDeep: '#03101f', ground: '#5a7a4a', groundDark: '#3a5230' },
};
