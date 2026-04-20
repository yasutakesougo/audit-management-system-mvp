/* eslint-disable no-console -- CLI ops script */
/**
 * Drift Inventory Log Adapter
 *
 * Converts [sp:schema_mismatch] log entries into a drift-inventory.schema.json
 * compliant snapshot. Produces partial-coverage snapshots: only observed
 * drift signals are captured; actualFields lists are left empty because the
 * logs do not carry a complete field enumeration.
 *
 * Usage:
 *   node scripts/ops/drift-inventory-from-log.mjs \
 *     --logs logs/today.auto.log \
 *     --out docs/nightly-patrol/drift-inventory-input.json
 *
 * Multiple --logs flags may be passed to merge sources.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const ARGS = process.argv.slice(2);

function collectFlag(name) {
  const values = [];
  const prefix = `--${name}=`;
  for (let i = 0; i < ARGS.length; i++) {
    const a = ARGS[i];
    if (a.startsWith(prefix)) {
      values.push(a.slice(prefix.length));
    } else if (a === `--${name}` && i + 1 < ARGS.length && !ARGS[i + 1].startsWith('--')) {
      values.push(ARGS[++i]);
    }
  }
  return values;
}

function singleFlag(name) {
  return collectFlag(name)[0] || null;
}

const LOG_PATHS = collectFlag('logs');
const OUT_PATH = singleFlag('out');

if (LOG_PATHS.length === 0 || !OUT_PATH) {
  console.error('❌ Usage: node scripts/ops/drift-inventory-from-log.mjs --logs <path> [--logs <path>...] --out <path>');
  process.exit(2);
}

function extractMismatches(text) {
  const re = /\[sp:schema_mismatch\]\s*(\{[^\n]*\})/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      out.push(JSON.parse(m[1]));
    } catch (err) {
      console.warn(`   ⚠️ Skipped malformed entry: ${String(err.message || err)}`);
    }
  }
  return out;
}

const byList = new Map();
for (const p of LOG_PATHS) {
  const abs = resolve(REPO_ROOT, p);
  if (!existsSync(abs)) {
    console.warn(`⚠️ Log file not found: ${abs} (skipping)`);
    continue;
  }
  const text = readFileSync(abs, 'utf-8');
  const entries = extractMismatches(text);
  console.log(`   ${p}: ${entries.length} [sp:schema_mismatch] entries`);
  for (const e of entries) {
    const listTitle = e.listName || e.listTitle;
    if (!listTitle) continue;
    if (!byList.has(listTitle)) byList.set(listTitle, new Set());
    const bucket = byList.get(listTitle);
    for (const f of e.missingFields || []) bucket.add(f);
  }
}

const lists = [];
for (const [listTitle, missing] of [...byList.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  lists.push({
    listTitle,
    actualFields: [],
    missingReports: [...missing].sort(),
  });
}

const snapshot = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: 'log-adapter',
  coverage: 'partial',
  notes: `Generated from [sp:schema_mismatch] log entries across ${LOG_PATHS.length} log file(s). Only observed mismatches are captured; absence of a field from actualFields does NOT imply zombie status.`,
  lists,
};

const outAbs = resolve(REPO_ROOT, OUT_PATH);
mkdirSync(dirname(outAbs), { recursive: true });
writeFileSync(outAbs, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`✅ Wrote ${outAbs} (${lists.length} list(s))`);
