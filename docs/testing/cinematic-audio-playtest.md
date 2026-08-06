# Cinematic audio playtest

## Automated gate

Last automated run: 2026-08-06.

- Audio ledger: 35 unique Ogg outputs, all mapped to CC0 sources.
- Compressed total: 15,549,423 bytes (within the 15–25 MB gate).
- Adaptive score: four 48 kHz stereo stems, each exactly 60 seconds on the
  shared 128 BPM / 4-beat / 32-bar timeline.
- Node ledger tests: pass.
- TypeScript typecheck: pass.
- Vitest: 270 tests pass across 37 files.
- Production build: pass.
- First-gesture browser smoke test: no console warnings or errors while loading
  audio.
- Missing-file behavior remains non-blocking through SoundBank warnings and
  procedural fallbacks.

## Manual acceptance matrix

Mark each row after listening. Use matched volume and test both a fresh profile
and persisted settings.

| Area | Desktop Chrome/Safari | Mobile Chrome/Safari | Acceptance |
| --- | --- | --- | --- |
| Keyboard/mouse first gesture | Pending | N/A | Menu remains usable; score starts without a late burst |
| Touch first gesture | Optional | Pending | No accidental run start while adjusting sliders |
| Gamepad first gesture | Pending | Optional | A/Start begins; B/X/Y operate menu audio |
| Menu → low combat → high combat | Pending | Pending | Smooth 1–3 s layering; no phase drift |
| Low health / wave clear / game over | Pending | Pending | Critical cues remain clear over music |
| Rapid cannon / explosions / SAM / sonar | Pending | Pending | No clipping, missing critical cue, or stuck voice |
| Headphones | Pending | Pending | Stable image; low end controlled |
| Laptop/phone speakers | Pending | Pending | Cannon, damage, and sonar remain distinct |
| Music/SFX sliders and mute | Pending | Pending | Independent, immediate, and persistent after reload |
| Tab hide/return and interruption | Pending | Pending | No harsh restart, doubled loop, or stuck ambience |
| Offline or missing file | Pending | Pending | Gameplay boots and procedural fallback remains audible |

## Focused listening notes

- Confirm the 60-second music boundary has no objectionable pulse or seam.
- Confirm rotor and ocean-wind ambience remain subtle and do not mask sonar.
- Compare player missile and enemy SAM launches; they should be distinguishable.
- Check underwater explosions on phone speakers for excessive low-frequency loss.
- Reject any cue that sounds synthetic, thin, or stylistically inconsistent with
  the military-cinematic target; record the event name and device before
  replacing it.
