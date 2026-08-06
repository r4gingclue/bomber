# Original moving-unit art provenance

All player, enemy, vehicle, and weapon imagery shipped by Sea Bomber is
original project artwork. No PVGames image, legacy JAR image, or artwork from
another game was supplied to the moving-unit generation process. The existing
original `player-heli.png` was used only as a lighting, finish, and readability
reference for the three new source sheets.

The enemy, vehicle, and weapon sources were generated on 2026-07-27 with the
OpenAI built-in image-generation tool. Each source used a flat `#ff00ff`
background. The installed image-generation skill's chroma-removal helper was
then run with soft matte, despill, and one-pixel edge contraction. Subjects
were segmented by alpha gaps and downsampled with Lanczos filtering into the
runtime atlases. Chroma source sheets and intermediate cutouts are build
working files and are not shipped.

## Runtime outputs

| Output | Dimensions | SHA-256 | Runtime keys |
| --- | ---: | --- | --- |
| `public/assets/graphics/player-heli.png` | 960×96 RGBA | `a07e2ef1240118101c56e639a0734b87f693c9d697c4cbc250a326949a29d0e3` | five player poses |
| `public/assets/graphics/enemies.png` | 1304×144 RGBA | `f0a3afc920cecb49c34bd727322a93344c038c307c5969bc26c7ec87b382334f` | `scout`, `gunship`, `mchopper`, `patrol`, `hunter`, `missile` |
| `public/assets/graphics/vehicles.png` | 936×144 RGBA | `c84297f7ac1f23f0e7238926803b0ecf56a42a849bc0f041d76e6c1d9c2580a4` | `tank`, `aagun`, `gunboat`, `mine` |
| `public/assets/graphics/weapons.png` | 976×176 RGBA | `a70c19e3f47b1fd4bae769f1b030123408eaf1598c483029b1e01298af78350b` | `bullet`, `shot`, `flak`, `torpedo`, `sam`, `pmissile`, `charge` |

## Exact generation prompts

### Enemies

```text
Use case: stylized-concept
Asset type: production source sheet for a 2D side-view military arcade game's enemy-unit atlas
Input images: Image 1 is a style reference only—the existing original player-helicopter atlas. Match its painted realism, dimensional lighting, crisp antialiased silhouette, material detail, and gameplay readability; do not copy or modify its aircraft design.
Primary request: create exactly six distinct original enemy units, arranged in one clean horizontal row with generous equal spacing, in this exact left-to-right order: (1) very small agile scout helicopter/drone, (2) broad armored attack gunship helicopter with prominent chin cannon, (3) heavy missile helicopter with clearly visible side pods and heavier tail/body, (4) compact yellow patrol submarine, (5) aggressive orange hunter submarine, (6) heavy violet missile submarine with launch housing.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Style/medium: original high-detail hand-painted military arcade sprites, smooth dimensional forms, restrained realistic wear, coherent with the supplied player atlas; not pixel art, not flat vector icons, not photorealistic photography.
Composition/framing: strict orthographic side view; every unit's nose/forward direction points right; every full silhouette is visible with generous padding; equal baseline and no overlap; no perspective tilt; no labels or dividers.
Lighting/mood: consistent warm upper-left highlight, cool lower-right core shadow, subtle rim light; clear silhouette at 40–100 rendered pixels.
Color palette: helicopters use distinct olive/charcoal/slate palettes with role accents; submarines retain readable yellow/orange/violet role palettes without neon glow.
Constraints: exactly six units and no extra objects; opaque unit silhouettes with crisp edges; no rotor-motion transparency beyond a short solid rotor bar; no cast/contact shadows; no text; no logos; no watermark; do not use #ff00ff anywhere in the units. This is original art; avoid resemblance to identifiable copyrighted game sprites or real manufacturer markings.
```

### Vehicles

