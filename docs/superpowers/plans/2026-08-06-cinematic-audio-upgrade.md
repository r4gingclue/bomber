# Cinematic Audio Upgrade Implementation Plan

**Goal:** Replace the procedural-only soundtrack with resilient cinematic SFX,
ambience, and synchronized adaptive music while preserving gameplay and boot
reliability.

**Design:** `docs/superpowers/specs/2026-08-06-cinematic-audio-upgrade-design.md`

**Tech stack:** TypeScript, Web Audio API, Vite, Vitest, Ogg Vorbis, JSON asset
ledgers.

## Global constraints

- Audio remains cosmetic and must never block game startup or simulation.
- Preserve all gameplay timing, damage, AI, scoring, and balance.
- Prefer CC0; allow CC-BY with complete attribution. Reject CC-BY-NC,
  Sampling+, unclear, ripped, or incompatible material.
- Do not combine unrelated music files as adaptive stems. All simultaneous music
  layers must share BPM, key, bar length, loop boundaries, and provenance.
- Keep total compressed audio between 15 and 25 MB.
- Load SFX after the first gesture and music after the menu is usable.
- Maintain procedural fallbacks for critical cues.
- Use test-first development for every behavior change.
- Keep the existing uncommitted touch, gamepad, helicopter, and projectile work
  intact; audio commits must not absorb or rewrite those changes accidentally.

## Preflight: isolate the existing verified work

Before Task 1, rerun the current full test/build gates and commit the already
completed touch detection, gamepad support, helicopter scaling, and projectile
rendering fixes as their own non-audio commit(s). Confirm `git status --short` is
clean before beginning audio work. This is required because Tasks 1, 5, 6, and 9
modify files that currently contain those uncommitted changes; path-based staging
would otherwise mix unrelated work into audio commits.

---

## Task 1: Typed, specific audio events

**Files:**

- Create: `src/core/audio-events.ts`
- Create: `src/core/audio-events.test.ts`
- Modify: `src/game/world.ts`
- Modify: `src/game/world.test.ts`
- Modify: `src/main.ts`

### Step 1: Add failing event-contract tests

Define `AudioEvent` as the exact union approved in the design. Add world tests
that exercise representative sources and assert specific events:

- Player cannon emits `cannon-fire`.
- Player missile emits `player-missile-launch`.
- Missile submarine and missile helicopter emit `enemy-sam-launch`.
- Charge release emits `depth-charge-drop`.
- Torpedo or charge water crossing emits `water-entry`.
- Charge blast emits `underwater-explosion`.
- Air enemy destruction emits `aircraft-explosion`.
- Nonlethal enemy impact emits `armor-hit`.
- Player damage emits `player-damaged`; death additionally emits `game-over`.
- Sonar emits `sonar-ping`.

The production mutation caught by these tests is reintroducing a generic event
that maps distinct actions to the same cue.

Run:

```bash
npx vitest run --exclude '.worktrees/**' src/core/audio-events.test.ts src/game/world.test.ts
```

Expected: FAIL because the event union and specific emissions do not exist.

### Step 2: Add the event union and migrate the world

Export `AudioEvent` and type `World.events` as `AudioEvent[]`. Replace every
generic `fire`, `boom`, `hit`, `splash`, `ping`, `drop`, `die`, and `ui` emission
with the most specific event available. Add UI events in `main.ts` rather than
emitting UI concerns from simulation.

Do not change when events occur, except to distinguish their source.

### Step 3: Verify and commit

```bash
npx vitest run --exclude '.worktrees/**' src/core/audio-events.test.ts src/game/world.test.ts
npm run typecheck
git add src/core/audio-events.ts src/core/audio-events.test.ts src/game/world.ts src/game/world.test.ts src/main.ts
git commit -m "refactor: add typed cinematic audio events"
```

---

## Task 2: Saved audio preferences and independent buses

**Files:**

