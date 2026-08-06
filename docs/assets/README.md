# Painted graphics asset workflow

Sea Bomber ships original entity atlases and a small set of transformed scenery
swatches. External source material is approved for environmental adaptation
only; it must not be used for players, enemies, vehicles, weapons, or
projectiles. Original moving-art prompts, runtime keys, dimensions, and hashes
are retained in
[`original-art-provenance.md`](original-art-provenance.md).

## Provenance ledger

Every transformed external output is recorded in
[`painted-scenery-sources.json`](painted-scenery-sources.json). The top-level
`license` field points to the retained permitted-use record. Each `outputs`
entry contains:

- `output`: repository path of the shipped derivative;
- `pack`: exact source-pack archive name;
- `source`: exact path inside that pack;
- `transform`: enough detail to identify what was retained, repainted, and
  deliberately omitted.

Keep one entry per output and use repository-relative forward-slash paths. The
ledger, output, and license record must be reviewed together.

## Approved source packs

Only these locally licensed PVGames packs are currently approved:

- `Doomsday Tiles MilitaryBase.zip`
- `Doomsday Tiles Rural.zip`

Both approved archives contain the same byte-identical `Read Me.docx`. Its
complete text and hash are retained in
[`PVGAMES-LICENSE.txt`](PVGAMES-LICENSE.txt). Approval is limited to the terms
and project policy recorded there; a similarly named pack is not automatically
approved.

`Other Worlds Sands Tiles.zip` contains no license/readme in the available
archive. It is therefore excluded from the shipped provenance ledger. The
former Sands-derived `desert-stone.png` was replaced with original,
project-generated art; the reason is recorded in
[`painted-scenery-sources.json`](painted-scenery-sources.json).

## Source and transformation rules

- Never commit a source archive, extracted source tree, or redistributable raw
  object. `*.zip`, `*.rar`, and `assets-source/` are ignored; source material
  stays outside the shipped repository.
- Commit only the finished derivative needed at runtime. The current approved
  external outputs are repainted seamless 256×256 material swatches with no
  complete source building retained.
- Transform source material substantially for Sea Bomber's painted palette and
  intended terrain/scenery use. Cropping or renaming an intact source object is
  not sufficient.
- Record the exact source and transformation before review. Validate output
  dimensions, transparency where applicable, visual seams, and any atlas frame
  bounds.
- Load artwork through the typed manifest in `src/render/assets.ts`. Player,
  enemy, vehicle, and weapon art is critical and fails boot visibly when
  missing; scenery is optional and must degrade to procedural terrain without
  hiding gameplay.

## Adding optional scenery

1. Confirm the source pack is in the approved list and the intended use is
   allowed by the retained license record.
2. Work from an untracked local source location and repaint the material into a
   game-specific, seamless output. Do not copy a complete source object.
3. Save only the final optimized image under
   `public/assets/graphics/scenery/`.
4. Add its provenance entry to `painted-scenery-sources.json`.
5. Add a typed `scenery` key and URL to `GRAPHICS_MANIFEST`; keep loading
   optional so failure records a warning and procedural scenery remains usable.
6. Add manifest/fallback coverage, inspect the result in every biome and quality
   tier where it appears, then run the full automated and archive gates in the
   painted-graphics playtest document.

## Audio workflow

Audio provenance is independent from the painted-graphics ledger. Every shipped
Ogg is mapped to an approved source in
[`audio-sources.json`](audio-sources.json), with human-readable acknowledgement
in [`AUDIO-CREDITS.md`](AUDIO-CREDITS.md).

- Prefer CC0; CC-BY requires a stable creator, source page, and complete credit.
- Reject non-commercial, unclear, ripped, or standalone-redistribution-restricted
  material for this web repository.
- Keep archives and lossless working files under ignored `assets-source/audio/`.
- Adaptive stems must come from one compatible family and share exact loop
  timing. Do not layer unrelated tracks.
- Preserve dynamics and procedural fallbacks; a missing asset must never block
  gameplay.
- Run `npm run audio:validate`, the full test suite, and a browser audition
  before release.
