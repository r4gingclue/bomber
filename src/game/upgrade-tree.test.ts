import { expect, it } from 'vitest';
import { defaultStats, type PlayerStats } from './upgrades';
import { UPGRADE_NODES, deriveStats, nodeById, type UpgradeId } from './upgrade-tree';

const expectedNodes: readonly {
  id: UpgradeId;
  branch: 'weapons' | 'ordnance' | 'defense' | 'flight';
  cost: number;
  requires: readonly UpgradeId[];
  exclusionGroup?: string;
}[] = [
  { id: 'rapid-fire-1', branch: 'weapons', cost: 1, requires: [] },
  { id: 'cannon-damage-1', branch: 'weapons', cost: 1, requires: [] },
  { id: 'rapid-fire-2', branch: 'weapons', cost: 2, requires: ['rapid-fire-1'] },
  { id: 'heavy-rounds', branch: 'weapons', cost: 2, requires: ['cannon-damage-1'] },
  { id: 'piercing', branch: 'weapons', cost: 3, requires: ['rapid-fire-2', 'heavy-rounds'], exclusionGroup: 'cannon-specialist' },
  { id: 'multishot', branch: 'weapons', cost: 3, requires: ['rapid-fire-2', 'heavy-rounds'], exclusionGroup: 'cannon-specialist' },
  { id: 'missile-rack', branch: 'weapons', cost: 1, requires: [] },
  { id: 'faster-reload', branch: 'weapons', cost: 2, requires: ['missile-rack'] },
  { id: 'improved-tracking', branch: 'weapons', cost: 2, requires: ['missile-rack'] },
  { id: 'expanded-rack', branch: 'weapons', cost: 3, requires: ['faster-reload', 'improved-tracking'] },
  { id: 'lead-casing', branch: 'ordnance', cost: 1, requires: [] },
  { id: 'bigger-boom-1', branch: 'ordnance', cost: 1, requires: [] },
  { id: 'payload-damage', branch: 'ordnance', cost: 2, requires: ['lead-casing'] },
  { id: 'bigger-boom-2', branch: 'ordnance', cost: 2, requires: ['bigger-boom-1'] },
  { id: 'dual-drop', branch: 'ordnance', cost: 3, requires: ['payload-damage', 'bigger-boom-2'], exclusionGroup: 'ordnance-specialist' },
  { id: 'magnetic-charges', branch: 'ordnance', cost: 3, requires: ['payload-damage', 'bigger-boom-2'], exclusionGroup: 'ordnance-specialist' },
  { id: 'armor-1', branch: 'defense', cost: 1, requires: [] },
  { id: 'field-repair', branch: 'defense', cost: 2, requires: ['armor-1'] },
  { id: 'armor-2', branch: 'defense', cost: 2, requires: ['armor-1'] },
  { id: 'point-defense', branch: 'defense', cost: 3, requires: ['field-repair', 'armor-2'] },
  { id: 'reinforced-defense', branch: 'defense', cost: 4, requires: ['point-defense'] },
  { id: 'turbo-1', branch: 'flight', cost: 1, requires: [] },
  { id: 'airframe', branch: 'flight', cost: 1, requires: [] },
  { id: 'turbo-2', branch: 'flight', cost: 2, requires: ['turbo-1'] },
  { id: 'sonar', branch: 'flight', cost: 2, requires: ['airframe'] },
  { id: 'advanced-avionics', branch: 'flight', cost: 3, requires: ['turbo-2', 'sonar'] },
];

it('defines all four branches with valid prerequisites and exclusions', () => {
  expect(new Set(UPGRADE_NODES.map(node => node.branch))).toEqual(new Set(['weapons', 'ordnance', 'defense', 'flight']));
  expect(UPGRADE_NODES).toHaveLength(26);

  for (const expected of expectedNodes) {
    const node = nodeById(expected.id);
    expect(node).toMatchObject(expected);
    for (const prerequisite of expected.requires) expect(nodeById(prerequisite)).toBeDefined();
  }
});

