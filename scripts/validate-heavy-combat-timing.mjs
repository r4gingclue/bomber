import { deepStrictEqual } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = resolve(root, 'docs/testing/painted-graphics-artifacts');
const rawPath = resolve(artifactDir, 'heavy-combat-samples.csv');
const summaryPath = resolve(artifactDir, 'heavy-combat-summary.json');
const windowDurationMs = 30_000;
const validTiers = new Set(['full', 'reduced', 'minimum']);
const round = (value, digits = 6) => Number(value.toFixed(digits));

function parseRaw(raw) {
  const lines = raw.trimEnd().split('\n');
  if (lines.shift() !== 'timestampMs,elapsedMs,renderMs,tier') {
    throw new Error('Unexpected heavy-combat CSV header');
  }
  if (lines.length === 0) throw new Error('Heavy-combat CSV has no samples');

  let previousTimestamp = -Infinity;
  let previousElapsed = -Infinity;
  let captureEpoch = null;
  return lines.map((line, index) => {
    const fields = line.split(',');
    if (fields.length !== 4) throw new Error(`Malformed CSV row ${index + 2}`);
    const timestampMs = Number(fields[0]);
    const elapsedMs = Number(fields[1]);
    const renderMs = Number(fields[2]);
    const tier = fields[3];
    if (![timestampMs, elapsedMs, renderMs].every(Number.isFinite)) {
      throw new Error(`Non-finite number in CSV row ${index + 2}`);
    }
    if (timestampMs <= previousTimestamp || elapsedMs <= previousElapsed) {
      throw new Error(`Non-monotonic timestamp in CSV row ${index + 2}`);
    }
    if (elapsedMs < 0 || renderMs < 0) {
      throw new Error(`Negative duration in CSV row ${index + 2}`);
    }
    if (!validTiers.has(tier)) throw new Error(`Invalid tier in CSV row ${index + 2}`);
    const rowCaptureEpoch = timestampMs - elapsedMs;
    if (captureEpoch === null) captureEpoch = rowCaptureEpoch;
    if (Math.abs(rowCaptureEpoch - captureEpoch) > 0.001) {
      throw new Error(`Timestamp/elapsed mismatch in CSV row ${index + 2}`);
    }
    previousTimestamp = timestampMs;
    previousElapsed = elapsedMs;
    return { timestampMs, elapsedMs, renderMs, tier };
  });
}

function tierHistory(rows) {
  const segments = [];
  const transitions = [];
  let start = 0;
  for (let i = 1; i <= rows.length; i++) {
    if (i === rows.length || rows[i].tier !== rows[start].tier) {
      segments.push({
        tier: rows[start].tier,
        firstSample: start + 1,
        lastSample: i,
        firstElapsedMs: round(rows[start].elapsedMs, 3),
        lastElapsedMs: round(rows[i - 1].elapsedMs, 3),
      });
      if (i < rows.length) {
        transitions.push({
          sample: i + 1,
          elapsedMs: round(rows[i].elapsedMs, 3),
          from: rows[i - 1].tier,
          to: rows[i].tier,
        });
        start = i;
      }
    }
  }
  return { segments, transitions };
}

function summarizeWindows(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const index = Math.floor(row.elapsedMs / windowDurationMs);
    if (!buckets.has(index)) buckets.set(index, []);
    buckets.get(index).push(row);
  }
  return [...buckets.entries()].map(([index, samples]) => {
    const renderValues = samples.map(sample => sample.renderMs);
    return {
      window: index + 1,
      rangeStartMs: index * windowDurationMs,
      rangeEndMs: (index + 1) * windowDurationMs,
      firstElapsedMs: round(samples[0].elapsedMs, 3),
      lastElapsedMs: round(samples.at(-1).elapsedMs, 3),
      sampleCount: samples.length,
      renderDurationMs: {
        minimum: round(Math.min(...renderValues)),
        maximum: round(Math.max(...renderValues)),
        mean: round(renderValues.reduce((sum, value) => sum + value, 0) / samples.length),
      },
      tiers: [...new Set(samples.map(sample => sample.tier))],
    };
  });
}

