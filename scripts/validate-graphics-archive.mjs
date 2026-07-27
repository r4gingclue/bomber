import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tracked = execFileSync('git', ['ls-files'], {
  cwd: root,
  encoding: 'utf8',
}).trim().split('\n').filter(file => file && existsSync(resolve(root, file)));
const errors = [];

for (const file of tracked) {
  if (/\.(?:zip|rar)$/i.test(file)) errors.push(`Source archive is tracked: ${file}`);
  if (file.startsWith('.superpowers/')) errors.push(`Scratch SDD file is tracked: ${file}`);
  if (file === 'public/assets/graphics/.gitkeep') errors.push('Unnecessary production .gitkeep is tracked');
  if (/public\/assets\/graphics\/.*(?:chroma|transparent|source)/i.test(file)) {
    errors.push(`Intermediate art source is tracked in the runtime tree: ${file}`);
  }
}

const pngExpectations = {
  'public/assets/graphics/player-heli.png': [960, 96, 50_000],
  'public/assets/graphics/enemies.png': [1304, 144, 100_000],
  'public/assets/graphics/vehicles.png': [936, 144, 90_000],
  'public/assets/graphics/weapons.png': [976, 176, 50_000],
  'public/assets/graphics/scenery/military-concrete.png': [256, 256, 20_000],
  'public/assets/graphics/scenery/rural-wall.png': [256, 256, 20_000],
  'public/assets/graphics/scenery/desert-stone.png': [256, 256, 15_000],
};

function pngInfo(file) {
  const bytes = readFileSync(resolve(root, file));
  const signature = '89504e470d0a1a0a';
  if (bytes.subarray(0, 8).toString('hex') !== signature) {
    throw new Error(`${file} is not a PNG`);
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

for (const [file, [width, height, minimumBytes]] of Object.entries(pngExpectations)) {
  if (!tracked.includes(file)) {
    errors.push(`Required runtime asset is not tracked: ${file}`);
    continue;
  }
  try {
    const info = pngInfo(file);
    if (info.width !== width || info.height !== height) {
      errors.push(`${file} is ${info.width}x${info.height}; expected ${width}x${height}`);
    }
    if (info.bitDepth !== 8 || info.colorType !== 6) {
      errors.push(`${file} must be 8-bit RGBA; PNG bitDepth=${info.bitDepth}, colorType=${info.colorType}`);
    }
    if (statSync(resolve(root, file)).size < minimumBytes) {
      errors.push(`${file} is unexpectedly small for the approved painted asset`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

const expectedHashes = {
  'public/assets/graphics/player-heli.png': 'a07e2ef1240118101c56e639a0734b87f693c9d697c4cbc250a326949a29d0e3',
  'public/assets/graphics/enemies.png': 'f0a3afc920cecb49c34bd727322a93344c038c307c5969bc26c7ec87b382334f',
  'public/assets/graphics/vehicles.png': 'c84297f7ac1f23f0e7238926803b0ecf56a42a849bc0f041d76e6c1d9c2580a4',
  'public/assets/graphics/weapons.png': 'a70c19e3f47b1fd4bae769f1b030123408eaf1598c483029b1e01298af78350b',
  'public/assets/graphics/scenery/desert-stone.png': '2c20c455fc1a728c58ccb52616704784029720a674d116c4acddc73f973d9e31',
};
for (const [file, expected] of Object.entries(expectedHashes)) {
  const actual = createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
  if (actual !== expected) errors.push(`${file} hash differs from original-art provenance`);
}

const provenance = JSON.parse(readFileSync(
  resolve(root, 'docs/assets/painted-scenery-sources.json'),
  'utf8',
));
if (provenance.outputs.some(output => output.pack.includes('Sands'))) {
  errors.push('Sands-derived output remains in the shipped external provenance ledger');
}
if (!provenance.excludedPacks?.some(entry => entry.pack === 'Other Worlds Sands Tiles.zip')) {
  errors.push('Sands license exclusion is not recorded');
}
const license = readFileSync(resolve(root, 'docs/assets/PVGAMES-LICENSE.txt'), 'utf8');
if (
  !license.includes('--- BEGIN COMPLETE PVGAMES README TEXT ---')
  || !license.includes('--- END COMPLETE PVGAMES README TEXT ---')
  || !license.includes('0761d7b0e9ec06fa8b010de7a7f063233dd5a60668174b0e293100fb9bb94061')
) {
  errors.push('Complete PVGames README text or source hash is not retained');
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  `Validated ${Object.keys(pngExpectations).length} runtime PNGs, provenance, license, and ${tracked.length} tracked archive entries`,
);
