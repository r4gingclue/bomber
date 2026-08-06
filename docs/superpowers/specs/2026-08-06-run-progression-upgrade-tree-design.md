# Run Progression and Upgrade Tree Design

## Goal

Replace the free random perk offered after every wave with a run-based progression
system. Players earn perk points through wave clears and strong performance, then
deliberately invest those points in an upgrade tree. Powerful perks require several
waves of investment and all progression resets when the helicopter is destroyed.

The system should add the build variety and escalating power associated with
Vampire Survivors-style runs while preserving Sea Bomber's wave-based pacing.

## Scope

This change covers wave ratings, perk-point awards, an upgrade tree, temporary
purchase/refund behavior between waves, new combat stat modifiers, responsive
tree controls, run reset behavior, and regression testing.

Optional upgrade crates are a documented follow-up. The progression model must
leave room for crates that grant temporary, wave-only effects, but crate spawning,
collection, and effects are not part of this implementation.

## Run progression

Every run begins with zero perk points and no purchased upgrades. Clearing a wave
always awards one perk point. A wave rating of 75 or higher awards one additional
point, for a maximum of two points from an ordinary wave.

Points are awarded before the upgrade tree opens. Unspent points carry between
waves within the current run. Purchased upgrades remain active until death. On
death, available points, pending purchases, purchased nodes, and all derived stat
bonuses reset. No metagame currency or permanent power is introduced.

The upgrade tree appears only after a cleared wave. Players may buy multiple
nodes, switch branches, or save all their points before starting the next wave.

## Wave rating

`WaveRating` calculates a transparent score from 0 to 100:

- Combat score efficiency: up to 40 points, measured against a target configured
  for the current wave.
- Depth-charge accuracy: up to 30 points.
- Damage avoided: up to 30 points, based on health lost during the wave relative
  to maximum health at wave start.

Each component is clamped to its allotted range. The total is rounded to a whole
number and clamped to `[0, 100]`. Waves with no depth-charge drops receive the
accuracy component only if the wave contains no valid depth-charge targets;
otherwise their accuracy contribution is zero. Score targets live with wave
configuration so they can be balanced independently per wave and act.

The wave-results panel shows all three contributions, the total rating, the base
point, any performance bonus, and the player's new point balance. Poor performance
never removes points or prevents the guaranteed clear reward.

## Upgrade model

`UpgradeTree` is declarative data. Each node defines:

- Stable identifier, branch, name, and description.
- Point cost.
- Prerequisite node identifiers.
- Optional mutually exclusive group.
- A stat effect that can be applied from a clean baseline.

`RunProgression` owns the available point balance, confirmed purchases, and
pending purchases. It validates affordability, prerequisites, and exclusions.
Purchases made on the current upgrade screen may be refunded at full cost until
the player starts the next wave. Earlier confirmed purchases cannot be refunded.

Player stats are derived from defaults plus confirmed and pending nodes rather
than incrementally mutated. Recalculation makes refunds reliable and prevents
compound-stat drift.

## Upgrade tree

### Weapons

The branch begins with two paths so cannon and missile builds are both explicit.

#### Cannon path

1. **Rapid Fire I** — 1 point, no prerequisite: 12% faster cannon fire rate.
2. **Cannon Damage I** — 1 point, no prerequisite: 15% more cannon damage.
3. **Rapid Fire II** — 2 points, requires Rapid Fire I: a further 15%
   fire-rate increase.
4. **Heavy Rounds** — 2 points, requires Cannon Damage I: a further 25%
   cannon-damage increase.
5. **Piercing Rounds** — 3 points, requires Rapid Fire II and Heavy Rounds:
   cannon rounds continue through one enemy.
6. **Multishot** — 3 points, requires Rapid Fire II and Heavy Rounds: fire two
   rounds in a six-degree spread for each trigger pull.

Piercing Rounds and Multishot are mutually exclusive. Piercing allows cannon
rounds to continue through one target. Multishot fires a restrained spread while
preserving the existing aim direction.

#### Missile path

1. **Missile Rack** — 1 point, no prerequisite: unlock two air-to-air missiles.
2. **Faster Reload** — 2 points, requires Missile Rack: replenish two spent
   missiles at each wave start instead of one.
3. **Improved Tracking** — 2 points, requires Missile Rack: increase missile
   steering by 25% and acquisition range by 20%.
4. **Expanded Rack** — 3 points, requires Faster Reload and Improved Tracking:
   increase maximum missile capacity from two to six.

### Ordnance

1. **Lead Casing** — 1 point, no prerequisite: increase depth-charge sink speed
   by 30%.
2. **Bigger Boom I** — 1 point, no prerequisite: increase blast radius by 20%.
3. **Payload Damage** — 2 points, requires Lead Casing: increase depth-charge
   explosion damage by 25%.
4. **Bigger Boom II** — 2 points, requires Bigger Boom I: increase blast radius
   by another 25%.
5. **Dual Drop** — 3 points, requires Payload Damage and Bigger Boom II: release
   two charges per drop.
6. **Magnetic Charges** — 3 points, requires Payload Damage and Bigger Boom II:
   curve submerged charges toward nearby targets.

Dual Drop and Magnetic Charges are mutually exclusive. Their existing gameplay
identities are retained.

### Defense

1. **Armor Plating I** — 1 point, no prerequisite: increase maximum health by 20.
2. **Field Repair** — 2 points, requires Armor Plating I: restore 12 health after
   each cleared wave.
