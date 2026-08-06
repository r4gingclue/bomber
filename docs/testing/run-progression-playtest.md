# Run progression and upgrade tree playtest

This document is the release checklist for earned perk points, wave results, and
the four-branch upgrade tree. It distinguishes automated evidence from the
controller's in-app browser observations; no manual browser result is implied
until its row is completed with a device/browser and outcome.

## Automated regression gate

Last automated run: 2026-08-06 (Task 10 pre-browser verification).

Required commands:

```bash
npx vitest run --exclude '.worktrees/**'
npm run typecheck
npm run build
npm run audio:validate
```

Results: Vitest passed 44 files / 355 tests; TypeScript typecheck passed; Vite
production build passed; audio validation passed with 35 audio files totaling
15,549,423 bytes. The source-level audit below intentionally permits unrelated
presentation uses of `cards` in upgrade-layout tests; it must contain no
legacy random-card runtime or player-facing flow.

## Controller browser setup

Start the development server from the repository root:

```bash
npm run dev -- --host 127.0.0.1
```

Use the URL Vite prints (normally `http://127.0.0.1:5173/`). The deterministic
development-only scenes to test are:

| Purpose | URL suffix |
| --- | --- |
| Results screen, 87 rating / two-point award / five-point balance | `?harness=1&scene=results&freeze` |
| Upgrade tree, Defense branch, Armor I confirmed and Field Repair pending | `?harness=1&scene=upgrade-tree&freeze` |
| Touch controls and results screen | `?harness=1&scene=results&freeze&touch-ui&dpr=3` |
| Touch controls and upgrade tree | `?harness=1&scene=upgrade-tree&freeze&touch-ui&dpr=3` |

Exercise each results/tree scene at all three viewports. Use browser device
emulation only for layout/touch checks; use a connected standard-mapping
controller for the gamepad row.

| Class | CSS viewport | Suggested DPR | Expected layout |
| --- | ---: | ---: | --- |
| Desktop | 1440 × 900 | 1 | Centered panel; two-column nodes; full node descriptions |
| Portrait touch | 390 × 844 | 3 | One column; focused-node detail above footer; no scrolling required |
| Landscape touch | 844 × 390 | 3 | Compact two columns plus focused-node detail region; footer and start control remain visible |

## Manual acceptance checklist

Record every result as Pass, Fail, or Not run. For a failure, record the exact
URL, viewport, input device, selected branch/node, and a screenshot or concise
reproduction. A confirmed defect must first receive a failing regression test
before production code changes.

### Rating, results, and point balance

- [ ] Complete or stage a 74-rating scenario: it awards exactly the guaranteed
  one perk point and no performance bonus.
- [ ] Complete or stage a 75-rating scenario: it awards exactly two total points
  (one clear point plus one bonus), never more.
- [ ] On the results scene, verify the score-efficiency (0–40), depth-charge
  accuracy (0–30), damage-avoided (0–30), total, base award, bonus, and new
  balance are all visible and understandable.
- [ ] Continue from results via keyboard/mouse, touch, and gamepad. It opens the
  tree once and does not carry a held confirm/action into a purchase.
- [ ] Save every available point, select Start Next Wave, and verify the next
  wave begins normally with the saved balance retained.

### Purchases, prerequisites, exclusions, and refunds

- [ ] Buy an affordable root node. Its cost is deducted, it becomes Pending, and
  its stat effect previews before the next wave.
- [ ] Attempt each prerequisite chain out of order; the locked node names the
  missing prerequisite or insufficient point cost and does not change balance.
- [ ] Verify all chains: Rapid Fire I → Rapid Fire II; Cannon Damage I → Heavy
  Rounds; both into Piercing Rounds/Multishot; Missile Rack → Faster Reload and
  Improved Tracking → Expanded Rack; Lead Casing → Payload Damage; Bigger Boom
  I → Bigger Boom II; both into Dual Drop/Magnetic Charges; Armor I → Field
  Repair and Armor II → Point Defense → Reinforced Defense; Turbo I → Turbo II;
  Airframe → Sonar; and Turbo II plus Sonar → Advanced Avionics.
- [ ] Purchase Piercing Rounds, then verify Multishot is unavailable; repeat in
  the other order. Purchase Dual Drop, then verify Magnetic Charges is
  unavailable; repeat in the other order.
