import { defaultStats, type PlayerStats } from './upgrades';

export type UpgradeBranch = 'weapons' | 'ordnance' | 'defense' | 'flight';

export type UpgradeId =
  | 'rapid-fire-1'
  | 'cannon-damage-1'
  | 'rapid-fire-2'
  | 'heavy-rounds'
  | 'piercing'
  | 'multishot'
  | 'missile-rack'
  | 'faster-reload'
  | 'improved-tracking'
  | 'expanded-rack'
  | 'lead-casing'
  | 'bigger-boom-1'
  | 'payload-damage'
  | 'bigger-boom-2'
  | 'dual-drop'
  | 'magnetic-charges'
  | 'armor-1'
  | 'field-repair'
  | 'armor-2'
  | 'point-defense'
  | 'reinforced-defense'
  | 'turbo-1'
  | 'airframe'
  | 'turbo-2'
  | 'sonar'
  | 'advanced-avionics';

export interface UpgradeNode {
  id: UpgradeId;
  branch: UpgradeBranch;
  name: string;
  description: string;
  cost: number;
  requires: UpgradeId[];
  exclusionGroup?: string;
  apply(stats: PlayerStats): void;
}

export type StatModifier = (stats: PlayerStats) => void;

const BALANCE = {
  rapidFireOne: 1.12,
  cannonDamageOne: 1.15,
  rapidFireTwo: 1.15,
  heavyRounds: 1.25,
  trackingSteering: 1.25,
  trackingAcquisition: 1.2,
  leadCasing: 1.3,
  biggerBoomOne: 1.2,
  payloadDamage: 1.25,
  biggerBoomTwo: 1.25,
  armorOne: 20,
  armorTwo: 30,
  fieldRepair: 12,
  reinforcedDefenseCooldown: 0.32,
  turboOne: 1.15,
  airframeSpeed: 1.12,
  airframeDrift: 0.9,
  turboTwo: 1.2,
  sonarInterval: 6,
  avionicsAcquisition: 1.2,
} as const;