- Create: `src/core/audio-preferences.ts`
- Create: `src/core/audio-preferences.test.ts`
- Modify: `src/core/audio.ts`
- Create: `src/core/audio.test.ts`

### Step 1: Add failing preference tests

Test a pure parser/serializer with literal fixtures:

- Missing storage returns `{ muted: false, music: 0.55, sfx: 0.8 }`.
- Malformed JSON returns defaults.
- Values below zero and above one clamp to `[0, 1]`.
- Missing fields use defaults without discarding valid fields.
- Round-trip uses versioned key `sea-bomber.audio.v1`.

Test `AudioSys` through a narrow fake audio adapter, asserting that master mute,
music volume, and SFX volume target separate gain stages. Do not assert browser
framework internals.

Run:

```bash
npx vitest run --exclude '.worktrees/**' src/core/audio-preferences.test.ts src/core/audio.test.ts
```

Expected: FAIL because preferences and independent buses do not exist.

### Step 2: Implement preferences and buses

Create pure load/save helpers around an injected `Storage`-like interface.
Refactor `AudioSys` to own master, music, and SFX gains. Keep `toggleMute()` and
add `setMusicVolume()`, `setSfxVolume()`, and `preferences` accessors. Apply gain
changes with short ramps to avoid clicks.

### Step 3: Verify and commit

```bash
npx vitest run --exclude '.worktrees/**' src/core/audio-preferences.test.ts src/core/audio.test.ts
npm run typecheck
git add src/core/audio-preferences.ts src/core/audio-preferences.test.ts src/core/audio.ts src/core/audio.test.ts
git commit -m "feat: add persistent music and SFX controls"
```

---

## Task 3: Typed audio manifest and resilient SoundBank

**Files:**

- Create: `src/audio/manifest.ts`
- Create: `src/audio/manifest.test.ts`
- Create: `src/audio/sound-bank.ts`
- Create: `src/audio/sound-bank.test.ts`
- Create: `public/assets/audio/.gitkeep`

### Step 1: Add failing manifest and loader tests

Define cue metadata with variant URLs, bus, base gain, pitch range, cooldown,
concurrency, priority, loop flag, and fallback name. Test that:

- Every required `AudioEvent` has a cue or explicit fallback.
- Duplicate output URLs and invalid gain/range/concurrency values are rejected.
- Successful files are decoded once and cached.
- One failed variant records a warning without rejecting the bank.
- A wholly missing critical cue remains callable through its fallback.
- Music loading can be requested separately from initial SFX loading.

Run:

```bash
npx vitest run --exclude '.worktrees/**' src/audio/manifest.test.ts src/audio/sound-bank.test.ts
```

Expected: FAIL because the modules do not exist.

### Step 2: Implement SoundBank

Use injected fetch/decode functions for tests. Cache by URL, return immutable cue
descriptors, and expose warnings. Loading must use `Promise.allSettled` so one
optional file cannot fail the bank. Do not create an `AudioContext` in this
module.

### Step 3: Verify and commit

```bash
npx vitest run --exclude '.worktrees/**' src/audio/manifest.test.ts src/audio/sound-bank.test.ts
npm run typecheck
git add src/audio public/assets/audio/.gitkeep
git commit -m "feat: add resilient cinematic sound bank"
```

---

## Task 4: Voice selection, cooldowns, and concurrency

**Files:**

- Create: `src/audio/voice-policy.ts`
- Create: `src/audio/voice-policy.test.ts`
- Modify: `src/core/audio.ts`

### Step 1: Add failing policy tests

With injected time and randomness, assert:

- Variant selection stays within bounds and is deterministic in tests.
- Pitch and gain variation stay within cue metadata ranges.
- A cue inside its cooldown is suppressed.
- A cue at concurrency capacity replaces only its oldest lower/equal-priority
  cosmetic voice.
- Critical `player-damaged`, `game-over`, and `sonar-ping` cues are not displaced
  by ambience or repeated cannon voices.
- Ended voices release their concurrency slot.