- [ ] Refund a pending leaf: the exact cost returns, the node becomes available,
  and previewed stats revert.
- [ ] Attempt to refund a pending prerequisite while a pending dependent remains:
  it is refused without changing points or tree state. Refund dependents first,
  then the prerequisite.
- [ ] Start Next Wave to confirm pending nodes. On the following tree screen,
  confirmed nodes remain active and cannot be refunded.

### Combat, persistence, and transitions

- [ ] Verify each combat modifier in play: Rapid Fire I/II cooldown, Cannon
  Damage I/Heavy Rounds damage, one-target piercing, Multishot spread, missile
  capacity/refill/tracking/acquisition, sink speed, blast radius, charge damage,
  Dual Drop, magnetic charges, max health, Field Repair, Point Defense,
  Reinforced Defense's 0.32-second cooldown at the unchanged 36-pixel radius,
  acceleration, speed/handling, and sonar/Advanced Avionics timing.
- [ ] Verify upgrades and unspent points persist across ordinary wave starts and
  that Field Repair, not an unconditional heal, controls cleared-wave healing.
- [ ] Clear the final wave of an act with pending purchases, choose Start Next
  Wave, and verify they are confirmed before the act intro; the following act
  starts normally.
- [ ] Die after earning points and/or buying upgrades, return to a new run, and
  verify points, confirmed/pending nodes, and every derived stat reset to the
  default baseline.
- [ ] Verify no temporary upgrade crates spawn, render, grant an effect, or alter
  the point balance in ordinary play or the harness scenes.

### Responsive input and bounds

- [ ] Desktop keyboard/mouse: Arrow keys move focus, Enter purchases, Backspace
  refunds a pending node, Space starts the next wave, and clicking tabs/nodes/
  controls performs the matching action without firing gameplay weapons.
- [ ] Portrait touch: tap results continue, all four tabs, a node to purchase and
  refund it, and Start Next Wave. Verify no control is clipped, overlapped,
  unreachable, or outside safe-area bounds.
- [ ] Landscape touch: repeat the portrait actions and verify focused details,
  footer text, node labels, and Start Next Wave stay readable and non-overlapping.
- [ ] Standard gamepad: D-pad or left stick changes focus; LB/RB changes branch;
  A purchases; B refunds a pending node; Start continues. Verify the phase
  transition latches held gameplay buttons so a single press cannot immediately
  buy/refund or start another action.
- [ ] At every viewport, confirm all four branches are reachable, focus is
  visible, locked/available/pending/purchased states are distinguishable, and
  node/tab/button hit targets correspond to their visible bounds.

## Browser evidence

The following observations were supplied by the controller on 2026-08-06. The
two initial failures were fixed by the screen-canvas transform regression tests
in `src/render/upgrade-view.test.ts` and manually rechecked afterward. Physical
gamepad and full ordinary-run coverage remain unexecuted.

| Run | URL / viewport / input | Result | Observations or evidence |
| --- | --- | --- | --- |
| Desktop results + tree | 1440 × 900 / keyboard-mouse | Pass | Both overlays filled the expected centered panel; values, tabs, nodes, and continuation controls were visible without overlap. |
| Portrait results + tree, forced DPR | `?harness=1&scene=results|upgrade-tree&freeze&touch-ui&dpr=3` at 390 × 844 | Pass after fix | Both overlays now fill the portrait viewport at readable scale; the tree detail region, footer, and Start Next Wave button remain visible. |
| Landscape results | `?harness=1&scene=results&freeze&touch-ui` at 844 × 390 | Pass (pre-fix) | Results scene filled the viewport width. |
| Landscape upgrade tree | `?harness=1&scene=upgrade-tree&freeze&touch-ui` at 844 × 390 | Pass after fix | The panel fills the usable width; all tabs, nodes, focused detail, footer, and Start Next Wave button are visible without clipping. |
| Standard gamepad results + tree | Physical standard-mapping controller | Not run | No physical-controller evidence returned |
| Ordinary run: rating, purchases, combat, reset, transition | Ordinary gameplay | Not run | No full-run evidence returned |

## Sign-off

Automated regression is signed off separately. Manual sign-off is incomplete:
the two responsive failures are regression-tested fixes awaiting browser
recheck, and physical-gamepad/full-run coverage remains outstanding. Any future
acceptance failure must be fixed test-first, retested, and documented here.
