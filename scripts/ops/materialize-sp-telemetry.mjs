/* eslint-disable no-console -- CLI ops script */
import fs from 'node:fs';
import path from 'node:path';
import { resolveSpTelemetryInput } from './resolve-sp-telemetry-input.mjs';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');

function utcTodayStamp() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sameFilePath(a, b) {
  return path.resolve(a) === path.resolve(b);
}

async function main() {
  const date = utcTodayStamp();
  const resolved = resolveSpTelemetryInput({
    root: ROOT,
    reportDir: REPORT_DIR,
    date,
    preferRootDump: true,
  });
  const sourcePath = resolved.resolvedPath;
  const datedOutputPath = path.join(REPORT_DIR, `sp-telemetry-${date}.json`);
  const latestOutputPath = path.join(REPORT_DIR, 'sp-telemetry.json');

  console.log('📦 Materializing SP telemetry artifact...');

  if (!sourcePath) {
    const checked = Array.isArray(resolved.candidates) && resolved.candidates.length > 0
      ? ` Checked: ${resolved.candidates.join(', ')}`
      : '';
    console.log(`   ℹ️ no telemetry source found.${checked}`);
    return;
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const payload = fs.readFileSync(sourcePath, 'utf8');

  if (!sameFilePath(sourcePath, datedOutputPath)) {
    fs.writeFileSync(datedOutputPath, payload, 'utf8');
  }
  if (!sameFilePath(sourcePath, latestOutputPath)) {
    fs.writeFileSync(latestOutputPath, payload, 'utf8');
  }

  console.log(`   ✅ source: ${path.relative(ROOT, sourcePath)}`);
  console.log(`   ✅ dated:  ${path.relative(ROOT, datedOutputPath)}`);
  console.log(`   ✅ latest: ${path.relative(ROOT, latestOutputPath)}`);
}

await main();