### Step 2: Implement and integrate the policy

Keep policy calculation pure. Let `AudioSys` own actual source nodes and report
voice start/end to the policy. Cap global simultaneous voices to a measured
default (start at 32), with lower per-cue limits for cannon and explosions.

### Step 3: Verify and commit

```bash
npx vitest run --exclude '.worktrees/**' src/audio/voice-policy.test.ts src/core/audio.test.ts
npm run typecheck
git add src/audio/voice-policy.ts src/audio/voice-policy.test.ts src/core/audio.ts
git commit -m "feat: manage cinematic audio voice pressure"
```

---

## Task 5: AudioEngine playback, fallback, and lifecycle

**Files:**

- Modify: `src/core/audio.ts`
- Modify: `src/core/audio.test.ts`
- Modify: `src/main.ts`

### Step 1: Add failing lifecycle tests

Test through the narrow audio adapter:

- `resume()` is idempotent.
- Rejected context creation/resume leaves audio retryable.
- A decoded cue plays through the SFX bus.
- A missing critical cue calls the named procedural fallback.
- Missing ambience remains silent.
- Hiding the document suspends continuous loops; returning resumes them on a
  synchronized boundary.
- A major explosion applies and releases temporary music ducking.

### Step 2: Refactor AudioSys into the engine boundary

Keep the public name `AudioSys` to minimize integration churn, but delegate
loading to `SoundBank` and selection to `voice-policy`. Retain improved versions
of noise, sweep, and oscillator fallbacks. Start initial SFX loading after the
first successful user gesture. Start music loading asynchronously after the menu
has rendered.

Use visibility and page lifecycle listeners through removable adapters; do not
leak intervals or listeners across reloads.

### Step 3: Verify and commit

```bash
npx vitest run --exclude '.worktrees/**' src/core/audio.test.ts src/audio/sound-bank.test.ts src/audio/voice-policy.test.ts
npm run typecheck
git add src/core/audio.ts src/core/audio.test.ts src/main.ts
git commit -m "feat: play buffered audio with procedural fallbacks"
```

---

## Task 6: Adaptive music state and synchronized director

**Files:**

- Create: `src/audio/music-state.ts`
- Create: `src/audio/music-state.test.ts`
- Create: `src/audio/music-director.ts`
- Create: `src/audio/music-director.test.ts`
- Modify: `src/core/audio.ts`
- Modify: `src/main.ts`

### Step 1: Add failing state tests

Define a pure snapshot containing phase, enemy count/weighted pressure,
player-health ratio, muted state, and visibility. Assert:

- Menu selects `menu`.
- Playing below pressure threshold selects `combat-low`.
- Sustained pressure crosses into `combat-high`; a short dip does not oscillate.
- Health below 30% enables `low-health` only during combat.
- Muted or hidden selects `silent`.
- Upgrade/act-intro preserve a low-intensity bed rather than restarting music.

### Step 2: Add failing scheduling tests

Using a fake clock and gain lanes, assert:

- All stems start at the same audio timestamp and loop duration.
- State changes ramp gains over 1–3 seconds without recreating the timeline.
- Wave-clear and game-over stingers duck then restore the score.
- A missing optional stem is skipped while remaining stems stay synchronized.
- Resume calculates the next shared bar boundary.

### Step 3: Implement and integrate

`MusicDirector` receives decoded stem buffers and a narrow scheduling adapter.
Main computes a music snapshot once per update or at a throttled 10 Hz cadence.
Do not expose `World` directly to the director.

### Step 4: Verify and commit

```bash
npx vitest run --exclude '.worktrees/**' src/audio/music-state.test.ts src/audio/music-director.test.ts
npm run typecheck
git add src/audio/music-state.ts src/audio/music-state.test.ts src/audio/music-director.ts src/audio/music-director.test.ts src/core/audio.ts src/main.ts
git commit -m "feat: add synchronized adaptive combat music"
```

---

## Task 7: Curate, edit, and ledger cinematic sound effects

