# Sea Bomber

Modern browser reimagining of the 2003 J2ME game "AH-1 Sea Bomber" (Mr. Goodliving Ltd.).
Arcade roguelite: pilot a helicopter over open sea, depth-charge submarines through
escalating waves, pick upgrade cards between waves.

The original jar is kept in the repo root for design reference only; none of its
assets or code ship in this game.

## Run

    npm install
    npm run dev

## Controls

- Move: WASD / arrows · Drop charge: Space · Cannon: F or mouse · Mute: M
- Touch: left half = virtual stick, right-top = fire, right-bottom = drop

## Develop

    npm test        # vitest unit tests (pure game logic)
    npm run build   # typecheck + production build to dist/

## Rendering

Sea Bomber renders the complete battlefield to a 960×540 canvas and fits that
16:9 image inside the available viewport without cropping. Wider or taller
screens use letterboxing, while the screen-space HUD and touch controls are laid
out independently at the browser's device-pixel ratio and respect safe-area
insets.

Graphics quality starts at `full` and is selected from render duration only.
Sustained expensive draws step through `reduced` to `minimum`; sustained fast
draws recover one tier at a time. Lower tiers trim particles, debris,
reflections, and atmosphere without removing enemies, projectiles, aiming cues,
hit feedback, terrain, or the HUD. The simulation update is not included in the
quality sample and is not changed by the selected tier.

See [the painted-graphics playtest](docs/testing/painted-graphics-playtest.md)
for the release matrix and [the asset workflow](docs/assets/README.md) before
adding or replacing artwork.
