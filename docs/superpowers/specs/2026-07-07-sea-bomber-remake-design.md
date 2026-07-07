# Sea Bomber — Modern Reimagining: Design Spec

**Date:** 2026-07-07
**Source inspiration:** "AH-1 Sea Bomber" (Mr. Goodliving Ltd., 2003, J2ME/MIDP-1.0, Nokia 128×128). Original jar kept in repo root as reference only; its art and code are not shipped or reused.

## Vision

A browser-based arcade roguelite reimagining of the 2003 helicopter-vs-submarine game. You pilot an attack helicopter over open sea, dropping depth charges on submarines while dodging torpedoes, SAMs, and flak. Runs are short and replayable: clear a wave, pick one of three upgrade cards, fight the next, escalating until death. Modern pixel art, procedural audio, 60 fps, playable with keyboard or touch.

## Decisions (locked)

| Axis | Choice |
|---|---|
| Platform | Web browser (desktop + mobile) |
| Fidelity | Reimagining (original is inspiration, not a template) |
| Structure | Arcade roguelite: waves + upgrade card picks per run |
| Art | Modern pixel art, palette inspired by original (yellow subs, blue sea) |
| Movement | Free 2D flight in sky zone above waterline |
| v1 must-haves | Touch/mobile controls; sound + music |
| Tech | TypeScript + Vite + Canvas 2D + Web Audio, zero runtime dependencies |

## Game design

### Arena

Single bounded arena roughly two screens wide with gentle camera pan following the player. The waterline divides the arena: sky zone (~55% of height) where the helicopter flies, sea zone (~45%) where enemies operate. The helicopter cannot dive; touching the water splash-damages and bounces the player up.

### Run structure

1. **Menu** → start run.
2. **Wave n**: enemies spawn from a points budget that scales with n. Clear all enemies to end the wave.
3. **Upgrade pick**: choose 1 of 3 cards drawn from the upgrade pool (no duplicate cards within one pick).
4. Repeat from step 2 with a larger budget. No wave cap — difficulty scales until the player dies.
5. **Game over**: show wave reached, score, kills, accuracy. Restart into a fresh run.

No persistence in v1. Meta-progression and saved high scores are future hooks.

### Player

- Free 2D movement with inertia: acceleration + drag, sprite tilts into the direction of travel.
- HP bar. Damage sources: torpedoes, SAMs, flak, mine blasts, water contact. HP 0 ends the run.
- **Depth charges** (primary): drop from the helicopter, splash at the waterline, sink with water drag, explode on proximity to a sub or at armed depth. Blast radius damages everything in range, including mines (chain reactions allowed). Limited number in flight at once (base 2).
- **Autocannon** (secondary): short forward bursts. Effective against gunboats, mines at the surface, and incoming missiles/torpedoes in the air; ineffective underwater.

### Enemies (v1 roster)

| Enemy | Zone | Behavior | Threat |
|---|---|---|---|
| Patrol sub | Sea, varying depth | Cruises horizontally | None (points fodder, deeper = more points) |
| Hunter sub | Sea | Cruises; fires homing torpedoes that breach and chase the player for a limited time | Torpedo |
| Missile sub | Sea → surface | Surfaces, launches a SAM, dives again; vulnerable while surfaced | SAM |
| Gunboat | Waterline | Sits on surface, fires arcing flak | Flak arcs |
| Drift mine | Sea, random depth | Drifts slowly; detonates on blast or player splash contact | Area blast |

### Upgrade pool (initial set)

Blast radius up · +1 charge in flight · faster sink speed · dual drop (two charges per press, spread) · engine speed · armor (max HP up) · magnetic charges (curve toward nearest sub) · sonar ping (subs outlined for 3 s on wave start and periodically) · point-defense tracers (autocannon auto-clips nearby incoming projectiles).

Upgrades are pure stat/flag modifiers on a single `PlayerStats` object; effects must not be implemented as scattered conditionals.

### Scoring

Kill points scale with sub depth. Multi-kills from a single blast (including chained mines) multiply the score for that blast. Run result = wave reached + total score.

## Architecture

### Stack

TypeScript, Vite, Canvas 2D, Web Audio API. No runtime dependencies. Output is a static site.

### Modules

```
src/
  main.ts            — boot, canvas setup, loop start
  core/loop.ts       — fixed-timestep update (60 Hz), render interpolation, dt clamp
  core/input.ts      — keyboard + pointer/touch → unified intent {move, drop, fire}
  core/audio.ts      — Web Audio: synthesized SFX pool, music loop, mute toggle
  core/assets.ts     — sprite sheet generation/loading
  game/state.ts      — state machine: Menu → Playing → UpgradePick → GameOver
  game/world.ts      — entity list, spawn/despawn, waterline constant, camera
  game/entities/     — player, depthCharge, torpedo, sam, subs, gunboat, mine, particles
  game/waves.ts      — wave composition from scaling spawn budget (seeded RNG)
  game/upgrades.ts   — card pool, PlayerStats modifiers
  game/collision.ts  — circle/AABB checks, blast resolution incl. chain reactions
  render/renderer.ts — draw order: sky parallax, sea, entities, waterline FX, HUD
  render/sprites.ts  — sheet coordinates, animation frame tables
```

### Data flow

Input produces an intent struct → `update(dt)` mutates world state → renderer reads world and draws. Update and render are fully separated; entities contain no draw calls. Upgrades modify `PlayerStats` only.

### Rendering

Internal canvas at low logical resolution (target 480×270), integer-scaled to the window with `imageSmoothingEnabled = false`, letterboxed. Visual layers: parallax clouds, sea gradient with underwater tint and light rays, animated wave strip at the waterline, particle system (rotor wash foam, bubbles, explosions, smoke trails).

### Art pipeline

Original 2003 sprites are reference for palette and silhouette only. New pixel art is produced as a generated sprite sheet (programmatic pixel placement at build/boot). Nothing from the jar ships in the build.

### Input

- Keyboard: WASD/arrows to move, Space to drop, F or click to fire.
- Touch: left half of screen = virtual stick, right half = drop and fire buttons.
- Both feed the same intent struct; simultaneous sources merge with last-writer-wins per axis.

### Audio

All sounds synthesized with Web Audio (rotor thump, splash, sonar ping, explosion noise bursts, UI ticks) plus a short generated music loop. Audio context resumes on first user gesture (browser autoplay policy).

## Edge cases

- **Tab hidden:** pause loop on `visibilitychange`; clamp dt on resume so no physics spike.
- **Resize/rotate:** recompute integer scale and letterbox live.
- **Drop with 0 charges available:** input ignored, soft "empty" click feedback.
- **Player at arena bounds:** soft clamp, no wraparound.
- **Chain reactions:** blast resolution iterates until no new detonations; must terminate (each mine detonates once).

## Error handling

Sprite sheet and audio graph are built at boot; failures surface before the loop starts. Inside the loop, a per-entity update guard removes (and in dev, logs) a throwing entity rather than crashing the frame.

## Testing

Vitest unit tests for pure logic only:

- `collision.ts` — blast radius hits, overlap edge cases, chain-reaction termination.
- `waves.ts` — budget scaling, composition determinism under a seeded RNG.
- `upgrades.ts` — stat stacking, no duplicate cards in one pick.
- Entity physics — charge sink curve, torpedo homing turn-rate cap, sub depth bounds.

Rendering, audio, and input are verified by running the game (dev server + manual play).

## Out of scope for v1

Server leaderboards, meta-progression persistence, saved local high scores, gamepad support, multiple biomes/backdrops, boss submarines. Design leaves hooks (state machine, stats object, wave definitions) so these can be added without restructuring.