export const UPGRADE_NODES: UpgradeNode[] = [
  { id: 'rapid-fire-1', branch: 'weapons', name: 'Rapid Fire I', description: '12% faster cannon fire rate.', cost: 1, requires: [], apply: stats => { stats.cannonCooldown /= BALANCE.rapidFireOne; } },
  { id: 'cannon-damage-1', branch: 'weapons', name: 'Cannon Damage I', description: '15% more cannon damage.', cost: 1, requires: [], apply: stats => { stats.cannonDamage *= BALANCE.cannonDamageOne; } },
  { id: 'rapid-fire-2', branch: 'weapons', name: 'Rapid Fire II', description: 'A further 15% faster cannon fire rate.', cost: 2, requires: ['rapid-fire-1'], apply: stats => { stats.cannonCooldown /= BALANCE.rapidFireTwo; } },
  { id: 'heavy-rounds', branch: 'weapons', name: 'Heavy Rounds', description: 'A further 25% cannon damage.', cost: 2, requires: ['cannon-damage-1'], apply: stats => { stats.cannonDamage *= BALANCE.heavyRounds; } },
  { id: 'piercing', branch: 'weapons', name: 'Piercing Rounds', description: 'Cannon rounds continue through one enemy.', cost: 3, requires: ['rapid-fire-2', 'heavy-rounds'], exclusionGroup: 'cannon-specialist', apply: stats => { stats.cannonPierce = 1; } },
  { id: 'multishot', branch: 'weapons', name: 'Multishot', description: 'Fire two rounds in a six-degree spread per trigger pull.', cost: 3, requires: ['rapid-fire-2', 'heavy-rounds'], exclusionGroup: 'cannon-specialist', apply: stats => { stats.cannonShots = 2; } },
  { id: 'missile-rack', branch: 'weapons', name: 'Missile Rack', description: 'Unlock two air-to-air missiles.', cost: 1, requires: [], apply: stats => { stats.missileCap = 2; } },
  { id: 'faster-reload', branch: 'weapons', name: 'Faster Reload', description: 'Replenish two missiles at each wave start.', cost: 2, requires: ['missile-rack'], apply: stats => { stats.missileRefill = 2; } },
  { id: 'improved-tracking', branch: 'weapons', name: 'Improved Tracking', description: '25% more missile steering and 20% more acquisition range.', cost: 2, requires: ['missile-rack'], apply: stats => { stats.missileSteering *= BALANCE.trackingSteering; stats.missileAcquireScale *= BALANCE.trackingAcquisition; } },
  { id: 'expanded-rack', branch: 'weapons', name: 'Expanded Rack', description: 'Increase maximum missile capacity from two to six.', cost: 3, requires: ['faster-reload', 'improved-tracking'], apply: stats => { stats.missileCap = 6; } },
  { id: 'lead-casing', branch: 'ordnance', name: 'Lead Casing', description: '30% faster depth-charge sink speed.', cost: 1, requires: [], apply: stats => { stats.sinkSpeed *= BALANCE.leadCasing; } },
  { id: 'bigger-boom-1', branch: 'ordnance', name: 'Bigger Boom I', description: '20% larger blast radius.', cost: 1, requires: [], apply: stats => { stats.blastRadius *= BALANCE.biggerBoomOne; } },
  { id: 'payload-damage', branch: 'ordnance', name: 'Payload Damage', description: '25% more depth-charge explosion damage.', cost: 2, requires: ['lead-casing'], apply: stats => { stats.chargeDamage *= BALANCE.payloadDamage; } },
  { id: 'bigger-boom-2', branch: 'ordnance', name: 'Bigger Boom II', description: 'A further 25% larger blast radius.', cost: 2, requires: ['bigger-boom-1'], apply: stats => { stats.blastRadius *= BALANCE.biggerBoomTwo; } },
  { id: 'dual-drop', branch: 'ordnance', name: 'Dual Drop', description: 'Release two charges per drop.', cost: 3, requires: ['payload-damage', 'bigger-boom-2'], exclusionGroup: 'ordnance-specialist', apply: stats => { stats.dualDrop = true; } },
  { id: 'magnetic-charges', branch: 'ordnance', name: 'Magnetic Charges', description: 'Curve submerged charges toward nearby targets.', cost: 3, requires: ['payload-damage', 'bigger-boom-2'], exclusionGroup: 'ordnance-specialist', apply: stats => { stats.magnetic = true; } },
  { id: 'armor-1', branch: 'defense', name: 'Armor Plating I', description: 'Increase maximum health by 20.', cost: 1, requires: [], apply: stats => { stats.maxHp += BALANCE.armorOne; } },
  { id: 'field-repair', branch: 'defense', name: 'Field Repair', description: 'Restore 12 health after each cleared wave.', cost: 2, requires: ['armor-1'], apply: stats => { stats.fieldRepair = BALANCE.fieldRepair; } },
  { id: 'armor-2', branch: 'defense', name: 'Armor Plating II', description: 'Increase maximum health by another 30.', cost: 2, requires: ['armor-1'], apply: stats => { stats.maxHp += BALANCE.armorTwo; } },
  { id: 'point-defense', branch: 'defense', name: 'Point Defense', description: 'Unlock close-range projectile interception.', cost: 3, requires: ['field-repair', 'armor-2'], apply: stats => { stats.pointDefense = true; } },
  { id: 'reinforced-defense', branch: 'defense', name: 'Reinforced Defense', description: 'Reduce Point Defense cooldown to 0.32 seconds.', cost: 4, requires: ['point-defense'], apply: stats => { stats.pointDefenseCooldown = BALANCE.reinforcedDefenseCooldown; } },
  { id: 'turbo-1', branch: 'flight', name: 'Turbo Engine I', description: '15% more acceleration.', cost: 1, requires: [], apply: stats => { stats.accel *= BALANCE.turboOne; } },
  { id: 'airframe', branch: 'flight', name: 'Airframe', description: '12% more top speed and 10% less directional drift.', cost: 1, requires: [], apply: stats => { stats.speedScale *= BALANCE.airframeSpeed; stats.handlingScale *= BALANCE.airframeDrift; } },
  { id: 'turbo-2', branch: 'flight', name: 'Turbo Engine II', description: 'A further 20% more acceleration.', cost: 2, requires: ['turbo-1'], apply: stats => { stats.accel *= BALANCE.turboTwo; } },
  { id: 'sonar', branch: 'flight', name: 'Sonar', description: 'Outline submarines for three seconds every eight seconds.', cost: 2, requires: ['airframe'], apply: stats => { stats.sonar = true; } },
  { id: 'advanced-avionics', branch: 'flight', name: 'Advanced Avionics', description: 'Reduce sonar cycle to six seconds and improve missile acquisition range by 20%.', cost: 3, requires: ['turbo-2', 'sonar'], apply: stats => { stats.sonarInterval = BALANCE.sonarInterval; stats.missileAcquireScale *= BALANCE.avionicsAcquisition; } },
];

function validateNodes(nodes: readonly UpgradeNode[]): void {
  const ids = new Set<UpgradeId>();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`Duplicate upgrade ID: ${node.id}`);
    if (node.cost < 1 || node.cost > 4) throw new Error(`Upgrade cost must be between 1 and 4: ${node.id}`);
    ids.add(node.id);
  }
  for (const node of nodes) {
    for (const prerequisite of node.requires) {
      if (!ids.has(prerequisite)) throw new Error(`Missing prerequisite ${prerequisite} for upgrade ${node.id}`);
    }
  }
}

validateNodes(UPGRADE_NODES);

export function nodeById(id: UpgradeId): UpgradeNode | undefined {
  return UPGRADE_NODES.find(node => node.id === id);
}

export function deriveStats(
  purchased: ReadonlySet<UpgradeId>,
  temporary: readonly StatModifier[] = [],
): PlayerStats {
  const stats = defaultStats();
  for (const node of UPGRADE_NODES) {
    if (purchased.has(node.id)) node.apply(stats);
  }
  for (const modifier of temporary) modifier(stats);
  return stats;
}
