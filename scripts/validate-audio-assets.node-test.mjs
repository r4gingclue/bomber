import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateAudioLedger } from './validate-audio-assets.mjs';

async function fixture(license = 'CC0-1.0') {
  const root = await mkdtemp(join(tmpdir(), 'sea-bomber-audio-'));
  const audioRoot = join(root, 'public/assets/audio');
  await mkdir(join(audioRoot, 'sfx'), { recursive: true });
  await writeFile(join(audioRoot, 'sfx/ping.ogg'), 'OggS');
  return {
    root,
    audioRoot,
    ledger: {
      licenseAllowlist: ['CC0-1.0'],
      sources: { ping: { license } },
      outputs: [{ path: 'sfx/ping.ogg', source: 'ping' }],
    },
  };
}

test('rejects a source outside the project license allowlist', async () => {
  const input = await fixture('CC-BY-NC-4.0');
  assert.throws(() => validateAudioLedger(input.ledger, input.audioRoot), /unapproved license/);
});

test('rejects a ledger output that is absent from disk', async () => {
  const input = await fixture();
  input.ledger.outputs[0].path = 'sfx/missing.ogg';
  assert.throws(() => validateAudioLedger(input.ledger, input.audioRoot), /missing output/);
});