function buildSummary(raw, rows) {
  const first = rows[0];
  const last = rows.at(-1);
  if (last.elapsedMs < 600_000) {
    throw new Error(`Heavy-combat capture is shorter than ten minutes: ${last.elapsedMs} ms`);
  }
  const renderValues = rows.map(row => row.renderMs);
  const captureStartEpochMs = first.timestampMs - first.elapsedMs;
  const history = tierHistory(rows);
  const windows = summarizeWindows(rows);
  return {
    schemaVersion: 2,
    recordedOn: new Date(captureStartEpochMs).toISOString().slice(0, 10),
    sourceBaselineCommit: '70d325f334b417f7ada9db866f8a23b3e4bdaa61',
    rawFile: 'heavy-combat-samples.csv',
    rawSha256: createHash('sha256').update(raw).digest('hex'),
    rawBytes: Buffer.byteLength(raw),
    run: {
      startedAt: new Date(captureStartEpochMs).toISOString(),
      endedAt: new Date(last.timestampMs).toISOString(),
      durationMs: round(last.elapsedMs, 3),
      sampleCount: rows.length,
      renderDurationMs: {
        minimum: round(Math.min(...renderValues)),
        maximum: round(Math.max(...renderValues)),
        mean: round(renderValues.reduce((sum, value) => sum + value, 0) / rows.length),
      },
      windowDurationMs,
      windowCount: windows.length,
      tierAtStart: first.tier,
      tierAtEnd: last.tier,
      tierTransitions: history.transitions,
    },
    methodology: {
      browser: 'Codex In-app Browser',
      viewportCssPixels: { width: 1920, height: 1080 },
      uiBackingPixels: { width: 3840, height: 2160 },
      devicePixelRatioOverride: 2,
      measurement: 'performance.now() immediately before and after Renderer.draw(); World.update() and all simulation work were outside the measured interval.',
      capture: 'Each row was appended after QualityMonitor.sample(renderMs), with the tier selected by that sample. The temporary export work was outside the measured interval.',
      scenario: 'A temporary production-build harness restaged a representative heavy-combat frame every 100 ms: 18 entities, 48 projectiles, 6 charges, 8 rings, and 120 particles.',
      simulation: 'The World.update implementation was unchanged. Temporary state restaging ran outside the measured render bracket.',
      windowing: 'Thirty-second buckets start at capture elapsed time zero. The final partial bucket contains the sample that crossed the ten-minute threshold.',
      cleanup: 'The capture/export and scenario harnesses were removed before the final production build and commit.',
      limitation: 'The browser did not expose JavaScript heap telemetry.',
    },
    tierHistory: history.segments,
    windows,
  };
}

const raw = readFileSync(rawPath, 'utf8');
const rows = parseRaw(raw);
const computed = buildSummary(raw, rows);

if (process.argv.includes('--write')) {
  writeFileSync(summaryPath, `${JSON.stringify(computed, null, 2)}\n`);
  console.log(`Wrote ${summaryPath}`);
} else {
  const retained = JSON.parse(readFileSync(summaryPath, 'utf8'));
  try {
    deepStrictEqual(retained, computed);
  } catch {
    console.error('heavy-combat-summary.json does not match heavy-combat-samples.csv');
    process.exit(1);
  }
}

console.log(
  `Validated ${computed.run.sampleCount} samples over ${computed.run.durationMs} ms: `
  + `min ${computed.run.renderDurationMs.minimum} ms, `
  + `max ${computed.run.renderDurationMs.maximum} ms, `
  + `mean ${computed.run.renderDurationMs.mean} ms, `
  + `${computed.run.windowCount} windows, `
  + `${computed.run.tierTransitions.length} tier transitions`,
);
