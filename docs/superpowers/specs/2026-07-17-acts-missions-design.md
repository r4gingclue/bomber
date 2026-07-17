# Sea Bomber — Biome Acts, Enemy Choppers & Rescue Missions: Design Spec

**Date:** 2026-07-17
**Baseline:** main @ bd5d2a8 (v1 + aiming/graphics upgrade, 54 tests green).

## Vision

The endless wave run becomes an endless **act** run across three biomes — open sea, coastline, inland — each act ending in a biome-specific finale: escort a convoy, winch survivors off rafts and rooftops, or flatten an enemy base and extract a downed pilot. Enemy helicopters contest the air from the coast onward; the player gains homing missiles to answer them.

## Decisions (locked)

| Axis | Choice |
|---|---|
| Structure | Biome progression: acts cycle sea → coast → inland, endless with scaling |
| Act shape | 3 combat waves → upgrade → finale objective → upgrade → next act |
| Enemy choppers | All three: kamikaze scout, hover-strafe gunship, missile chopper |
| Player counter | Homing AA missiles via new repeatable upgrade card (Act 2+) |
| Rescue mechanics | All three, mapped by terrain: sea = escort convoy, coast = hover-winch, inland = touch-and-go LZ |
| Terrain | Solid silhouette heightfield; collision = damage + bounce; ground enemies stand on it |
| Architecture | Biome data + objective modules (approach A) |
| Out of scope | Destructible terrain, persistent campaign, new music, mission-select menu |

## Run structure

- Run = endless acts: Act 1 sea → Act 2 coast → Act 3 inland → Act 4 sea (scaled up) → …
- Each act: 3 combat waves (existing budget system; budget scales with global wave index and act number) → upgrade pick → finale objective → upgrade pick → next act.
- Between acts: arena regenerates (terrain + palette), player heals 25% of max HP, and a 2s non-interactive act title card shows (`ACT 2 — COASTAL STRIKE`).
- HUD: `ACT n · WAVE m` or `ACT n · FINALE`, plus objective lines during finales.
- State machine gains one phase: `actIntro`. All other phases unchanged.
- Death rules unchanged (hp 0 → gameover), except convoy-fail partial penalty (below).

## Terrain

`game/terrain.ts` — pure, seeded, unit-tested:

- Heightfield sampled at 8px columns across ARENA_W; `heightAt(x)` linear query.
- **Sea act:** flat water at WATERLINE (exactly today's arena; subs everywhere).
- **Coast act:** left half water (subs/rafts live there), right half rises into beach, dunes, and a town of flat-top building silhouettes; some rooftops flagged as survivor spots; one helipad LZ span.
- **Inland act:** no water; rolling hills, a valley, and a plateau holding the enemy base; two flat LZ spans (extraction + friendly edge pad).
- Terrain collision: touching ground/buildings = 10 damage + bounce (same feel as waterline) UNLESS landing: descending gently (|vy| < 40, |vx| < 30) onto a flagged LZ span = safe touch-down (needed for touch-and-go pickups).
- Depth charges over land act as contact bombs: detonate on terrain impact with normal blast resolution (they still sink normally in water).
- Water-only enemies (subs, mines, gunboats) spawn only over water columns; ground enemies only on sufficiently flat land spans.
- Renderer draws terrain as layered silhouette fill with biome palette; waterline strip only over water spans.

## New enemies

| Enemy | Biome | Behavior | Cost | HP |
|---|---|---|---|---|
| Scout chopper | coast+ | Flies straight at player, detonates on contact or death (small blast) | 3 | 8 |
| Gunship chopper | coast+ | Matches player altitude, holds ~140px standoff, 3-round cannon bursts with gaps | 7 | 24 |
| Missile chopper | coast+ | Stays at long range, fires homing missiles (SAM steering, slower turn), flees inside 100px | 8 | 16 |
| AA gun | coast+ | Fixed emplacement, aimed flak bursts; killable by bombs/missiles only | 5 | 1 (bomb) |
| Tank | inland | Patrols flat spans, arcing shells | 6 | 20 |

Wave composition: biome defines the eligible enemy pool (existing sea roster stays for sea acts and coast water half); UNLOCK gating switches to per-biome pools with act-scaled budgets. Air enemies are bullet- and missile-vulnerable; ground enemies bomb-vulnerable (AA/tank take bullet chip damage at 50%).

## Player homing missiles

- New repeatable upgrade card **AA Missiles** appears in the pool from Act 2: +2 missiles per pick, carry cap 6.
- Fire: `E` key, or long-press FIRE on touch (≥350ms hold releases a missile instead of cannon).
- Missile: 200 px/s, homing (steerHoming, turn 3.0 rad/s) toward nearest air enemy at launch; damage 24 (scout/gunship die in 1, missile chopper in 2); 4s life; air targets only.
- Stock: +1 missile after each cleared wave (cap 6). HUD missile pips beside charge pips.

## Finale objectives

`game/objectives.ts` — one interface, four implementations:

```
interface Objective {
  update(world, dt): void;
  status: 'active' | 'won' | 'failed';
  hudLines(): string[];
}
```

- **ClearWave** (wraps existing wave-clear rule for combat waves).
- **EscortConvoy (sea finale):** 3 boats cross left→right over ~60s under scripted sub/air spawns. Won: ≥1 boat exits right edge. Failed: all boats sunk. On first fail: player loses 25 hp and the finale restarts once; second fail = run over.
- **WinchRescue (coast finale):** 4 survivors (rafts on water, flagged rooftops in town). Hover within 20px above a survivor at low speed (|v| < 30) for 2s → winch animation, survivor boards (carry ≤ 3). Deliver at helipad LZ (hover/land on span). Won: 3 delivered. Survivors can be killed by any blast (including player's) — killed survivor is lost. Failed: fewer than 3 remain deliverable.
- **BaseAssault (inland finale):** enemy HQ building (5 bomb hits) on the plateau, defended by AA guns, tanks, choppers. A downed pilot waits near the base; touch-and-go land on the extraction LZ to board him, then return him to the friendly LZ at the left edge. Won: HQ destroyed AND pilot delivered. Pilot killed by blast = failed (same retry rule as convoy: one retry at 25 hp cost).

World holds exactly one active objective; state machine sees `won` → upgrade phase; `failed` applies the retry/game-over rule.

## Module impact

| File | Change |
|---|---|
| game/terrain.ts (new) | heightfield gen, heightAt, LZ/rooftop spans, collision resolve — pure, tested |
| game/biomes.ts (new) | biome data: terrain params, enemy pools, palette, finale factory |
| game/objectives.ts (new) | Objective interface + 4 implementations — pure logic, tested |
| game/waves.ts | per-biome pools, act-scaled budget |
| game/entities/* | chopper/AA/tank/survivor/boat/pilot/missile types + AI steppers |
| game/world.ts | act state, objective delegation, terrain collision, missile weapon, spawn gating |
| game/upgrades.ts | AA Missiles card (act-gated availability) |
| game/state.ts | + actIntro phase |
| core/input.ts | E key + FIRE long-press for missile |
| render/sprites.ts | chopper ×3, AA, tank, survivor, boat, pilot, missile, HQ frames |
| render/renderer.ts | terrain silhouettes + palettes, winch line, objective HUD, act title card, missile pips |
| core/audio.ts | events reused; new 'winch'/'missile' map to existing synth helpers |

## Testing

Pure-logic Vitest coverage: terrain determinism/bounds/LZ flatness; objective transitions (convoy counting + retry rule, winch timing + carry cap, HQ hp + pilot chain); biome pool gating (no subs on land, no tanks at sea); missile stock arithmetic (cap, wave refill, card adds); chopper steering caps. Rendering/feel verified by preview playtest per act.

## Balance guardrails

- Act 1 stays exactly current difficulty (regression guard: same seed → same wave 1-3 composition as today).
- Scout blast cannot chain mines (air blast doesn't reach underwater).
- Missile chopper flee speed < player max speed (always catchable).