**Files:**

- Create: `docs/assets/audio-sources.json`
- Create: `docs/assets/AUDIO-CREDITS.md`
- Create: `public/assets/audio/sfx/*.ogg`
- Create: `public/assets/audio/ambience/*.ogg`
- Modify: `src/audio/manifest.ts`
- Modify: `.gitignore`

### Step 1: Protect source material

Ignore `assets-source/audio/`, downloaded archives, editor project files, and
lossless working exports unless redistribution is explicitly required and
permitted. Never commit account tokens, Freesound API credentials, or unclear
source files.

### Step 2: Build a candidate ledger before downloading

For each required cue, record title, creator, direct asset page, direct license,
license URL, and candidate role. Prefer CC0. CC-BY candidates must have a stable
author identity and source page. Reject candidates whose upload plausibly
contains ripped game/film audio.

Required pools:

- 3 cannon variants.
- 2 player missile launch variants.
- 2 enemy SAM launch variants.
- 2 charge-drop/mechanical variants.
- Water entry.
- 3 underwater explosions.
- 3 air/surface explosions.
- 2 armor impacts.
- 2 player-damage impacts.
- Sonar ping.
- UI confirm and upgrade cues.
- Rotor and ocean/wind ambience loops.
- Wave-start, wave-clear, and game-over stingers if not supplied by the music
  stem family.

### Step 3: Download and transform

Download only after ledger review. Trim silence, remove DC offset, high-pass
unwanted rumble where appropriate, normalize conservatively, create seamless
loops, and encode Ogg Vorbis. Preserve dynamics; do not normalize every effect
to full scale. Record every transformation in the ledger.

### Step 4: Validate assets

Add `scripts/validate-audio-assets.mjs` and tests/fixtures if needed. Validate:

- Every manifest URL exists.
- Every ledger output exists exactly once.
- Every license is in the approved allowlist.
- No non-commercial or unknown license appears.
- Encoded total is 15–25 MB after music is included.
- Ogg files are nonempty and decodable by the browser smoke test.

Run:

```bash
node scripts/validate-audio-assets.mjs
npm run build
```

Manually audition every pool at matched in-game loudness before committing.

### Step 5: Commit

```bash
git add .gitignore docs/assets/audio-sources.json docs/assets/AUDIO-CREDITS.md public/assets/audio/sfx public/assets/audio/ambience src/audio/manifest.ts scripts/validate-audio-assets.mjs
git commit -m "assets: curate licensed cinematic sound effects"
```

---

## Task 8: Curate and integrate one compatible adaptive music family

**Files:**

- Create: `public/assets/audio/music/*.ogg`
- Modify: `docs/assets/audio-sources.json`
- Modify: `docs/assets/AUDIO-CREDITS.md`
- Modify: `src/audio/manifest.ts`

### Step 1: Apply the music compatibility gate

Select one CC0 or CC-BY family that provides, or legally permits deriving, all
simultaneous layers. Confirm and ledger:

- Common BPM and key.
- Identical sample rate, bar count, loop length, and exact boundaries.
- Menu or intro material.
- Low combat bed.
- Tension layer.
- Percussion/action layer.
- Optional low-health texture.
- Compatible wave-clear and game-over stingers.

If no candidate passes, stop and present alternatives. Do not layer unrelated
tracks. The acceptable fallback is one licensed combat loop with original
procedural percussion/texture layers, documented as such and approved before
continuing.

### Step 2: Edit and encode synchronized stems

Align every stem sample-accurately, remove loop clicks, preserve shared duration,
and encode all stems with identical settings. Record source and transformations.

### Step 3: Add scheduling metadata tests

Extend manifest tests to assert equal loop duration, BPM, beats per bar, and bar
count for all simultaneous stems. Run the director tests against real metadata.

### Step 4: Audition and commit

Manually verify menu-to-combat, low-to-high combat, low health, wave clear,
game-over, mute/unmute, and tab return. Reject harsh transitions or audible loop
seams.

