# Sea Bomber — Pointer Aiming & Graphics Upgrade: Design Spec

**Date:** 2026-07-10
**Baseline:** main at f7c04d8 (v1 complete: 14-task plan, 39 tests green).

## Problem

1. The autocannon fires along `facing` (last horizontal move input), so the heli often shoots away from the target the player is watching — reads as "firing backwards".
2. Direction changes are an instant sprite flip; no turning motion.
3. Overall sprite/environment/FX detail is minimal.

## Decisions (locked)

| Axis | Choice |
|---|---|
| Aiming | Pointer aim (mouse, 360°); touch uses right-half aim stick + dedicated fire button |
| Heli visual | Bank frames + rotating chin turret (approach A) |
| Graphics scope | All four: heli sprite, enemy/weapon sprites, environment, FX |
| Out of scope | Enemy AI, scoring, upgrades, waves, audio unchanged |

## Aiming mechanics

### Intent

`Intent` gains `aim: { x: number; y: number } | null`:

- **Mouse:** every pointermove updates the aim point (canvas coords via existing `toCanvas`). main.ts converts canvas→world by adding `world.camX` before `world.update`. Fire = left mouse button or F, toward aim.
- **Touch:** right half of the screen (excluding reserved button zones) anchors an **aim stick**; its displacement is a direction, converted to a world point at fixed distance (200 px) from the player, so the same `aim` field serves both input styles. Two fixed on-screen buttons bottom-right: FIRE and DROP (~48 px circles, drawn by renderer as touch UI when a touch has been seen). Left virtual move stick unchanged.
- **Fallback:** `aim === null` (no pointer seen yet) → fire along `facing` as before.

### World

- Player state gains `turretAngle` (radians). Target angle = atan2(aim − player). Eases toward target at 10 rad/s (clamped step, same math as `steerHoming`'s cap).
- Bullets spawn at the turret muzzle (nose offset rotated by turretAngle), velocity 300 px/s along `turretAngle`. Any angle allowed.
- Bullets still expire below the waterline — autocannon stays a surface/air weapon; depth charges remain the anti-sub weapon.
- `facing` (sprite flip) derives from horizontal aim direction while firing, otherwise from horizontal velocity when |vx| > 15.
- Point defense, flak, torpedoes, SAMs unchanged.

## Heli visuals & turn motion

- New 32×16 heli sprites in the generated sheet: 3 bank frames (level / lean / hard) × 2 rotor frames = 6 frames. Bank frame from |vx|: `<30` level, `<90` lean, else hard.
- **Turn transition:** renderer keeps `turnScale` easing between +1 and −1 over ≈120 ms when `facing` flips (drawn as scaleX; passes through 0 mid-turn so the heli visibly swings around). Pitch: slight rotation from vy, clamped ±0.15 rad.
- **Chin turret:** 6×3 gun sprite drawn at nose offset, rotated to `turretAngle`, flipped consistently with body. 2-frame muzzle flash (bright quad at muzzle) for ~50 ms after each shot.

## Graphics upgrades

### Sprites (sprites.ts, all procedural)
- Subs 26×12: hull shading (top highlight, bottom shadow), conning tower window, prop-wash bubble particles while moving.
- Gunboat 30×14: hull + superstructure + rotating-look turret barrel, wake foam at waterline.
- Mine: bob animation (sine y-offset in renderer), spike ring, blinking red light (t-based).
- Torpedo 10×4 with prop-trail bubbles; SAM with flame tail particles.

### Environment (renderer.ts)
- Two cloud parallax layers (far 0.15×, near 0.4×) + horizon haze band above the waterline.
- Wave strip: two rows of animated sine waves with white foam caps.
- Underwater: stronger depth gradient, light rays fade out below mid-depth (depth fog).
- Sun glare: soft radial highlight patch on the water, fixed world position.

### FX
- Explosions: expanding shockwave ring (stroked circle, ~0.3 s) + 1-frame white flash + existing particles.
- Screen shake: `world.shake` magnitude, +2 on boom, +4 on player hit, decays 8/s; renderer offsets all world-space drawing by random jitter × shake.
- Player smoke trail when hp < 40% of max (dark particles from tail).
- Tracers: bullets drawn as 6px streak along velocity with 1px glow.
- Enemy hit flash: gunboat (the only multi-hp enemy) draws white-tinted 1 frame when hit (world tracks `hitFlash` timer on subs).

## Touch UI

Renderer draws (only after first touch input seen — `input.touchSeen` flag): move-stick anchor circle when active, aim-stick anchor when active, FIRE and DROP buttons bottom-right. Input owns the button hit zones (screen-space, sized from window dims); renderer reads their positions from an exported layout helper shared with input (same pattern as `cardRect`).

## Testing

- Pure helpers unit-tested (Vitest): aim point→angle (incl. stick-direction→world-point conversion), turret ease clamp (never overshoots, wraps ±π), bank frame selection thresholds, shake decay.
- Rendering/touch verified by preview playtest + screenshots.
- All existing 39 tests must stay green; physics/AI untouched.

## Module impact

| File | Change |
|---|---|
| core/input.ts | aim tracking (mouse move, aim stick), fire button zones, `touchSeen` |
| game/world.ts | turretAngle ease, muzzle spawn, facing rule, shake field, hitFlash, smoke emit |
| game/aim.ts (new) | pure helpers: angle math, ease-with-cap, bank frame pick — unit tested |
| render/sprites.ts | new heli/turret/enemy frames |
| render/renderer.ts | turnScale, turret + muzzle flash, env layers, FX, touch UI |
| src/main.ts | canvas→world aim conversion, pass-through |
