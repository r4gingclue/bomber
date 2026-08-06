import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_BYTES = 15_000_000;
const MAX_BYTES = 25_000_000;

export function validateAudioLedger(ledger, audioRoot, options = {}) {
  const allowed = new Set(ledger.licenseAllowlist ?? []);
  for (const [id, source] of Object.entries(ledger.sources ?? {})) {
    if (!allowed.has(source.license)) {
      throw new Error(`Audio source ${id} has unapproved license: ${source.license}`);
    }
  }

  const expected = new Set();
  let total = 0;
  for (const output of ledger.outputs ?? []) {
    if (!ledger.sources?.[output.source]) throw new Error(`Audio output has unknown source: ${output.path}`);
    if (expected.has(output.path)) throw new Error(`Audio ledger has duplicate output: ${output.path}`);
    expected.add(output.path);
    const absolute = join(audioRoot, output.path);
    if (!existsSync(absolute)) throw new Error(`Audio ledger has missing output: ${output.path}`);
    const data = readFileSync(absolute);
    if (data.length < 4 || data.subarray(0, 4).toString('ascii') !== 'OggS') {
      throw new Error(`Audio output is not a nonempty Ogg file: ${output.path}`);
    }
    total += data.length;
  }

  for (const absolute of walkOgg(audioRoot)) {
    const path = relative(audioRoot, absolute);
    if (!expected.has(path)) throw new Error(`Audio file is absent from ledger: ${path}`);
  }

  if (options.enforceBudget && (total < MIN_BYTES || total > MAX_BYTES)) {
    throw new Error(`Audio total ${total} bytes is outside 15-25 MB budget`);
  }
  return { files: expected.size, bytes: total };
}

function walkOgg(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walkOgg(path) : entry.name.endsWith('.ogg') ? [path] : [];
  });
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const projectRoot = resolve(dirname(scriptPath), '..');
  const ledger = JSON.parse(readFileSync(join(projectRoot, 'docs/assets/audio-sources.json'), 'utf8'));
  const result = validateAudioLedger(ledger, join(projectRoot, 'public/assets/audio'), { enforceBudget: true });
  console.log(`Validated ${result.files} audio files (${result.bytes} bytes)`);
}
