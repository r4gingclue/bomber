import type { Rng } from '../core/rng';

export interface PlayerStats {
  maxHp: number;
  accel: number;
  blastRadius: number;
  maxCharges: number;
  sinkSpeed: number;
  dualDrop: boolean;
  magnetic: boolean;
  sonar: boolean;
  pointDefense: boolean;
}

export function defaultStats(): PlayerStats {
  return {
    maxHp: 100,
    accel: 340,
    blastRadius: 26,
    maxCharges: 2,
    sinkSpeed: 34,
    dualDrop: false,
    magnetic: false,
    sonar: false,
    pointDefense: false,
  };
}

export interface UpgradeCard {
  id: string;
  name: string;
  desc: string;
  repeatable: boolean;
  apply: (s: PlayerStats) => void;
}

export const CARD_POOL: UpgradeCard[] = [
  { id: 'blast',  name: 'Bigger Boom',      desc: '+30% blast radius',        repeatable: true,  apply: s => { s.blastRadius *= 1.3; } },
  { id: 'charge', name: 'Extra Rack',       desc: '+1 charge in flight',      repeatable: true,  apply: s => { s.maxCharges += 1; } },
  { id: 'sink',   name: 'Lead Casing',      desc: '+40% sink speed',          repeatable: true,  apply: s => { s.sinkSpeed *= 1.4; } },
  { id: 'engine', name: 'Turbo Engine',     desc: '+25% thrust',              repeatable: true,  apply: s => { s.accel *= 1.25; } },
  { id: 'armor',  name: 'Armor Plating',    desc: '+30 max HP',               repeatable: true,  apply: s => { s.maxHp += 30; } },
  { id: 'dual',   name: 'Dual Drop',        desc: 'Two charges per drop',     repeatable: false, apply: s => { s.dualDrop = true; } },
  { id: 'magnet', name: 'Magnetic Charges', desc: 'Charges curve to subs',    repeatable: false, apply: s => { s.magnetic = true; } },
  { id: 'sonar',  name: 'Sonar Ping',       desc: 'Subs outlined regularly',  repeatable: false, apply: s => { s.sonar = true; } },
  { id: 'pd',     name: 'Point Defense',    desc: 'Auto-clips near missiles', repeatable: false, apply: s => { s.pointDefense = true; } },
];

export function drawCards(rng: Rng, owned: ReadonlySet<string>, n = 3): UpgradeCard[] {
  const pool = CARD_POOL.filter(c => c.repeatable || !owned.has(c.id));
  const out: UpgradeCard[] = [];
  while (out.length < n && pool.length > 0) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}
