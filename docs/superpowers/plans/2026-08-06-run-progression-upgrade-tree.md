# Run Progression and Upgrade Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free random post-wave cards with earned perk points, transparent wave ratings, and a four-branch run-resetting upgrade tree.

**Architecture:** Pure `wave-rating`, `upgrade-tree`, and `run-progression` modules own calculation, declarative node data, and purchase transactions. `World` consumes fully derived `PlayerStats`; `main.ts` coordinates results/tree phases while renderer and input modules present semantic tree navigation without owning progression rules.

**Tech Stack:** TypeScript 5.6, Vitest 2.1, Vite 6, Canvas 2D, existing keyboard/touch/Gamepad APIs; no new runtime dependencies.

## Global Constraints

- A run starts with zero perk points and no upgrades; death/new run resets both.
- Every cleared wave awards 1 point; rating `>= 75` awards exactly 1 additional point.
- Rating weights are score efficiency 40, depth-charge accuracy 30, and damage avoided 30.
- Purchases are refundable only on the current upgrade screen and confirm on **Start Next Wave**.
- Piercing Rounds/Multishot and Dual Drop/Magnetic Charges are mutually exclusive pairs.
- Point Defense keeps a 36-pixel radius; Reinforced Defense changes cooldown from `0.4` to `0.32` seconds.
- Upgrade UI must support keyboard, touch, and gamepad in desktop, portrait, and landscape layouts.
- Temporary upgrade crates are not implemented; stats expose a temporary modifier layer for that follow-up.
- Use test-first development and commit after every task.

---

### Task 1: Wave Rating and Wave-Local Performance

**Files:**
- Create: `src/game/wave-rating.ts`
- Create: `src/game/wave-rating.test.ts`
- Modify: `src/game/waves.ts`
- Modify: `src/game/waves.test.ts`
- Modify: `src/game/world.ts`
- Test: `src/game/world.test.ts`

**Interfaces:**
- Produces: `WavePerformance`, `WaveRating`, and `rateWave(performance): WaveRating`.
- Produces: `scoreTargetForWave(wave: number, act: number): number` from wave configuration.
- Produces: `World.wavePerformance(): WavePerformance` and wave-start baselines.

- [ ] **Step 1: Write failing rating tests**

```ts
import { describe, expect, it } from 'vitest';
import { rateWave } from './wave-rating';

describe('rateWave', () => {
  it('weights score, accuracy, and damage avoided into 100 points', () => {
    expect(rateWave({ scoreEarned: 500, scoreTarget: 500, drops: 4, hitDrops: 3, hpStart: 100, hpEnd: 90, maxHpStart: 100 })).toEqual({
      score: 40, accuracy: 23, survival: 27, total: 90, bonusPoint: true,
    });
  });
  it('awards the bonus at 75 but not 74', () => {
    expect(rateWave({ scoreEarned: 300, scoreTarget: 400, drops: 2, hitDrops: 1, hpStart: 100, hpEnd: 97, maxHpStart: 100 }).total).toBe(74);
    expect(rateWave({ scoreEarned: 300, scoreTarget: 400, drops: 2, hitDrops: 1, hpStart: 100, hpEnd: 100, maxHpStart: 100 }).bonusPoint).toBe(true);
  });
  it('clamps malformed counters and gives zero accuracy when valid targets existed but no charge was dropped', () => {
    expect(rateWave({ scoreEarned: 999, scoreTarget: 100, drops: 0, hitDrops: 9, hpStart: 100, hpEnd: 120, maxHpStart: 100, hadChargeTargets: true })).toEqual({
      score: 40, accuracy: 0, survival: 30, total: 70, bonusPoint: false,
    });
  });
});
```

- [ ] **Step 2: Run the new test and verify the missing-module failure**

Run: `npx vitest run src/game/wave-rating.test.ts`

Expected: FAIL because `./wave-rating` does not exist.

- [ ] **Step 3: Implement the pure rating calculator**

