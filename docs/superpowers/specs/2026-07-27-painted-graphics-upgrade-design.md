# Sea Bomber Painted Graphics Upgrade

**Date:** 2026-07-27  
**Status:** Approved design  
**Scope:** Presentation and rendering only; side-view gameplay remains unchanged

## Goal

Upgrade Sea Bomber from low-resolution generated pixel art to a high-detail,
painted military arcade presentation inspired by the dimensional readability of
classic 16-bit helicopter games. The result must retain the current side-view,
side-scrolling gameplay while working across desktop, tablet, and phone displays.

The upgrade must use original vehicle and character artwork. Selected assets from
the user's PVGames packs may be adapted for environmental scenery, textures, and
props where their perspective and license are compatible.

## Approved Direction

The selected visual direction is **high-detail painted arcade**:

- Smooth, dimensional silhouettes with highlight, midtone, and core-shadow layers.
- Rich atmospheric gradients and biome-specific color grading.
- Projected shadows, terrain depth, environmental haze, and local impact flashes.
- Dense but bounded particles for smoke, debris, dust, spray, sparks, and explosions.
- Clear side-view silhouettes and projectile readability during fast combat.

This direction deliberately avoids copying artwork from Desert Strike or the
original Sea Bomber JAR. Those titles are visual references only.

## Constraints

- Preserve side-view and side-scrolling gameplay.
- Preserve the current 480×270 simulation coordinate system.
- Preserve physics, collision, aiming, weapons, AI, wave composition, and balance.
- Render at a new 960×540 logical canvas resolution.
- Preserve the complete 16:9 battlefield on every device; never crop gameplay.
- Use responsive letterboxing when the viewport aspect ratio differs.
- Keep all existing gameplay tests green without weakening assertions.
- Maintain playable performance on modern mobile and desktop browsers.
- Retain fallbacks when optional scenery assets fail to load.

## Rendering Architecture

### Coordinate systems

The simulation continues to operate in 480×270 world coordinates. The renderer
maps simulation coordinates into a 960×540 logical canvas with a 2× transform.
This isolates the graphics upgrade from gameplay tuning and keeps collision,
speed, range, terrain, and aiming behavior stable.

Input conversion must invert both the responsive viewport transform and the 2×
render transform so mouse and touch aim remain aligned with simulation space.

### Responsive viewport

The viewport fits the entire 16:9 canvas inside the available browser area:

- Scale proportionally both up and down.
- Center with neutral, cinematic letterboxing.
- Account for CSS safe-area insets on notched devices.
- Recompute on resize, orientation, fullscreen, and device-pixel-ratio changes.
- Keep HUD and touch controls inside safe areas.
- Size touch targets by physical display scale rather than simulation pixels alone.

Portrait layouts retain the complete battlefield. Unused space may carry
letterbox treatment and control affordances, but must not reveal or crop world
content.

### Layer order

The renderer is divided into explicit depth layers:

1. Sky gradient, sun, distant haze, clouds, mountains, and coastline.
2. Midground structures and adapted environmental scenery.
3. Terrain top surface, shaded terrain face, roads, rocks, vegetation, and water.
4. Projected shadows for aircraft, vehicles, boats, and structures.
5. World entities using original high-resolution side-view artwork.
6. Weapons, tracers, wakes, rotor wash, debris, smoke, dust, spray, and explosions.
7. Cinematic overlays including biome grading, underwater tint, vignette, and damage flash.
8. Resolution-independent HUD, menus, title cards, and touch controls.

Each layer has a clear renderer method and may be simplified independently by the
quality system.

## Art System

### Player helicopter

The player helicopter is approximately 80–100 rendered pixels long at 960×540.
It includes:

- Fuselage, canopy, tail boom, tail rotor, skids, weapon pods, and chin turret.
- Level, accelerating, braking, climbing, and descending attitudes.
- Independent turret rotation with a defined pivot and muzzle position.
- Main-rotor disc blur and tail-rotor animation.
- Navigation lights, exhaust heat, muzzle flashes, and progressive damage smoke.
- Altitude-aware ground or water shadow that narrows and darkens near the surface.
- Visual inertia: body attitude eases into turns while the simulation remains unchanged.

Flipping must preserve the correct nose direction. Turret aim remains independent
of body facing.

### Other units

Enemy helicopters, tanks, AA guns, gunboats, submarines, mines, and missiles use
original side-view art with the same lighting model. Each unit keeps a distinctive
silhouette and palette at gameplay scale.

Enemy helicopter silhouettes must remain distinguishable by role:

- Scout: small, light, agile shape.
- Gunship: broad body and prominent cannon.
- Missile chopper: visible pods and heavier tail/body profile.

### Terrain and water

The collision surface remains column-based and unchanged. Rendering interpolates
the sampled surface into a smooth visual contour without changing collision.

Land receives:

- A light-catching top edge.
- Textured top material.
- Shaded soil or rock face.
- Deterministic decals and props.
- Biome-specific roads, buildings, vegetation, rocks, and debris.

Water receives:

- Layered reflections and specular bands.
- Surface foam and wave breakup.
- Entity wakes, rotor wash, and impact columns.
- Underwater depth haze and subtle refraction bands.

### Effects

Explosions use layered flash cores, expanding fire, smoke, sparks, fragments, and
brief local bloom. Land impacts add dust and dirt; water impacts add spray and
foam. Missile trails, tracers, exhaust, damage smoke, and wreck debris must remain
visually distinct.

