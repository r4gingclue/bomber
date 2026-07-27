# Painted graphics release playtest

Status: **HOST AND EMULATED GATES PASS — PHYSICAL DEVICE CHECKS PENDING**

Date: 2026-07-27

Branch: `codex/painted-graphics`

Browser: Codex In-app Browser

Builds exercised: Vite development server with the checked-in graphics harness,
and a separate production build served by `vite preview`.

This record deliberately separates host-browser evidence from physical-device
evidence. The development-only harness makes scene, pose, quality-tier, DPR,
safe-area, screenshot, and timing fixtures reproducible. A separate production
preview confirms that harness query parameters and APIs are absent from the
shipping bundle. DPR and safe-area checks below are browser emulations; they are
not substitutes for real-device touch, browser chrome, thermals, or lifecycle
testing.

## Host-browser viewport and DPR matrix

- [x] Desktop 1920×1080 at DPR 1: game CSS 1920×1080; UI backing
  1920×1080.
- [x] Tablet landscape 1024×768 at emulated DPR 2: game CSS 1024×576 at
  y=96; UI backing 2048×1536. HUD and controls occupy the letterbox regions.
- [x] Landscape phone 844×390 at emulated DPR 3 with 47 px left/right
  safe-area insets: game CSS 693.328×390 at x=75.328; UI backing 2532×1170.
  Compact controls remain inside the safe region without covering the central
  play corridor.
- [x] Portrait phone 390×844 at emulated DPR 3 with 47 px top and 34 px bottom
  safe-area insets: game CSS 390×219.375 at y=318.8125; UI backing 1170×2532.
  HUD and controls remain in the letterbox regions.
- [x] Live landscape → portrait → landscape resizing preserved the full 16:9
  battlefield and recomputed the controls, safe areas, and backing stores.

The listed backing-store sizes were read from the live development harness. The
production preview ignored `dpr=3`, rendered at the browser's actual DPR 1, and
exposed none of the harness-ready, snapshot, capture, or recording surfaces.

## Scene and art coverage

- [x] Live sea, coast, and inland fixtures show the terrain, scenery, grading,
  atmosphere, reflections, water, shadows, and gameplay silhouettes.
- [x] The player poses `level`, `accelerate`, `brake`, `climb`, and `descend`
  were each inspected live. The fixture matrix exercises both facings, while
  atlas tests verify every pose/facing frame is in bounds and visibly opaque.
- [x] Original painted moving-unit atlases render without clipping for every
  enemy type: `patrol`, `hunter`, `missile`, `gunboat`, `mine`, `scout`,
  `gunship`, `mchopper`, `aagun`, and `tank`.
- [x] Every projectile remains legible: `bullet`, `shot`, `flak`, `torpedo`,
  `sam`, `pmissile`, and `charge`.
- [x] Layered explosions, trails, shadows, hit flashes, damage smoke, debris,
  and particles retain clear feedback.
- [x] The coast fixture simultaneously shows a blue-white water plume and an
  ochre land blast, proving that impact art follows the actual terrain under
  each impact rather than the firing entity.
- [x] `full`, `reduced`, and `minimum` tiers retain all moving units,
  projectiles, aiming cues, terrain, hit feedback, and HUD. Minimum mode reduces
  water detail, cloud density, shadows, and decorative animation as designed.
- [x] Reduced-flash mode replaces the filled damage flash with a short border
  pulse that still communicates a hit.

## Input, lifecycle, and production-boundary coverage

- [x] Unit tests exercise mouse mapping, keyboard input, touch hit targets,
  safe-area controls, resize/orientation transforms, blur/visibility reset, and
  loop restart timing.
- [x] Live host-browser resizing and orientation emulation preserved the full
  field and control placement at the viewport shapes above.
- [x] A production-preview smoke test loaded with all development harness query
  parameters present. The production build ignored them, displayed the normal
  menu, started normal gameplay on Enter, and emitted no browser warning or
  error.
- [x] Development screenshots are reproducible live-canvas exports from the
  checked-in `src/testing/graphics-harness.ts`; they are not hand-composited
  mockups.