```ts
export interface WavePerformance {
  scoreEarned: number;
  scoreTarget: number;
  drops: number;
  hitDrops: number;
  hpStart: number;
  hpEnd: number;
  maxHpStart: number;
  hadChargeTargets?: boolean;
}

export interface WaveRating {
  score: number;
  accuracy: number;
  survival: number;
  total: number;
  bonusPoint: boolean;
}

const ratio = (value: number, target: number) => target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;

export function rateWave(p: WavePerformance): WaveRating {
  const score = Math.round(40 * ratio(p.scoreEarned, p.scoreTarget));
  const accuracyRatio = p.drops > 0 ? ratio(Math.min(p.hitDrops, p.drops), p.drops) : (p.hadChargeTargets === false ? 1 : 0);
  const accuracy = Math.round(30 * accuracyRatio);
  const lost = Math.max(0, Math.min(p.maxHpStart, p.hpStart - p.hpEnd));
  const survival = Math.round(30 * (1 - ratio(lost, p.maxHpStart)));
  const total = Math.max(0, Math.min(100, score + accuracy + survival));
  return { score, accuracy, survival, total, bonusPoint: total >= 75 };
}
```

- [ ] **Step 4: Add deterministic wave targets and tests**

Add `scoreTargetForWave(wave, act)` to `waves.ts` using the composed wave's base-score budget plus a documented 15% attainable skill allowance. Test that targets are positive and nondecreasing within each act, and that finale slots exceed the preceding wave.

- [ ] **Step 5: Track wave-local baselines in `World`**

Add private `waveScoreStart`, `waveDropsStart`, `waveHitDropsStart`, `waveHpStart`, `waveMaxHpStart`, and `waveHadChargeTargets` fields. Set them after spawning in `startWave()`. Return deltas from:

```ts
wavePerformance(): WavePerformance {
  return {
    scoreEarned: this.score - this.waveScoreStart,
    scoreTarget: scoreTargetForWave(this.wave, this.act),
    drops: this.drops - this.waveDropsStart,
    hitDrops: this.hitDrops - this.waveHitDropsStart,
    hpStart: this.waveHpStart,
    hpEnd: this.player.hp,
    maxHpStart: this.waveMaxHpStart,
    hadChargeTargets: this.waveHadChargeTargets,
  };
}
```

Test that prior-wave score/drops do not leak and health loss is captured.

- [ ] **Step 6: Run focused tests, then commit**

Run: `npx vitest run src/game/wave-rating.test.ts src/game/waves.test.ts src/game/world.test.ts`

Expected: PASS.

```bash
git add src/game/wave-rating.ts src/game/wave-rating.test.ts src/game/waves.ts src/game/waves.test.ts src/game/world.ts src/game/world.test.ts
git commit -m "feat: calculate wave performance ratings"
```

### Task 2: Declarative Upgrade Tree and Derived Stats

**Files:**
- Replace: `src/game/upgrades.ts`
- Replace: `src/game/upgrades.test.ts`
- Create: `src/game/upgrade-tree.ts`
- Create: `src/game/upgrade-tree.test.ts`

**Interfaces:**
- Produces: `UpgradeId`, `UpgradeBranch`, `UpgradeNode`, `UPGRADE_NODES`, `nodeById(id)`.
- Produces: expanded `PlayerStats`, `defaultStats()`, `deriveStats(purchased, temporary?)`.
- Retains temporarily: `UpgradeCard`, `CARD_POOL`, and `drawCards` so each task
  remains buildable; Task 9 removes them when orchestration moves to the tree.

- [ ] **Step 1: Write failing tree-integrity and stat-derivation tests**

```ts
import { expect, it } from 'vitest';
import { UPGRADE_NODES, deriveStats, nodeById } from './upgrade-tree';

it('defines four branches with valid prerequisites and exclusions', () => {
  expect(new Set(UPGRADE_NODES.map(n => n.branch))).toEqual(new Set(['weapons', 'ordnance', 'defense', 'flight']));
  for (const node of UPGRADE_NODES) for (const prerequisite of node.requires) expect(nodeById(prerequisite)).toBeDefined();
  expect(nodeById('piercing')?.exclusionGroup).toBe('cannon-specialist');
  expect(nodeById('multishot')?.exclusionGroup).toBe('cannon-specialist');
});

it('derives stats from defaults without multiplicative drift', () => {
  const stats = deriveStats(new Set(['rapid-fire-1', 'rapid-fire-2', 'point-defense', 'reinforced-defense']));
  expect(stats.cannonCooldown).toBeCloseTo(0.12 / 1.12 / 1.15);
  expect(stats.pointDefense).toBe(true);
  expect(stats.pointDefenseCooldown).toBe(0.32);
  expect(deriveStats(new Set())).toEqual(deriveStats(new Set()));
});
```

