# Cinematic Audio Upgrade Design

## Goal

Replace Sea Bomber's repetitive procedural soundscape with a cinematic military
audio system built from license-safe recorded effects and synchronized adaptive
music layers. Audio must improve impact, atmosphere, and gameplay clarity without
delaying boot, changing gameplay, or making the game dependent on optional files.

## Scope

The upgrade covers sound effects, ambient loops, adaptive background music,
musical stingers, event specificity, volume controls, saved preferences, asset
provenance, graceful fallback behavior, and audio regression testing.

The target compressed download is 15–25 MB. Music may load after the initial
screen. The visual rendering and gameplay simulation are outside this scope.

## Architecture

### AudioEngine

`AudioEngine` owns the `AudioContext` and four gain stages:

1. Per-voice gain and processing.
2. SFX or music bus.
3. Master gain.
4. Audio context destination.

It exposes master mute, music volume, and SFX volume. It resumes playback only
after a qualifying user gesture and safely handles suspended contexts, page
visibility changes, and browsers that reject a resume request. Preference values
are clamped to `[0, 1]` and persisted in `localStorage` under a versioned key.

### SoundBank

`SoundBank` loads, decodes, and caches an audio manifest. Each cue can contain a
pool of variants plus playback metadata: base gain, pitch variation, cooldown,
concurrency limit, and bus. A failed file produces a warning and leaves that cue
eligible for a procedural fallback. Audio failures never prevent game startup.

Music and ambience use decoded `AudioBuffer` sources scheduled by Web Audio.
This avoids the inconsistent looping and synchronization of ordinary `<audio>`
elements. Music begins loading after the initial menu is usable.

### MusicDirector

`MusicDirector` schedules synchronized layers on a shared musical timeline and
changes their bus gains without restarting the score. Its inputs are game phase,
enemy pressure, player-health ratio, and major transition events. Crossfades take
approximately 1–3 seconds.

The music states are:

- `menu`: restrained menu theme.
- `combat-low`: pulse and atmosphere.
- `combat-high`: tension and percussion layers added.
- `low-health`: a restrained danger layer over the current combat state.
- `silent`: used when muted, hidden for an extended period, or unavailable.

Wave clear and game over use short stingers. A stinger may briefly lower the
looping score but does not reset its synchronized timeline. Major explosions
briefly duck the music bus so effects remain intelligible.

### Audio events

Unstructured event strings are replaced with a typed event union. Required cues
include:

- `cannon-fire`
- `player-missile-launch`
- `enemy-sam-launch`
- `depth-charge-drop`
- `water-entry`
- `underwater-explosion`
- `aircraft-explosion`
- `armor-hit`
- `player-damaged`
- `sonar-ping`
- `ui-confirm`
- `upgrade-selected`
- `wave-start`
- `wave-clear`
- `game-over`

The world emits the most specific event available. The audio layer decides how
to render it and never feeds state back into simulation.

## Sound palette

The player helicopter has a continuous rotor loop and restrained mechanical
layer. Rotor playback responds subtly to movement/load without exaggerated pitch
changes. Ocean and wind ambience remain quiet enough not to mask gameplay cues.

Weapons use multiple recorded variants where repetition is obvious. Cannon,
missile, charge, enemy gunfire, and SAM launches remain distinguishable. Air,
surface, underwater, and player-damage impacts receive separate treatments.
Repeated cues use slight pitch/gain variation, cooldowns, and concurrency limits
to avoid machine-gun phasing and clipping.

UI cues are short military-console tones rather than loud weapon-like sounds.
Musical stingers communicate wave start, wave clear, upgrade selection, and game
over without interrupting input.

## Controls and persistence

The menu exposes:

- Master mute, with the existing `M` shortcut.
- Music volume slider.
- SFX volume slider.

Slider and mute values update live and persist locally. Missing or malformed
saved values fall back to defaults. The initial defaults preserve headroom at
the master bus and keep ambience/music below important combat effects.

## Asset sourcing and licensing

Assets are curated primarily from Freesound, with CC0 preferred and CC-BY used
when it materially improves quality. Pixabay Audio, OpenGameArt, or Kenney may
fill gaps only after their current terms and the individual asset license are
verified. CC-BY-NC, Sampling+, unclear, ripped, and otherwise incompatible audio
is prohibited.

`docs/assets/audio-sources.json` records for every shipped file:

- Output path and cue assignment.
- Title, creator, and direct source URL.
- License and license URL.
- Original filename and download date.
- Editing, trimming, normalization, layering, and encoding performed.

CC-BY creators are listed in an in-game or menu-accessible credits view and in
the repository documentation. Source downloads are retained only when their
license permits redistribution; otherwise the ledger preserves acquisition and
transformation evidence without committing unrelated source archives.

The runtime format is Ogg Vorbis by default. An MP3 fallback is added only if the
browser compatibility matrix demonstrates that it is necessary. Audio is
trimmed, normalized conservatively, and encoded for the target 15–25 MB budget.

## Failure handling

- The menu becomes usable before music finishes loading.
- Missing optional files produce warnings and use a procedural fallback or
  silence for nonessential ambience.
- A failed music layer is removed from the mix without desynchronizing others.
- Context creation or resume failure leaves the game playable and retries on a
  later user gesture.
- Voice limits discard the least important or oldest cosmetic voice first;
  critical player feedback is never displaced by ambience.
- Tab hiding suspends or silences expensive continuous work and resynchronizes
  music cleanly on return.

## Testing

Automated tests cover:

- Typed event-to-cue mapping.
- Saved volume parsing, clamping, defaults, and mute restoration.
- Variant selection bounds and deterministic tests through injected randomness.
- Per-cue cooldowns and concurrency limits.
- Music-state transitions from phase, pressure, and health inputs.
- Smooth gain targets for crossfades, stingers, and ducking.
- Missing-file fallback behavior.
- Context resume and visibility state handling through narrow browser adapters.
- Manifest coverage and audio provenance ledger validation.

Manual verification covers desktop and mobile Chrome/Safari, headphones and
speakers, keyboard/touch/gamepad startup gestures, rapid-fire and explosion
stress, tab suspension/resume, master mute, independent sliders, and every music
transition. Acceptance requires no audible clipping, stuck loops, harsh seams,
late cues, gameplay-blocking load, or loss of critical feedback under voice
pressure.

## Acceptance criteria

The upgrade is complete when:

1. Every listed gameplay event has a distinct cinematic cue or documented
   procedural fallback.
2. Menu, low combat, high combat, low-health, wave-clear, and game-over music
   behavior transitions smoothly and predictably.
3. Music and SFX levels are independently controllable and persist across reloads.
4. All shipped assets have verified compatible licenses and complete provenance.
5. Initial interaction is not blocked by music downloads or autoplay policy.
6. Automated and manual audio checks pass within the 15–25 MB target.
