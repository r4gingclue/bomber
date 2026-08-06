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
const minimumDurationMs = 600_000;
const maximumPlayableP95Ms = 34;
const validTiers = new Set(['full', 'reduced', 'minimum']);
const round = (value, digits = 6) => Number(value.toFixed(digits));

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function statistics(values) {
  return {
    minimum: round(Math.min(...values)),
    maximum: round(Math.max(...values)),
    mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    p95: round(percentile(values, 0.95)),
  };
}

function parseRaw(raw) {
  const lines = raw.trimEnd().split('\n');
  if (lines.shift() !== 'timestampMs,elapsedMs,deliveredFrameMs,renderMs,tier') {
    throw new Error('Unexpected heavy-combat CSV header');
  }
  if (lines.length === 0) throw new Error('Heavy-combat CSV has no samples');

  let previousTimestamp = -Infinity;
  let previousElapsed = -Infinity;
  let captureEpoch = null;
  return lines.map((line, index) => {
    const fields = line.split(',');
    if (fields.length !== 5) throw new Error(`Malformed CSV row ${index + 2}`);
    const timestampMs = Number(fields[0]);
    const elapsedMs = Number(fields[1]);
    const deliveredFrameMs = Number(fields[2]);
    const renderMs = Number(fields[3]);
    const tier = fields[4];
    if (![timestampMs, elapsedMs, deliveredFrameMs, renderMs].every(Number.isFinite)) {
      throw new Error(`Non-finite number in CSV row ${index + 2}`);
    }
    if (timestampMs <= previousTimestamp || elapsedMs <= previousElapsed) {
      throw new Error(`Non-monotonic timestamp in CSV row ${index + 2}`);
    }
    if (elapsedMs < 0 || deliveredFrameMs <= 0 || renderMs < 0) {
      throw new Error(`Invalid duration in CSV row ${index + 2}`);
    }
    if (!validTiers.has(tier)) throw new Error(`Invalid tier in CSV row ${index + 2}`);
    const rowCaptureEpoch = timestampMs - elapsedMs;
    if (captureEpoch === null) captureEpoch = rowCaptureEpoch;
    if (Math.abs(rowCaptureEpoch - captureEpoch) > 0.001) {
      throw new Error(`Timestamp/elapsed mismatch in CSV row ${index + 2}`);
    }
    previousTimestamp = timestampMs;
    previousElapsed = elapsedMs;
    return { timestampMs, elapsedMs, deliveredFrameMs, renderMs, tier };
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
  return [...buckets.entries()].map(([index, samples]) => ({
    window: index + 1,
    rangeStartMs: index * windowDurationMs,
    rangeEndMs: (index + 1) * windowDurationMs,
    firstElapsedMs: round(samples[0].elapsedMs, 3),
    lastElapsedMs: round(samples.at(-1).elapsedMs, 3),
    sampleCount: samples.length,
    deliveredFrameMs: statistics(samples.map(sample => sample.deliveredFrameMs)),
    renderDurationMs: statistics(samples.map(sample => sample.renderMs)),
    tiers: [...new Set(samples.map(sample => sample.tier))],
  }));
}

function buildSummary(raw, rows, sourceCommit) {
  const first = rows[0];
  const last = rows.at(-1);
  if (last.elapsedMs < minimumDurationMs) {
    throw new Error(`Heavy-combat capture is shorter than ten minutes: ${last.elapsedMs} ms`);
  }
  const deliveredValues = rows.map(row => row.deliveredFrameMs);
  const renderValues = rows.map(row => row.renderMs);
  const deliveredStats = statistics(deliveredValues);
  if (deliveredStats.p95 > maximumPlayableP95Ms) {
    throw new Error(
      `Heavy-combat delivered-frame p95 exceeds ${maximumPlayableP95Ms} ms: ${deliveredStats.p95} ms`,
    );
  }
  const captureStartEpochMs = first.timestampMs - first.elapsedMs;
  const history = tierHistory(rows);
  const windows = summarizeWindows(rows);
  return {
    schemaVersion: 3,
    recordedOn: new Date(captureStartEpochMs).toISOString().slice(0, 10),
    sourceBaselineCommit: sourceCommit,
    rawFile: 'heavy-combat-samples.csv',
    rawSha256: createHash('sha256').update(raw).digest('hex'),
    rawBytes: Buffer.byteLength(raw),
    gate: {
      minimumDurationMs,
      maximumPlayableP95Ms,
      result: 'pass',
    },
    run: {
      startedAt: new Date(captureStartEpochMs).toISOString(),
      endedAt: new Date(last.timestampMs).toISOString(),
      durationMs: round(last.elapsedMs, 3),
      sampleCount: rows.length,
      deliveredFrameMs: deliveredStats,
      renderDurationMs: statistics(renderValues),
      windowDurationMs,
      windowCount: windows.length,
      tierAtStart: first.tier,
      tierAtEnd: last.tier,
      tierTransitions: history.transitions,
    },
    methodology: {
      browser: 'Codex In-app Browser',
      harness: 'Checked-in development-only src/testing/graphics-harness.ts with scene=heavy-combat and record enabled.',
      measurement: 'Loop supplies requestAnimationFrame delivery intervals to QualityMonitor.sample(deliveredFrameMs). The CSV retains that delivered interval and Renderer.draw duration separately.',
      pressureScope: 'Delivered-frame time includes simulation, rendering, browser scheduling, and display delivery; it is not a synchronous draw-submit proxy.',
      scenario: 'The checked-in harness restages 18 entities, 48 projectiles, 6 charges, 8 impact blasts, and 120 particles every 100 ms while normal World.update and Renderer.draw continue.',
      windowing: 'Thirty-second buckets start at capture elapsed time zero. The final partial bucket contains the sample that crossed the ten-minute threshold.',
      productionBoundary: 'This is a development-harness performance capture. Production preview is verified separately without query overrides or the window harness API.',
      limitation: 'The browser does not expose physical-device thermals or JavaScript heap telemetry.',
    },
    tierHistory: history.segments,
    windows,
  };
}

const raw = readFileSync(rawPath, 'utf8');
const rows = parseRaw(raw);
const retained = JSON.parse(readFileSync(summaryPath, 'utf8'));
const sourceArg = process.argv.find(argument => argument.startsWith('--source-commit='));
const sourceCommit = sourceArg?.slice('--source-commit='.length)
  || retained.sourceBaselineCommit
  || 'uncommitted';
const computed = buildSummary(raw, rows, sourceCommit);

if (process.argv.includes('--write')) {
  writeFileSync(summaryPath, `${JSON.stringify(computed, null, 2)}\n`);
  console.log(`Wrote ${summaryPath}`);
} else {
  try {
    deepStrictEqual(retained, computed);
  } catch {
    console.error('heavy-combat-summary.json does not match heavy-combat-samples.csv');
    process.exit(1);
  }
}

console.log(
  `Validated ${computed.run.sampleCount} samples over ${computed.run.durationMs} ms: `
  + `delivered p95 ${computed.run.deliveredFrameMs.p95} ms, `
  + `render p95 ${computed.run.renderDurationMs.p95} ms, `
  + `${computed.run.windowCount} windows, `
  + `${computed.run.tierTransitions.length} tier transitions`,
);