- [ ] **Step 2: Run the test and verify missing exports**

Run: `npx vitest run src/game/upgrade-tree.test.ts`

Expected: FAIL because the module and exports do not exist.

- [ ] **Step 3: Expand `PlayerStats` defaults**

Define explicit defaults in `upgrades.ts`:

```ts
export interface PlayerStats {
  maxHp: number; accel: number; speedScale: number; handlingScale: number;
  blastRadius: number; chargeDamage: number; maxCharges: number; sinkSpeed: number;
  cannonCooldown: number; cannonDamage: number; cannonPierce: number; cannonShots: number;
  missileCap: number; missileRefill: number; missileSteering: number; missileAcquireScale: number;
  dualDrop: boolean; magnetic: boolean; sonar: boolean; sonarInterval: number;
  pointDefense: boolean; pointDefenseCooldown: number; fieldRepair: number;
}
```

Defaults preserve current behavior: cooldown `0.12`, cannon damage `8`, blast radius `26`, charge damage matching current blast damage, missile refill `1`, missile steering `1`, sonar interval `8`, and Point Defense cooldown `0.4`.

- [ ] **Step 4: Implement the complete node catalogue**

Use this shape and all costs/prerequisites/effects from the approved spec:

```ts
export type UpgradeBranch = 'weapons' | 'ordnance' | 'defense' | 'flight';
export type UpgradeId = 'rapid-fire-1' | 'cannon-damage-1' | 'rapid-fire-2' | 'heavy-rounds' | 'piercing' | 'multishot' | 'missile-rack' | 'faster-reload' | 'improved-tracking' | 'expanded-rack' | 'lead-casing' | 'bigger-boom-1' | 'payload-damage' | 'bigger-boom-2' | 'dual-drop' | 'magnetic-charges' | 'armor-1' | 'field-repair' | 'armor-2' | 'point-defense' | 'reinforced-defense' | 'turbo-1' | 'airframe' | 'turbo-2' | 'sonar' | 'advanced-avionics';
export interface UpgradeNode { id: UpgradeId; branch: UpgradeBranch; name: string; description: string; cost: number; requires: UpgradeId[]; exclusionGroup?: string; apply(stats: PlayerStats): void; }
```

`deriveStats` clones defaults, applies purchased nodes in catalogue order, then applies optional temporary modifiers. Throw during module initialization for duplicate IDs, missing prerequisites, or costs outside `1..4`.

- [ ] **Step 5: Preserve compatibility tests and verify all node effects**

Extend `upgrades.test.ts` with default-stat tests while retaining its legacy-card
checks until Task 9. Add table-driven assertions in `upgrade-tree.test.ts` for all
26 node IDs, the exact four branch sets, both exclusion groups, and every
prerequisite listed in the spec.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run src/game/upgrades.test.ts src/game/upgrade-tree.test.ts`

Expected: PASS.

```bash
git add src/game/upgrades.ts src/game/upgrades.test.ts src/game/upgrade-tree.ts src/game/upgrade-tree.test.ts
git commit -m "feat: define four-branch upgrade tree"
```

### Task 3: Run Progression Purchase Transactions

**Files:**
- Create: `src/game/run-progression.ts`
- Create: `src/game/run-progression.test.ts`

**Interfaces:**
- Consumes: `UpgradeId`, `nodeById`, and `deriveStats` from Task 2.
- Produces: `RunProgression` with `points`, `confirmed`, `pending`, `awardWave`, `canPurchase`, `purchase`, `canRefund`, `refund`, `confirm`, `reset`, and `stats`.

- [ ] **Step 1: Write failing transaction tests**

```ts
import { describe, expect, it } from 'vitest';
import { RunProgression } from './run-progression';

it('awards one clear point plus one rating bonus at 75', () => {
  const p = new RunProgression();
  expect(p.awardWave(74)).toEqual({ base: 1, bonus: 0, total: 1 });
  expect(p.awardWave(75)).toEqual({ base: 1, bonus: 1, total: 2 });
  expect(p.points).toBe(3);
});

