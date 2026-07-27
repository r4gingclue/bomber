# Painted graphics release playtest

Status: **PASS WITH EMULATION NOTES**

Date: 2026-07-27

Branch: `codex/painted-graphics`

Browser: Codex In-app Browser

Build: production preview from `npm run build`

This is the Task 10 release record. A checked item means it was exercised in the
browser named above, not inferred from unit coverage. An item using an emulated
capability is labeled explicitly. Viewport tests use the listed CSS-pixel size
and an existing development-only DPR override; the measured backing-store
dimensions confirm the requested DPR. The release is rejected if any gameplay
object is obscured, aim is offset, the battlefield is cropped, or sustained
combat cannot hold its selected quality tier.

## Device and DPR matrix

- [x] Desktop 1920×1080 at DPR 1: game CSS 1920×1080; UI backing
  1920×1080.
- [x] Desktop 1366×768 at DPR 1: game CSS 1365×768 at x=1; UI backing
  1366×768.
- [x] Desktop 1366×768 at DPR 2: game CSS 1365×768 at x=1; UI backing
  2732×1536.
- [x] Tablet landscape 1024×768 at DPR 2: game CSS 1024×576 at y=96; UI
  backing 2048×1536.
- [x] Landscape phone 844×390 at DPR 3 with 47 px left/right safe-area insets:
  game CSS 693×390 at x=76; UI backing 2532×1170.
- [x] Portrait phone 390×844 at DPR 3 with full-field 16:9 letterboxing: game
  CSS 390×219 at y=313; UI backing 1170×2532.
- [x] In every shape/DPR profile, the 960×540 battlefield is fully visible,
  HUD/touch UI is sharp and unobscured, and backing-store dimensions match CSS
  size × DPR.

## Scene and art coverage

- [x] Sea scene: terrain, scenery, atmosphere, grading, water, shadows, and
  gameplay silhouettes are readable.
- [x] Coast scene: terrain, scenery, atmosphere, grading, water/land boundary,
  shadows, and gameplay silhouettes are readable.
- [x] Inland scene: terrain, scenery, atmosphere, grading, land effects,
  shadows, and gameplay silhouettes are readable.
- [x] Player poses `level`, `accelerate`, `brake`, `climb`, and `descend` render
  correctly facing both right and left.
- [x] Every enemy type renders and remains legible: `patrol`, `hunter`,
  `missile`, `gunboat`, `mine`, `scout`, `gunship`, `mchopper`, `aagun`, and
  `tank`.
- [x] Every projectile type renders and remains legible:
  `bullet`, `shot`, `flak`, `torpedo`, `sam`, `pmissile`, and `charge`.
- [x] Explosions, water impacts, land impacts, trails, shadows, hit flashes, and
  damage smoke retain clear gameplay feedback.

## Input and lifecycle coverage

- [x] Mouse aim aligns the turret and projectile path with the pointer at the
  left, center, and right of the fitted battlefield.
- [x] Keyboard movement/aim-and-fire controls remain aligned while moving in
  both directions and changing altitude.
- [x] Touch move, aim/fire, and drop hit targets align with the rendered
  controls at landscape-phone DPR 3. The browser cannot emit touch directly, so
  trusted harness keys dispatched `pointerType: touch` events through the real
  `Input` handlers at the rendered control coordinates.
- [x] Touch aim remains aligned after portrait orientation and letterboxing,
  using the same explicitly emulated touch-pointer path.
- [x] Resize between desktop sizes preserves the complete field and input
  alignment.
- [x] Orientation changes landscape → portrait → landscape preserve the
  complete field, safe controls, and input alignment.
- [x] Tab hide/resume pauses and resumes without a simulation jump, stale input,
  or render fault. The in-app browser cannot foreground an alternate tab, so a
  temporary harness invoked the same `Loop.stop()` / `Loop.start()` lifecycle;
  the harness was removed before the production build.
- [x] Fullscreen-sized enter/exit preserves the complete field and input
  alignment through live 1366×768 → 1920×1080 → 1366×768 resize events. Direct
  Fullscreen API entry was denied by the in-app browser's permission boundary,
  so browser-chrome fullscreen itself remains an environment limitation.