```text
Use case: stylized-concept
Asset type: production source sheet for a 2D side-view military arcade game's vehicle atlas
Input images: Image 1 is a style reference only—the existing original player-helicopter atlas. Match its painted realism, dimensional lighting, crisp antialiased silhouette, material detail, and gameplay readability; do not copy or modify its aircraft design.
Primary request: create exactly four distinct original units, arranged in one clean horizontal row with generous equal spacing, in this exact left-to-right order: (1) low olive tracked battle tank with readable turret and right-pointing cannon, (2) compact charcoal mobile anti-air gun with twin elevated barrels pointing right/up and a stable ground base, (3) slate-gray military gunboat in strict side view with hull, small bridge, and a right-pointing deck cannon, (4) dark naval contact mine, circular with eight short blunt spikes and one small red indicator lens.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Style/medium: original high-detail hand-painted military arcade sprites, smooth dimensional forms, restrained realistic wear, coherent with the supplied player atlas; not pixel art, not flat vector icons, not photorealistic photography.
Composition/framing: strict orthographic side view for tank, AA gun, and gunboat; tank/gunboat forward direction points right; mine faces camera as a readable symmetric silhouette; every full silhouette visible with generous padding; equal baseline and no overlap; no perspective tilt; no labels or dividers.
Lighting/mood: consistent warm upper-left highlight, cool lower-right core shadow, subtle rim light; clear silhouettes at 30–90 rendered pixels.
Constraints: exactly four units and no extra objects; opaque unit silhouettes with crisp edges; no cast/contact shadows, water, wakes, terrain, smoke, muzzle flash, or scenery; no text; no logos; no watermark; do not use #ff00ff anywhere in the units. This is original art; avoid resemblance to identifiable copyrighted game sprites or real manufacturer markings.
```

### Weapons

```text
Use case: stylized-concept
Asset type: production source sheet for a 2D side-view military arcade game's weapon atlas
Input images: Image 1 is a style reference only—the existing original player-helicopter atlas. Match its painted realism, dimensional lighting, crisp antialiased silhouette, material detail, and gameplay readability; do not copy or modify its aircraft design.
Primary request: create exactly seven distinct original weapon/projectile sprites, arranged in one clean horizontal row with generous equal spacing, in this exact left-to-right order: (1) compact golden autocannon bullet/tracer projectile pointing right, (2) larger warm-orange enemy cannon shell pointing right, (3) dark steel flak shell with copper band pointing right, (4) slim silver-blue torpedo with small fins and propulsor pointing right, (5) narrow surface-to-air missile shown side-on and pointing straight upward, (6) sleek pale-blue player homing missile pointing right, (7) short dark cylindrical depth charge shown vertically with metal end caps.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Style/medium: original high-detail hand-painted military arcade sprites, smooth dimensional forms, restrained realistic wear, coherent with the supplied player atlas; not pixel art, not flat vector icons, not photorealistic photography.
Composition/framing: strict orthographic side view; each object isolated, fully visible, generously padded, equal visual scale, no overlap, no labels or dividers. Preserve the explicit orientations: five horizontal right-pointing objects, one upward missile, one vertical depth charge.
Lighting/mood: consistent warm upper-left highlight, cool lower-right core shadow, subtle rim light; exaggerated readable value separation for display at 8–24 rendered pixels.
Constraints: exactly seven objects and no extra objects; opaque silhouettes with crisp edges; no exhaust, trails, fire, glow bloom, shadows, scenery, or explosions; no text; no logos; no watermark; do not use #ff00ff anywhere in the objects. This is original art; avoid resemblance to identifiable copyrighted game sprites or real manufacturer markings.
```

## Original inland texture

`public/assets/graphics/scenery/desert-stone.png` is now original
project-generated art, not a Sands derivative. It is a deterministic,
edge-wrapped 256×256 RGBA painted stone/noise texture with SHA-256
`2c20c455fc1a728c58ccb52616704784029720a674d116c4acddc73f973d9e31`.
It was inspected at 100% and tiled 3×3 with no edge seam.