it('enforces prerequisites, costs, exclusions, refunds, and confirmation', () => {
  const p = new RunProgression();
  p.awardPointsForTest(20);
  expect(p.purchase('rapid-fire-2')).toBe(false);
  expect(p.purchase('rapid-fire-1')).toBe(true);
  expect(p.purchase('rapid-fire-2')).toBe(true);
  expect(p.refund('rapid-fire-1')).toBe(false);
  expect(p.refund('rapid-fire-2')).toBe(true);
  expect(p.refund('rapid-fire-1')).toBe(true);
  p.confirm();
  expect(p.pending.size).toBe(0);
});
```

- [ ] **Step 2: Run and verify missing-module failure**

Run: `npx vitest run src/game/run-progression.test.ts`

Expected: FAIL because `RunProgression` does not exist.

- [ ] **Step 3: Implement progression state and validation**

```ts
export class RunProgression {
  points = 0;
  readonly confirmed = new Set<UpgradeId>();
  readonly pending = new Set<UpgradeId>();
  awardWave(rating: number): { base: 1; bonus: 0 | 1; total: 1 | 2 };
  canPurchase(id: UpgradeId): { ok: boolean; reason?: string };
  purchase(id: UpgradeId): boolean;
  canRefund(id: UpgradeId): { ok: boolean; reason?: string };
  refund(id: UpgradeId): boolean;
  confirm(): void;
  reset(): void;
  get stats(): PlayerStats;
}
```

Prerequisites may be confirmed or pending. Exclusion checks inspect both sets. Refund rejects confirmed nodes and pending nodes required by another pending node. Keep test-only point seeding in a constructor argument (`new RunProgression({ points: 20 })`), not a production test hook.

- [ ] **Step 4: Add complete edge-case tests**

Cover duplicate purchase, insufficient points, unknown IDs through a safe lookup, both specialist exclusions, reverse-order refund, exact point restoration, confirm, derived pending stats, and full reset.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run src/game/run-progression.test.ts src/game/upgrade-tree.test.ts`

Expected: PASS.

```bash
git add src/game/run-progression.ts src/game/run-progression.test.ts
git commit -m "feat: add run progression transactions"
```

### Task 4: Integrate Derived Stats into Combat

**Files:**
- Modify: `src/game/world.ts`
- Modify: `src/game/world.test.ts`
- Modify: `src/main.ts`
- Modify: `src/game/collision.ts`
- Modify: `src/game/collision.test.ts`
- Modify: `src/game/entities/physics.ts`
- Modify: `src/game/entities/physics.test.ts`
- Modify: `src/game/entities/types.ts`

**Interfaces:**
- Consumes: derived `PlayerStats` from Task 2.
- Produces: `World.setStats(stats: PlayerStats)` and combat behavior controlled only by stats.

- [ ] **Step 1: Write failing combat-effect tests**

Add focused tests proving: upgraded cooldown permits a second shot before `0.12s`; cannon damage is read from stats; multishot emits two projectiles; piercing survives one enemy collision; charge damage affects blast resolution; missile refill/steering/acquisition use stats; speed/handling change terminal movement; sonar uses `sonarInterval`; and Point Defense uses `pointDefenseCooldown` while keeping radius 36.

Representative assertion:

```ts
it('uses derived cannon cooldown and damage', () => {
  const w = new World(mulberry32(1));
  w.setStats({ ...defaultStats(), cannonCooldown: 0.06, cannonDamage: 12 });
  w.update(0.01, fireIntent);
  w.update(0.06, fireIntent);
  expect(w.shots.filter(s => s.ptype === 'bullet')).toHaveLength(2);
  expect(w.shots.find(s => s.ptype === 'bullet')?.damage).toBe(12);
});
```

- [ ] **Step 2: Run focused tests and confirm hard-coded-value failures**

Run: `npx vitest run src/game/world.test.ts src/game/collision.test.ts src/game/entities/physics.test.ts`

Expected: FAIL at the new assertions while current behavior remains hard coded.

- [ ] **Step 3: Replace hard-coded combat values with stats**

Use `stats.cannonCooldown`, `cannonDamage`, `cannonShots`, `cannonPierce`, `chargeDamage`, `missileRefill`, `missileSteering`, `missileAcquireScale`, `speedScale`, `handlingScale`, `sonarInterval`, and `pointDefenseCooldown`. Add `pierceRemaining` as an optional projectile field and decrement it in collision resolution before expiring the bullet.

- [ ] **Step 4: Apply wave-boundary health rules**

Remove the unconditional `+15` heal from `main.ts` in this task only after adding `World.applyWaveRecovery()`:

```ts
applyWaveRecovery(): void {
  this.player.hp = Math.min(this.stats.maxHp, this.player.hp + this.stats.fieldRepair);
}
```