```bash
npx vitest run --exclude '.worktrees/**' src/audio/manifest.test.ts src/audio/music-director.test.ts
node scripts/validate-audio-assets.mjs
git add public/assets/audio/music docs/assets/audio-sources.json docs/assets/AUDIO-CREDITS.md src/audio/manifest.ts
git commit -m "assets: add licensed adaptive cinematic score"
```

---

## Task 9: Menu audio controls and credits

**Files:**

- Create: `src/render/audio-settings.ts`
- Create: `src/render/audio-settings.test.ts`
- Modify: `src/render/ui-layout.ts`
- Modify: `src/render/ui-layout.test.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/core/input.ts`
- Modify: `src/core/input.test.ts`
- Modify: `src/main.ts`

### Step 1: Add failing settings behavior tests

Test a pure layout/model contract:

- Music and SFX sliders remain inside safe areas at desktop, landscape phone,
  and portrait phone sizes.
- Slider hit testing maps left edge to 0, right edge to 1, and clamps outside.
- Mute state is visible and togglable.
- Touch, mouse, keyboard, and gamepad can reach settings without starting a run.
- Credits view exposes every CC-BY creator from generated runtime credit data.

### Step 2: Implement controls

Add a compact audio panel to the menu. Keep `M` as master mute. Add keyboard and
gamepad navigation only to the extent needed to make sliders and credits usable;
do not create a general menu framework. Update values live through `AudioSys`.

Generate runtime credit data from the validated ledger during build or maintain
a typed checked-in projection validated against it. Do not fetch credits at
runtime.

### Step 3: Verify and commit

```bash
npx vitest run --exclude '.worktrees/**' src/render/audio-settings.test.ts src/render/ui-layout.test.ts src/core/input.test.ts
npm run build
git add src/render/audio-settings.ts src/render/audio-settings.test.ts src/render/ui-layout.ts src/render/ui-layout.test.ts src/render/renderer.ts src/core/input.ts src/core/input.test.ts src/main.ts
git commit -m "feat: add accessible music and SFX settings"
```

---

## Task 10: Documentation, performance, and cross-device audio gate

**Files:**

- Create: `docs/testing/cinematic-audio-playtest.md`
- Modify: `docs/assets/README.md`
- Modify: `README.md`
- Modify: `package.json`

### Step 1: Add automated validation commands

Add an `audio:validate` script for manifest, ledger, license, file, and budget
checks. Include it in documented release gates.

### Step 2: Document the manual matrix

The playtest must cover:

- Desktop Chrome/Safari and mobile Chrome/Safari.
- Headphones, laptop speakers, and phone speakers.
- Keyboard, touch, mouse, and gamepad first gestures.
- Menu, low combat, high combat, low health, upgrade, act intro, wave clear, and
  game over.
- Rapid cannon fire, simultaneous explosions, repeated SAM launches, and sonar.
- Music/SFX sliders, master mute, reload persistence, tab hide/resume, and device
  audio interruption.
- Offline/missing-file behavior.
- No clipping, stuck loops, harsh seams, late critical cues, or gameplay-blocking
  load.

### Step 3: Run all gates

```bash
npm run typecheck
npx vitest run --exclude '.worktrees/**'
npm run audio:validate
npm run build
git diff --check
```

Use browser network throttling to verify that the menu remains usable before
music downloads. Record final compressed byte total and attribution count in the
playtest document.

### Step 4: Final commit

```bash
git add README.md docs/assets/README.md docs/testing/cinematic-audio-playtest.md package.json
git commit -m "docs: verify cinematic audio across devices"
```

## Completion criteria

- All ten tasks are committed in order and all gates pass.
- Every audio file has verified provenance and an approved license.
- The adaptive layers are musically and technically compatible.
- Audio preferences persist and every input method can operate them.
- Missing assets and autoplay failures leave the game fully playable.
- Manual acceptance confirms cinematic impact without masking critical cues.