it('applies every catalogue effect from a clean baseline', () => {
  const effectExpectations: readonly { id: UpgradeId; assert: (stats: PlayerStats) => void }[] = [
    { id: 'rapid-fire-1', assert: stats => expect(stats.cannonCooldown).toBeCloseTo(0.12 / 1.12) },
    { id: 'cannon-damage-1', assert: stats => expect(stats.cannonDamage).toBeCloseTo(9.2) },
    { id: 'rapid-fire-2', assert: stats => expect(stats.cannonCooldown).toBeCloseTo(0.12 / 1.15) },
    { id: 'heavy-rounds', assert: stats => expect(stats.cannonDamage).toBeCloseTo(10) },
    { id: 'piercing', assert: stats => expect(stats.cannonPierce).toBe(1) },
    { id: 'multishot', assert: stats => expect(stats.cannonShots).toBe(2) },
    { id: 'missile-rack', assert: stats => expect(stats.missileCap).toBe(2) },
    { id: 'faster-reload', assert: stats => expect(stats.missileRefill).toBe(2) },
    { id: 'improved-tracking', assert: stats => { expect(stats.missileSteering).toBeCloseTo(1.25); expect(stats.missileAcquireScale).toBeCloseTo(1.2); } },
    { id: 'expanded-rack', assert: stats => expect(stats.missileCap).toBe(6) },
    { id: 'lead-casing', assert: stats => expect(stats.sinkSpeed).toBeCloseTo(44.2) },
    { id: 'bigger-boom-1', assert: stats => expect(stats.blastRadius).toBeCloseTo(31.2) },
    { id: 'payload-damage', assert: stats => expect(stats.chargeDamage).toBe(30) },
    { id: 'bigger-boom-2', assert: stats => expect(stats.blastRadius).toBeCloseTo(32.5) },
    { id: 'dual-drop', assert: stats => expect(stats.dualDrop).toBe(true) },
    { id: 'magnetic-charges', assert: stats => expect(stats.magnetic).toBe(true) },
    { id: 'armor-1', assert: stats => expect(stats.maxHp).toBe(120) },
    { id: 'field-repair', assert: stats => expect(stats.fieldRepair).toBe(12) },
    { id: 'armor-2', assert: stats => expect(stats.maxHp).toBe(130) },
    { id: 'point-defense', assert: stats => expect(stats.pointDefense).toBe(true) },
    { id: 'reinforced-defense', assert: stats => expect(stats.pointDefenseCooldown).toBe(0.32) },
    { id: 'turbo-1', assert: stats => expect(stats.accel).toBeCloseTo(391) },
    { id: 'airframe', assert: stats => { expect(stats.speedScale).toBeCloseTo(1.12); expect(stats.handlingScale).toBeCloseTo(0.9); } },
    { id: 'turbo-2', assert: stats => expect(stats.accel).toBeCloseTo(408) },
    { id: 'sonar', assert: stats => expect(stats.sonar).toBe(true) },
    { id: 'advanced-avionics', assert: stats => { expect(stats.sonarInterval).toBe(6); expect(stats.missileAcquireScale).toBeCloseTo(1.2); } },
  ];

  for (const { id, assert } of effectExpectations) {
    const stats = defaultStats();
    nodeById(id)!.apply(stats);
    assert(stats);
  }
});

it('derives stats from defaults without multiplicative drift', () => {
  const stats = deriveStats(new Set(['rapid-fire-1', 'rapid-fire-2', 'point-defense', 'reinforced-defense']));
  expect(stats.cannonCooldown).toBeCloseTo(0.12 / 1.12 / 1.15);
  expect(stats.pointDefense).toBe(true);
  expect(stats.pointDefenseCooldown).toBe(0.32);
  expect(deriveStats(new Set())).toEqual(deriveStats(new Set()));
});

it('applies temporary modifiers after catalogue effects in array order', () => {
  const stats = deriveStats(new Set(['rapid-fire-1']), [
    value => { value.cannonCooldown *= 2; },
    value => { value.cannonCooldown += 0.01; },
  ]);

  expect(stats.cannonCooldown).toBeCloseTo((0.12 / 1.12) * 2 + 0.01);
});