When `setStats` changes max health, preserve `oldHp / oldMaxHp` and clamp to the new maximum.

- [ ] **Step 5: Run combat tests and commit**

Run: `npx vitest run src/game/world.test.ts src/game/collision.test.ts src/game/entities/physics.test.ts`

Expected: PASS.

```bash
git add src/game/world.ts src/game/world.test.ts src/game/collision.ts src/game/collision.test.ts src/game/entities/physics.ts src/game/entities/physics.test.ts src/game/entities/types.ts src/main.ts
git commit -m "feat: apply upgrade stats to combat"
```

### Task 5: Results and Upgrade State Flow

**Files:**
- Modify: `src/game/state.ts`
- Modify: `src/game/state.test.ts`
- Create: `src/game/post-wave.ts`
- Create: `src/game/post-wave.test.ts`

**Interfaces:**
- Consumes: `WaveRating` and `RunProgression` awards.
- Produces: phases `results` and `upgrade`, plus `PostWaveView`.

- [ ] **Step 1: Write failing state-flow tests**

```ts
it('follows playing → results → upgrade → playing', () => {
  const state = new StateMachine();
  state.start();
  state.waveCleared();
  expect(state.phase).toBe('results');
  state.resultsAccepted();
  expect(state.phase).toBe('upgrade');
  state.upgradesConfirmed(false);
  expect(state.phase).toBe('playing');
});
```

Retain a second test for `upgrade → actIntro → playing`.

- [ ] **Step 2: Run and verify the transition failure**

Run: `npx vitest run src/game/state.test.ts src/game/post-wave.test.ts`

Expected: FAIL because `results` and new methods are absent.

- [ ] **Step 3: Implement state transitions and view model**

Change `Phase` to `'menu' | 'playing' | 'results' | 'upgrade' | 'actIntro' | 'gameover'`. Add `resultsAccepted()` and `upgradesConfirmed(actComplete: boolean)`. `PostWaveView` contains rating components, `{base, bonus, total}`, and resulting balance so rendering does not calculate rewards.

- [ ] **Step 4: Test invalid transitions and commit**

Run: `npx vitest run src/game/state.test.ts src/game/post-wave.test.ts`

Expected: PASS.

```bash
git add src/game/state.ts src/game/state.test.ts src/game/post-wave.ts src/game/post-wave.test.ts
git commit -m "feat: add post-wave results flow"
```

### Task 6: Responsive Results and Tree Layout

**Files:**
- Modify: `src/render/ui-layout.ts`
- Modify: `src/render/ui-layout.test.ts`
- Create: `src/render/upgrade-layout.ts`
- Create: `src/render/upgrade-layout.test.ts`

**Interfaces:**
- Produces: `UpgradeLayout` containing `panel`, four `tabs`, visible `nodes`, `continueButton`, and `resultsContinueButton`.
- Produces: `upgradeLayout(width, height, insets, branch, nodes): UpgradeLayout`.

- [ ] **Step 1: Write failing safe-area layout tests**

```ts
it.each([
  [1920, 1080, { top: 0, right: 0, bottom: 0, left: 0 }],
  [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }],
  [844, 390, { top: 0, right: 47, bottom: 21, left: 47 }],
])('keeps tree controls within the safe area', (w, h, insets) => {
  const layout = upgradeLayout(w, h, insets, 'weapons', weaponNodes);
  for (const rect of [...layout.tabs, ...layout.nodes.map(n => n.rect), layout.continueButton]) expect(rectWithinInsets(rect, w, h, insets)).toBe(true);
});
```

- [ ] **Step 2: Run and verify missing-layout failure**

Run: `npx vitest run src/render/upgrade-layout.test.ts`

Expected: FAIL because `upgrade-layout.ts` is absent.

- [ ] **Step 3: Implement branch-tab and node layout**

Desktop uses a centered panel with horizontal tabs and a two-column node path. Portrait uses horizontal tabs and one scroll-free vertical path sized to fit the selected branch; landscape uses compact two-column nodes. Return rectangles in CSS pixels for shared rendering and hit testing. Retain `cards` in `UiLayout` until Task 9 removes the last legacy callers.

- [ ] **Step 4: Verify all layouts and commit**

Run: `npx vitest run src/render/upgrade-layout.test.ts src/render/ui-layout.test.ts`

Expected: PASS.

