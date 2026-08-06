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
- Touch: visible MOVE circle = movement · unoccupied non-button touch area
  (normally right side) = aim stick · FIRE = tap for cannon, hold for missile ·
  DROP = depth charge
- Gamepad (standard mapping): left stick / D-pad = movement · right stick = aim ·
  A / RT = cannon · B / LT = depth charge · X / RB = missile · A / Start =
  confirm · A, B, X = choose upgrade cards 1, 2, 3

Touch controls appear immediately on touch-first devices without a fine pointer
or hover-capable mouse, and also appear after the first touch on hybrid devices.
Connected standard-mapping gamepads are detected automatically while the game runs.

## Develop

    npm test        # vitest unit tests (pure game logic)
    npm run build   # typecheck + production build to dist/

## Rendering

Sea Bomber renders the complete battlefield to a 960×540 canvas and fits that
16:9 image inside the available viewport without cropping. Wider or taller
screens use letterboxing, while the screen-space HUD and touch controls are laid
out independently at the browser's device-pixel ratio and respect safe-area
insets.

Graphics quality starts at `full` and is selected from a rolling window of
delivered animation-frame intervals. That pressure signal includes simulation,
rendering, browser scheduling, and display delivery instead of measuring only
the synchronous canvas draw submission. Sustained pressure steps through
`reduced` to `minimum`; a longer fast-frame hysteresis recovers one tier at a
time. Lower tiers trim particles, debris, reflections, atmosphere, animated
water/cloud work, and soft shadow filtering without removing enemies,
projectiles, aiming cues, hit feedback, terrain, or the HUD.

See [the painted-graphics playtest](docs/testing/painted-graphics-playtest.md)
for the release matrix and [the asset workflow](docs/assets/README.md) before
adding or replacing artwork.