Effect counts are capped and pooled. Cosmetic emissions may be reduced by the
quality system; gameplay entities and hit feedback may not be removed.

## External Asset Use

Recommended source packs from
`/Users/paulcooke/Documents/Projects/gdot-assests`:

- `Doomsday Tiles MilitaryBase.zip`
- `Doomsday Tiles Rural.zip`
- `Other Worlds Sands Tiles.zip`

Permitted uses:

- Adapted military structures, ruins, roads, sandbags, barrels, antennas, rocks,
  vegetation, and environmental clutter.
- Cropped or repainted surface textures and palette references.
- Midground or background scenery where the original perspective can be reconciled
  with the side view.

Excluded direct uses:

- Player and enemy helicopters.
- Tanks and other moving vehicles.
- Submarines, boats, missiles, and character sprites.
- Any source image whose top-down perspective conflicts with the side-view scene.

The included PVGames readme permits edited or original resources in commercial
and non-commercial projects, but prohibits redistribution of the resources as an
asset pack. The project must:

- Retain a copy of the applicable license/readme in an asset attribution directory.
- Include only selected, transformed, game-ready outputs in the distributable.
- Never commit or publish the source zip archives.
- Record source pack and transformation notes for every imported output.

## Asset Pipeline

The runtime loads curated atlases, not source archives:

1. Select an approved source image.
2. Crop, repaint, recolor, and reconcile perspective as needed.
3. Export a game-ready transparent PNG or atlas region.
4. Record source pack, source filename, output filename, and transformation notes.
5. Validate dimensions, transparency, and atlas bounds.
6. Load through a typed manifest.

Critical entity art is required. In development, missing critical frames produce
an explicit visible error and console diagnostic. Optional scenery falls back to
procedural terrain and is omitted safely.

## Quality Tiers

Quality is selected from measured frame time, not user-agent strings.

### Full

- Rich particles and debris.
- Soft projected shadows.
- Animated haze, reflections, scenery, and rotor wash.
- Full grading, vignette, and local flashes.

### Reduced

- Lower particle limits.
- Simpler, lower-resolution shadows.
- Reduced animated scenery and water layers.
- Essential grading and impact feedback retained.

### Minimum

- Essential sprites, terrain, projectiles, shadows, and HUD.
- Minimal particles and static atmosphere.
- No loss of enemies, objectives, aiming cues, projectiles, or hit feedback.

The system samples a rolling frame-time window, requires sustained pressure before
stepping down, and applies hysteresis before stepping up. It must not oscillate
between tiers during normal play. A user-facing quality override may be added only
if automatic selection proves insufficient in playtesting.

## Delivery Stages

1. Responsive 960×540 viewport and 2× renderer transform.
2. Typed asset manifest, preload flow, atlas support, and fallbacks.
3. Vertical slice: player helicopter, dimensional terrain, shadows, lighting, and
   effects in one biome.
4. Quality gate and visual review of the vertical slice.
5. Enemy, vehicle, boat, submarine, and weapon artwork.
6. Smoothed terrain, all biome scenery, and adapted environmental props.
7. Water, atmosphere, particles, explosions, and cinematic grading.
8. HUD, menus, touch controls, and safe-area treatment.
9. Automatic quality tiers and performance tuning.
10. Cross-device visual regression and manual playtest.

The vertical slice is mandatory before full asset conversion. It prevents a large
batch of inconsistent artwork and gives a concrete readability and performance
target.

## Testing

### Automated

- Responsive fit calculations preserve 16:9 and never crop.
- Simulation-to-render and input-to-simulation transforms round-trip correctly.
- Safe-area calculations keep HUD and touch targets visible.
- Animation frame selection is deterministic and valid.
- Asset manifests reject missing critical frames and tolerate missing optional scenery.
- Quality transitions use sustained frame-time thresholds and hysteresis.
- Deterministic scenery placement is stable for the same biome and seed.
- Existing gameplay, physics, aiming, AI, wave, and collision tests remain green.

### Visual regression

Capture sea, coast, and inland scenes at:

- Desktop 16:9.
- Tablet landscape.
- Landscape phone with safe-area insets.
- Constrained portrait viewport with letterboxing.

Snapshots cover player attitudes, each enemy category, projectiles, explosions,
water impacts, land impacts, shadows at multiple altitudes, HUD, touch controls,
menus, upgrades, and title cards.

### Manual

- Mouse, keyboard, and touch aiming remain aligned.
- Player and enemy silhouettes remain readable against every biome.
- Projectiles and interceptable rockets remain visible.
- Resize and orientation changes do not jump, crop, or offset input.
- Letterboxing does not cover controls or show unintended world content.
- Full, reduced, and minimum tiers remain playable.
- Reduced-flash treatment retains hit confirmation.
- Sustained combat remains smooth on representative desktop, tablet, and phone hardware.

## Acceptance Criteria

- The full battlefield is visible on all supported viewport shapes.
- The game renders at 960×540 while simulation behavior remains unchanged.
- The player helicopter and major enemies read as dimensional, original side-view art.
- Terrain, shadows, atmosphere, and effects produce a coherent painted military style.
- Approved external assets appear only as adapted environmental content.
- No source archive or redistributable raw asset is shipped.
- All existing gameplay tests pass.
- New viewport, asset, quality, and visual checks pass.
- The vertical slice is approved before full conversion proceeds.
- Representative mobile and desktop playtests meet readability and performance goals.