```bash
git add src/render/upgrade-layout.ts src/render/upgrade-layout.test.ts src/render/ui-layout.ts src/render/ui-layout.test.ts
git commit -m "feat: lay out responsive upgrade tree"
```

### Task 7: Semantic Upgrade Input Navigation

**Files:**
- Create: `src/core/upgrade-navigation.ts`
- Create: `src/core/upgrade-navigation.test.ts`
- Modify: `src/core/input.ts`
- Modify: `src/core/input.test.ts`
- Modify: `src/core/gamepad.ts`
- Modify: `src/core/gamepad.test.ts`

**Interfaces:**
- Produces: `UpgradeAction = 'left' | 'right' | 'up' | 'down' | 'select' | 'refund' | 'continue'`.
- Produces: `Input.consumeUpgradeAction(): UpgradeAction | null`.
- Produces: pure `moveUpgradeFocus(model, action): UpgradeFocus`.

- [ ] **Step 1: Write failing keyboard/gamepad/navigation tests**

Test arrow/D-pad focus movement, shoulder-button branch switching, Enter/A purchase, Backspace/B refund, and Space/Start continue. Ensure edge-triggering prevents held buttons from buying twice.

```ts
expect(moveUpgradeFocus({ branch: 0, node: 0, nodeCounts: [6, 6, 5, 5] }, 'right')).toEqual({ branch: 1, node: 0 });
```

- [ ] **Step 2: Run and verify missing semantic action failures**

Run: `npx vitest run src/core/upgrade-navigation.test.ts src/core/input.test.ts src/core/gamepad.test.ts`

Expected: FAIL because upgrade actions are not exposed.

- [ ] **Step 3: Implement queued semantic actions**

