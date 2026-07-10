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