## Quality and accessibility coverage

- [x] `full` tier retains the full particles, debris, haze, reflections,
  scenery, shadows, grading, and local feedback.
- [x] `reduced` tier trims its documented effects while retaining all gameplay
  objects, aiming cues, projectiles, hit feedback, terrain, and HUD.
- [x] `minimum` tier trims its documented effects while retaining all gameplay
  objects, aiming cues, projectiles, hit feedback, terrain, and HUD.
- [x] Sustained slow render samples step down one tier per pressure window;
  sustained fast render samples recover one tier per hysteresis window. A
  temporary render-only pressure probe produced `full → reduced → minimum` at
  25.2–25.3 ms and `minimum → reduced → full` at 0.3–0.6 ms; it was removed
  before the production build.
- [x] Reduced-flash behavior replaces the full-screen damage flash with a short
  border pulse that still communicates a hit.
- [x] Ten-minute heavy-combat observation completes with no console error,
  obscured object, cropped field, runaway memory growth, or failure to hold the
  automatically selected target tier. The fresh run lasted 600,004.9 ms and
  retained all 72,001 frame samples in a
  [tracked raw CSV](painted-graphics-artifacts/heavy-combat-samples.csv). Render
  duration was 0.267016 ms mean, 0.1 ms minimum, and 1.0 ms maximum; every
  sample reported `full`, with no tier transition. The
  [derived summary](painted-graphics-artifacts/heavy-combat-summary.json)
  contains twenty complete 30-second windows plus the final threshold-crossing
  sample, tier history, and source methodology. `npm run
  validate:heavy-combat` recomputes the summary and fails on any mismatch. The
  browser produced no warning or error and exposed no heap telemetry; no
  increasing render time, fault, hang, or other observable runaway-memory
  symptom appeared.

## Screenshot evidence

The release record retains one PNG for each biome at desktop, landscape-phone,
and portrait-phone shape.

| Biome | Desktop 1920×1080 DPR 1 | Landscape 844×390 DPR 3 | Portrait 390×844 DPR 3 |
| --- | --- | --- | --- |
| Sea | [`sea-desktop`](painted-graphics-artifacts/sea-desktop-1920x1080-dpr1.png) | [`sea-landscape`](painted-graphics-artifacts/sea-landscape-844x390-dpr3.png) | [`sea-portrait`](painted-graphics-artifacts/sea-portrait-390x844-dpr3.png) |
| Coast | [`coast-desktop`](painted-graphics-artifacts/coast-desktop-1920x1080-dpr1.png) | [`coast-landscape`](painted-graphics-artifacts/coast-landscape-844x390-dpr3.png) | [`coast-portrait`](painted-graphics-artifacts/coast-portrait-390x844-dpr3.png) |
| Inland | [`inland-desktop`](painted-graphics-artifacts/inland-desktop-1920x1080-dpr1.png) | [`inland-landscape`](painted-graphics-artifacts/inland-landscape-844x390-dpr3.png) | [`inland-portrait`](painted-graphics-artifacts/inland-portrait-390x844-dpr3.png) |

The tracked artifact directory contains the nine required representative PNGs,
the raw per-frame timing CSV, and its derived summary JSON. The PNG dimensions
match their names.

## Automated gates

- [x] `npm run typecheck`
- [x] `npx vitest run` — 23 files / 159 tests passed.
- [x] `npm run build` — 31 modules transformed; production preview ran for 30
  seconds with no warning or error.
- [x] `npm run validate:heavy-combat` — all 72,001 CSV samples reproduce the
  retained duration, render statistics, window summaries, and tier history.
- [x] Local documentation-link and artifact validation — every local Markdown
  link resolves to a tracked file.
- [x] `git diff --check`
- [x] `git ls-files | rg '\.(zip|rar)$' && exit 1 || true` (no tracked source
  archives)

## Result

Pass for the tested browser matrix. No gameplay object was hidden, no input was
offset, no battlefield was cropped, and sustained combat held the target tier.
Physical-device touch/DPR testing and native browser-chrome fullscreen remain
follow-up confidence checks because those capabilities were emulated or denied
by the available browser surface.