3. **Armor Plating II** — 2 points, requires Armor Plating I: increase maximum
   health by another 30.
4. **Point Defense** — 3 points, requires Field Repair and Armor Plating II:
   unlock close-range projectile interception.
5. **Reinforced Defense** — 4 points, requires Point Defense: reduce the Point
   Defense cooldown from 0.4 seconds to 0.32 seconds.

Point Defense retains its reduced 36-pixel interception radius. The final node
improves frequency, not range, so the defense still activates only at immediate
threat distance.

### Flight Systems

1. **Turbo Engine I** — 1 point, no prerequisite: improve acceleration by 15%.
2. **Airframe** — 1 point, no prerequisite: improve effective top speed by 12%
   and reduce directional drift by 10%.
3. **Turbo Engine II** — 2 points, requires Turbo Engine I: improve acceleration
   by another 20%.
4. **Sonar** — 2 points, requires Airframe: outline submarines for three seconds
   every eight seconds.
5. **Advanced Avionics** — 3 points, requires Turbo Engine II and Sonar: reduce
   the sonar cycle to six seconds and improve missile acquisition speed by 20%.

All percentages and timing values are named balance constants rather than embedded
UI logic so playtesting can tune them without restructuring the tree.

## Player stats and combat integration

`PlayerStats` gains explicit values for cannon cooldown, cannon damage,
depth-charge damage, top speed/handling, missile replenishment, missile steering,
sonar interval, and Point Defense cooldown. Existing hard-coded combat values move
to defaults or named constants used by the corresponding stat.

Combat systems consume the derived stats without knowing which upgrade produced
them. Specialist behavior is represented explicitly so firing, collision, and
ordnance code do not inspect upgrade identifiers.

Wave-start health handling changes from the current unconditional heal to the
Field Repair effect. Maximum-health purchases preserve the player's current health
percentage unless the node explicitly grants healing.

## User flow and controls

Wave completion has two stages:

1. A results panel presents the rating breakdown and point award.
2. Continue opens the upgrade tree.

The tree uses four branch tabs to remain readable across desktop, landscape and
portrait touch layouts. A branch view shows connected nodes, costs, prerequisites,
purchased state, pending state, and exact stat changes. Affordable nodes are
visually emphasized. Locked nodes state the missing prerequisite or point cost.

Players can navigate all controls using keyboard, touch, or gamepad. Navigation
supports branch switching, node selection, purchase/refund, and starting the next
wave. The existing numbered random-card shortcuts are replaced with semantic tree
navigation. The HUD displays the available point balance during play, but cannot
open the tree mid-wave.

Selecting **Start Next Wave** confirms pending purchases and advances through the
existing act-intro flow when required. Saving points is always valid; the player
does not need to buy an upgrade to continue.

## Temporary upgrade crates

A future difficult-wave feature may spawn optional crates for pilots performing
well enough to qualify. Collected crates will grant temporary effects that expire
at wave end and will not modify perk points or the permanent-within-run tree.

To support that extension, derived player stats should accept a separate temporary
modifier layer. No crate UI, qualification rule, spawning behavior, or temporary
effect catalogue is included in the current scope.

## Failure and edge-case handling

- Rating inputs are clamped so invalid counters cannot award more than two points.
- A duplicate node purchase, unaffordable purchase, unmet prerequisite, or
  excluded specialist choice is rejected without changing state.
- Refunds restore the exact pending cost and recalculate dependent affordability.
- A pending prerequisite cannot be refunded while a pending dependent remains;
  the UI explains why.
- Starting a wave with no purchases confirms an empty transaction normally.
- Death clears progression before a new run can start.
- Missing optional presentation data falls back to node names and costs; it never
  blocks progression.

## Testing

Automated tests cover:

- Rating component calculation, clamping, rounding, the 75-point threshold, and
  zero-drop accuracy behavior.
- One guaranteed point, one possible bonus point, point carryover, and no point
  loss from a poor wave.
- Node affordability, prerequisites, mutual exclusions, duplicate prevention,
  pending purchases, refund ordering, and confirmation.
- Complete progression reset on death/new run.
- Derived stat effects for every node and clean recalculation after refunds.
- Cannon fire rate and damage, charge damage, missile capacity/replenishment and
  tracking, flight handling, sonar interval, and Point Defense cooldown behavior.
- Results-to-tree-to-next-wave state transitions, including act intros and saving
  all points.
- Keyboard, touch, and gamepad navigation for every upgrade-screen action.
- Responsive layout bounds for desktop, portrait, and landscape safe areas.

Manual playtesting verifies that ordinary players can purchase early nodes, strong
players reach specialist nodes sooner without snowballing immediately, expensive
defensive automation remains earned, every branch supports a viable build, and
the results breakdown is understandable without documentation.

## Acceptance criteria

The feature is complete when:

1. Free random cards are fully replaced by the four-branch upgrade tree.
2. Every wave awards one point and ratings of 75 or higher award exactly one bonus.
3. Points, purchases, and derived effects persist only for the current run and
   reset on death.
4. All listed nodes enforce costs, prerequisites, and specialist exclusions.
5. Fire rate, damage, air-to-air missiles, ordnance, defense, and flight upgrades
   produce their documented gameplay effects.
6. Purchases can be reviewed and refunded before starting the next wave.
7. Results and tree screens are fully usable by keyboard, touch, and gamepad at
   supported viewport sizes.
8. Automated checks pass and a complete run demonstrates a meaningful choice
   between early breadth and saving for stronger perks.