Add one queued `UpgradeAction` while temporarily retaining
`cardKeyQueued`/`consumeCardKey()` for the legacy screen. Keep gameplay intent
unchanged. Map keyboard and gamepad only on press edges; touch continues through
renderer-owned hit rectangles in `main.ts`. Task 9 deletes the card queue after
the new screen is wired.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run src/core/upgrade-navigation.test.ts src/core/input.test.ts src/core/gamepad.test.ts`

Expected: PASS.

```bash
git add src/core/upgrade-navigation.ts src/core/upgrade-navigation.test.ts src/core/input.ts src/core/input.test.ts src/core/gamepad.ts src/core/gamepad.test.ts
git commit -m "feat: navigate upgrades across input methods"
```

### Task 8: Render Results, Tree, and Point HUD

**Files:**
- Modify: `src/render/renderer.ts`
- Create: `src/render/upgrade-view.ts`
- Create: `src/render/upgrade-view.test.ts`
- Modify: `src/render/ui-layout.test.ts`

**Interfaces:**
- Consumes: `PostWaveView`, `RunProgression`, `UpgradeLayout`, selected branch, and focused node.
- Produces: `UpgradeTreeView` with display-ready node state and lock reason.

- [ ] **Step 1: Write failing view-model tests**

```ts
it('marks nodes as purchased, pending, affordable, or locked with a reason', () => {
  const view = buildUpgradeTreeView(progression, 'defense');
  expect(view.nodes.find(n => n.id === 'armor-1')?.state).toBe('affordable');
  expect(view.nodes.find(n => n.id === 'point-defense')?.reason).toContain('Requires');
});
```

- [ ] **Step 2: Run and verify missing-view failure**

Run: `npx vitest run src/render/upgrade-view.test.ts`

Expected: FAIL because the view model is absent.

- [ ] **Step 3: Implement rendering without progression logic**

Add `results()` and `upgradeTree()` renderer methods. Results display the three `x/40`, `x/30`, `x/30` contributions, total, base/bonus points, and balance. Tree rendering displays four tabs, connecting lines, costs, exact descriptions, states, lock reasons, refund hint, balance, and **Start Next Wave**. Add `perk pts N` to the in-game HUD.

- [ ] **Step 4: Add responsive rendering assertions and commit**

Test that all node labels have a computed wrapping width, focused/pending states are distinguishable in the view model, and no old “choose an upgrade” card copy remains.

Run: `npx vitest run src/render/upgrade-view.test.ts src/render/ui-layout.test.ts`

Expected: PASS.

```bash
git add src/render/renderer.ts src/render/upgrade-view.ts src/render/upgrade-view.test.ts src/render/ui-layout.test.ts
git commit -m "feat: render wave results and upgrade tree"
```

### Task 9: Coordinate Progression in the Game Loop

**Files:**
- Modify: `src/main.ts`
- Modify: `src/game/world.ts`
- Modify: `src/game/world.test.ts`
- Modify: `src/testing/graphics-harness.ts`
- Modify: `src/testing/graphics-harness.test.ts`

**Interfaces:**
- Consumes all earlier tasks.
- Produces complete `playing → results → upgrade → actIntro|playing` behavior and reset-on-new-run.

- [ ] **Step 1: Add failing integration tests around a coordinator helper**

Extract pure orchestration into functions testable without DOM:

```ts
export function completeWave(world: World, progression: RunProgression): PostWaveView;
export function confirmUpgrades(world: World, progression: RunProgression): void;
```

Test that completing a 75+ wave awards two points once, repeated calls cannot double-award, pending stats apply immediately for preview, confirmation calls recovery once, and a new run creates a fresh progression object.

- [ ] **Step 2: Run and verify integration failures**

Run: `npx vitest run src/game/post-wave.test.ts src/game/world.test.ts`

Expected: FAIL because coordinator behavior is not connected.

- [ ] **Step 3: Replace card orchestration in `main.ts`**

Remove `cards`, `drawCards`, and `pickCard`. Maintain `progression`, `postWaveView`, selected branch, and focused node. On clear: rate once, award once, enter results. On results confirm: enter tree. On purchase/refund: mutate pending state and call `world.setStats(progression.stats)`. On **Start Next Wave**: confirm, apply recovery, then use existing act-intro/start-wave logic.

Also delete `UpgradeCard`, `CARD_POOL`, `drawCards`, `cardKeyQueued`,
`consumeCardKey()`, and `UiLayout.cards`, then update their tests so the full
build contains no compatibility layer.

Touch hit testing uses `UpgradeLayout` rectangles for results continue, tabs, nodes, refund, and start-wave actions. Renderer receives state only; it never purchases nodes.

- [ ] **Step 4: Reset progression on death/new run and update harness**

`startRun()` creates both a new `World` and `RunProgression`. Extend the graphics harness with deterministic results and upgrade-tree scenes so responsive screens can be staged without playing a wave.

- [ ] **Step 5: Run integration tests and commit**

Run: `npx vitest run src/game/post-wave.test.ts src/game/world.test.ts src/testing/graphics-harness.test.ts src/core/input.test.ts`

Expected: PASS.

```bash
git add src/main.ts src/game/world.ts src/game/world.test.ts src/game/post-wave.ts src/game/post-wave.test.ts src/testing/graphics-harness.ts src/testing/graphics-harness.test.ts
git commit -m "feat: integrate earned run progression"
```

### Task 10: Full Regression and Playtest Documentation

**Files:**
- Create: `docs/testing/run-progression-playtest.md`
- Modify: `README.md` if it describes random upgrade cards or old controls.

**Interfaces:**
- Consumes the complete feature.
- Produces reproducible manual acceptance steps and final verification evidence.

- [ ] **Step 1: Remove obsolete random-card references**

Run: `rg -n "drawCards|UpgradeCard|CARD_POOL|choose an upgrade|cardKey|cards" src README.md`

Expected: no obsolete runtime or user-facing references; layout terms unrelated to perks may remain only when justified.

- [ ] **Step 2: Run every automated gate**

Run:

```bash
npx vitest run --exclude '.worktrees/**'
npm run typecheck
npm run build
npm run audio:validate
```

Expected: all tests pass, TypeScript emits no errors, Vite builds successfully, and audio provenance remains valid.

- [ ] **Step 3: Write the manual playtest checklist**

Document desktop keyboard/mouse, touch portrait/landscape, and gamepad runs. Include exact checks for 74/75 rating behavior, saving points, each prerequisite/exclusion, pending refunds, every combat modifier, death reset, act transition, responsive bounds, and temporary crates being absent.

- [ ] **Step 4: Run a browser playtest**

Start `npm run dev -- --host 127.0.0.1`, complete or harness-stage results/tree screens at desktop, portrait, and landscape sizes, and verify keyboard, touch, and gamepad navigation. Record findings in the playtest document; fix any acceptance failure with a failing regression test before changing production code.

- [ ] **Step 5: Commit final verification**

```bash
git add docs/testing/run-progression-playtest.md README.md
git commit -m "docs: verify run progression upgrade tree"
```