## Ten-minute heavy-combat timing gate

- [x] A fresh uninterrupted capture ran for 600,000.7 ms and retained 71,988
  delivered-frame samples in the
  [tracked raw CSV](painted-graphics-artifacts/heavy-combat-samples.csv).
- [x] Delivered-frame time was 8.335053 ms mean and 8.5 ms p95, below the
  34 ms gate. Draw duration was 0.394289 ms mean and 0.5 ms p95.
- [x] All 21 timing windows remained at `full`, with no tier transition. The
  browser emitted no warning or error.
- [x] The
  [derived summary](painted-graphics-artifacts/heavy-combat-summary.json)
  records the raw-file SHA-256, separate delivered/render distributions,
  methodology, production boundary, and environment limitations.
- [x] `npm run validate:heavy-combat` independently re-parses the CSV,
  recomputes the summary, enforces the ten-minute duration and playable p95
  threshold, and rejects stale or malformed timing schemas.

The capture measures browser-delivered frame intervals, so quality pressure
includes simulation, drawing, scheduling, and display delivery. Physical-device
thermals and JavaScript heap telemetry are unavailable in this browser.

## Screenshot evidence

The release record retains one live PNG for each biome at desktop,
landscape-phone, and portrait-phone shape. Together the fixtures vary player
pose, facing, and quality tier.

| Biome | Desktop 1920×1080 DPR 1 | Landscape 844×390 DPR 3 | Portrait 390×844 DPR 3 |
| --- | --- | --- | --- |
| Sea | [`sea-desktop`](painted-graphics-artifacts/sea-desktop-1920x1080-dpr1.png) | [`sea-landscape`](painted-graphics-artifacts/sea-landscape-844x390-dpr3.png) | [`sea-portrait`](painted-graphics-artifacts/sea-portrait-390x844-dpr3.png) |
| Coast | [`coast-desktop`](painted-graphics-artifacts/coast-desktop-1920x1080-dpr1.png) | [`coast-landscape`](painted-graphics-artifacts/coast-landscape-844x390-dpr3.png) | [`coast-portrait`](painted-graphics-artifacts/coast-portrait-390x844-dpr3.png) |
| Inland | [`inland-desktop`](painted-graphics-artifacts/inland-desktop-1920x1080-dpr1.png) | [`inland-landscape`](painted-graphics-artifacts/inland-landscape-844x390-dpr3.png) | [`inland-portrait`](painted-graphics-artifacts/inland-portrait-390x844-dpr3.png) |

The nine files are true RGBA PNGs, and their pixel dimensions match their
filenames.

## Automated gates

- [x] `npm run typecheck`
- [x] `npm test` — 24 files / 187 tests passed.
- [x] `npm run build` — 30 modules transformed.
- [x] `npm run validate:graphics-archive`
- [x] `npm run validate:docs-links`
- [x] `npm run validate:heavy-combat` — 71,988 samples over 600,000.7 ms;
  delivered p95 8.5 ms, render p95 0.5 ms, 21 windows, zero tier transitions.
- [x] `git diff --check`
- [x] No tracked `.zip` or `.rar` source archive.

## Physical-device checks still pending

- [ ] Desktop browser at native DPR, including pointer aim at battlefield edges
  and browser fullscreen enter/exit.
- [ ] Tablet hardware in landscape at native DPR, including multi-touch
  movement, aim/fire, and drop controls.
- [ ] Notched landscape phone hardware, including OS safe-area values,
  multi-touch, browser chrome expansion/collapse, and control reach.
- [ ] Portrait phone hardware and live rotation in both directions.
- [ ] Real tab/background hide and resume on mobile and desktop browsers.
- [ ] Ten-minute heavy-combat run on target hardware, including thermal,
  battery, memory, and sustained-tier observation.

## Result

The complete host-browser, emulated-viewport, automated, artifact, archive,
timing, and production-boundary gates pass. No host-observed gameplay object was
hidden, no field was cropped, and the heavy fixture remained comfortably
playable. Final physical-device confidence remains explicitly pending; this
record does not claim those checks were completed.
