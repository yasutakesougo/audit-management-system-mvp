/* eslint-disable no-console -- CLI ops script */
/**
 * Drift Inventory — Observation-only SSOT vs actual field reconciliation.
 *
 * Compares SP_LIST_REGISTRY (expected) against an observed snapshot (actual)
 * and emits CSV + Markdown inventories. Read-only: never writes to SharePoint,
 * never mutates SSOT, never invokes drift auto-repair logic.
 *
 * Modes:
 *   --snapshot <path>   Read a schema-compliant JSON snapshot (see drift-inventory.schema.json).
 *   --live              (Stub, not implemented in this PR.)
 *
 * Output:
 *   docs/nightly-patrol/drift-inventory-<YYYY-MM-DD>.csv
 *   docs/nightly-patrol/drift-inventory-<YYYY-MM-DD>.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

// ── CLI ──────────────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2);
function flagValue(name) {
  const prefix = `--${name}=`;
  const hit = ARGS.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = ARGS.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < ARGS.length && !ARGS[idx + 1].startsWith('--')) {
    return ARGS[idx + 1];
  }
  return null;
}
const SNAPSHOT_PATH = flagValue('snapshot');
const FULL_SCAN = ARGS.includes('--full-scan') || ARGS.includes('--live');
const OUT_DIR = flagValue('out-dir') || join(REPO_ROOT, 'docs', 'nightly-patrol');

if (!SNAPSHOT_PATH && !FULL_SCAN) {
  console.error('❌ Missing --snapshot <path> or --full-scan.');
  console.error('   Usage:');
  console.error('     (Reactive)  node scripts/ops/drift-inventory.mjs --snapshot docs/nightly-patrol/input.json');
  console.error('     (Proactive) node scripts/ops/drift-inventory.mjs --full-scan');
  process.exit(2);
}

const SITE_URL = process.env.VITE_SP_SITE_URL || process.env.SP_SITE_URL;
const REPO_ROOT_PATH = process.cwd();
const TOKEN_FILE = join(REPO_ROOT_PATH, '.token.local');
let TOKEN = '';
try {
  TOKEN = readFileSync(TOKEN_FILE, 'utf-8').trim();
} catch (e) {
  TOKEN = (process.env.VITE_SP_TOKEN || process.env.SMOKE_TEST_BEARER_TOKEN || '').trim();
}

if (FULL_SCAN && (!SITE_URL || !TOKEN)) {
  console.error('❌ Missing credentials for --full-scan.');
  console.error('   Please set VITE_SP_SITE_URL or provide .token.local.');
  process.exit(2);
}

// ── SSOT textual parser ─────────────────────────────────────────────────────

const SSOT_PATH = resolve(REPO_ROOT, 'src/sharepoint/spListRegistry.ts');
const LIST_CONFIG_PATH = resolve(REPO_ROOT, 'src/sharepoint/fields/listRegistry.ts');

/** Parse LIST_CONFIG map: ListKeys.Foo → 'Foo_Title'. */
function parseListConfig(text) {
  const map = {};
  const re = /\[ListKeys\.(\w+)\]:\s*\{\s*title:\s*'([^']+)'\s*\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    map[m[1]] = m[2];
  }
  return map;
}

/** Extract top-level `{...}` objects inside a named array literal. String-aware, brace-counting. */
function extractArrayObjects(text, startToken) {
  const idx = text.indexOf(startToken);
  if (idx === -1) return [];
  // Find the literal `= [` that opens the array assignment. TypeScript type
  // annotations (e.g. `SpListEntry[]`) contain brackets we must skip over.
  const assignRe = /=\s*\[/g;
  assignRe.lastIndex = idx;
  const assignMatch = assignRe.exec(text);
  if (!assignMatch) return [];
  const openBracket = assignMatch.index + assignMatch[0].length - 1;
  const entries = [];
  let depth = 0;
  let braceDepth = 0;
  let entryStart = -1;
  let inString = null;
  let prev = '';
  for (let i = openBracket; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === inString && prev !== '\\') inString = null;
      prev = c;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = c;
      prev = c;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) break;
    } else if (c === '{') {
      if (depth === 1 && braceDepth === 0) entryStart = i;
      braceDepth++;
    } else if (c === '}') {
      braceDepth--;
      if (depth === 1 && braceDepth === 0 && entryStart !== -1) {
        entries.push(text.slice(entryStart, i + 1));
        entryStart = -1;
      }
    }
    prev = c;
  }
  return entries;
}

/** Extract a balanced `[...]` array body immediately after a key. Returns the inner body string or null. */
function extractArrayBody(entry, key) {
  const re = new RegExp(`${key}\\s*:\\s*\\[`);
  const m = re.exec(entry);
  if (!m) return null;
  const start = m.index + m[0].length - 1; // index of '['
  let depth = 0;
  let inString = null;
  let prev = '';
  for (let i = start; i < entry.length; i++) {
    const c = entry[i];
    if (inString) {
      if (c === inString && prev !== '\\') inString = null;
      prev = c;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = c;
      prev = c;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return entry.slice(start + 1, i);
    }
    prev = c;
  }
  return null;
}

/** Parse essentialFields array body: ['A', 'B', 'C']. */
function parseStringArray(body) {
  if (!body) return [];
  const out = [];
  const re = /'([^']+)'/g;
  let m;
  while ((m = re.exec(body)) !== null) out.push(m[1]);
  return out;
}

/** Parse provisioningFields entries. Returns [{ internalName, candidates: [] }]. */
function parseProvisioning(body) {
  if (!body) return [];
  const out = [];
  // Each entry is a single-line (or wrapped) object literal starting with `{ internalName: '...'
  // Scan by brace matching at depth 1.
  let depth = 0;
  let entryStart = -1;
  let inString = null;
  let prev = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inString) {
      if (c === inString && prev !== '\\') inString = null;
      prev = c;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = c;
      prev = c;
      continue;
    }
    if (c === '{') {
      if (depth === 0) entryStart = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && entryStart !== -1) {
        const entry = body.slice(entryStart, i + 1);
        const nm = /internalName:\s*'([^']+)'/.exec(entry);
        if (nm) {
          const candBody = extractArrayBody(entry, 'candidates');
          out.push({
            internalName: nm[1],
            candidates: parseStringArray(candBody),
          });
        }
        entryStart = -1;
      }
    }
    prev = c;
  }
  return out;
}

/** Load SSOT into { listKey → { listTitle, essentialFields[], provisioningFields[], lifecycle, category } }. */
function loadSsot() {
  const ssotText = readFileSync(SSOT_PATH, 'utf-8');
  const configText = readFileSync(LIST_CONFIG_PATH, 'utf-8');
  const listConfig = parseListConfig(configText);

  const entries = extractArrayObjects(ssotText, 'SP_LIST_REGISTRY');
  const out = {};
  for (const entry of entries) {
    const keyMatch = /\bkey:\s*'([^']+)'/.exec(entry);
    if (!keyMatch) continue;
    const lifecycleMatch = /\blifecycle:\s*'([^']+)'/.exec(entry);
    const categoryMatch = /\bcategory:\s*'([^']+)'/.exec(entry);
    const fromConfigMatch = /fromConfig\(ListKeys\.(\w+)\)/.exec(entry);
    let listTitle = null;
    if (fromConfigMatch) {
      listTitle = listConfig[fromConfigMatch[1]] || null;
    }
    if (!listTitle) {
      // Fallback: envOr('VITE_XXX', 'LiteralTitle') or envOr("...", "...")
      const envOrMatch = /envOr\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*\)/.exec(entry);
      if (envOrMatch) listTitle = envOrMatch[1];
    }

    const essentialBody = extractArrayBody(entry, 'essentialFields');
    const provBody = extractArrayBody(entry, 'provisioningFields');

    out[keyMatch[1]] = {
      listKey: keyMatch[1],
      listTitle: listTitle || '(unresolved)',
      lifecycle: lifecycleMatch ? lifecycleMatch[1] : 'unknown',
      category: categoryMatch ? categoryMatch[1] : 'other',
      essentialFields: parseStringArray(essentialBody),
      provisioningFields: parseProvisioning(provBody),
    };
  }
  return out;
}

// ── Snapshot loader ─────────────────────────────────────────────────────────

function loadSnapshot(path) {
  const abs = resolve(REPO_ROOT, path);
  const raw = readFileSync(abs, 'utf-8');
  const parsed = JSON.parse(raw);
  if (parsed.version !== 1) {
    throw new Error(`Unsupported snapshot version: ${parsed.version} (expected 1)`);
  }
  if (!Array.isArray(parsed.lists)) {
    throw new Error('Snapshot .lists must be an array.');
  }
  return {
    version: parsed.version,
    generatedAt: parsed.generatedAt || null,
    source: parsed.source || 'manual',
    coverage: parsed.coverage || 'partial',
    notes: parsed.notes || '',
    lists: parsed.lists.map((l) => ({
      listTitle: l.listTitle,
      listKey: l.listKey || null,
      actualFields: Array.isArray(l.actualFields) ? l.actualFields : [],
      missingReports: Array.isArray(l.missingReports) ? l.missingReports : [],
    })),
  };
}

// ── Classification ──────────────────────────────────────────────────────────

const ENCODED_PATTERN = /_x[0-9a-fA-F]{4}_/;

/** Truncation detection: SharePoint tends to clip internal names at ~32 chars. */
function looksTruncated(expected, actual) {
  if (!actual) return false;
  return actual.length < expected.length && expected.startsWith(actual);
}

/** Case-insensitive match helper. */
function findCaseInsensitive(expected, actuals) {
  const lower = expected.toLowerCase();
  return actuals.find((a) => a.toLowerCase() === lower && a !== expected) || null;
}

/** Suffix-digit drift: expected='Status' actual='Status0'. */
function findSuffixVariant(expected, actuals) {
  for (const a of actuals) {
    if (a.startsWith(expected) && a !== expected) {
      const suf = a.slice(expected.length);
      if (/^\d+$/.test(suf)) return a;
    }
  }
  return null;
}

/** Encoded-drift: _x0020_ etc. */
function findEncodedVariant(expected, actuals) {
  const encodedExpected = expected.replace(/ /g, '_x0020_');
  const found = actuals.find((a) => a === encodedExpected);
  if (found) return found;
  for (const a of actuals) {
    if (ENCODED_PATTERN.test(a) && a.replace(/_x0020_/g, '').toLowerCase().includes(expected.replace(/ /g, '').toLowerCase())) {
      return a;
    }
  }
  return null;
}

/** Truncated variant search. */
function findTruncatedVariant(expected, actuals) {
  return actuals.find((a) => looksTruncated(expected, a)) || null;
}

/** Candidate fallback search (from SSOT's provisioningFields[].candidates). */
function findCandidateMatch(candidates, actuals) {
  for (const c of candidates) {
    if (actuals.includes(c)) return c;
  }
  return null;
}

/**
 * Classify a single expected field against an observed snapshot entry.
 * Returns { driftType, actualField, severity, actionCandidate, notes }.
 */
function classifyExpected(expected, candidates, snapshotEntry, requirement, coverage) {
  const actuals = snapshotEntry.actualFields || [];
  const missingReports = snapshotEntry.missingReports || [];

  if (actuals.includes(expected)) {
    return {
      driftType: 'match',
      actualField: expected,
      severity: 'ok',
      actionCandidate: 'no-action',
      notes: '',
    };
  }

  const ci = findCaseInsensitive(expected, actuals);
  if (ci) {
    return {
      driftType: 'case_mismatch',
      actualField: ci,
      severity: 'info',
      actionCandidate: 'keep-actual',
      notes: `Case-only difference vs expected '${expected}'.`,
    };
  }

  const suf = findSuffixVariant(expected, actuals);
  if (suf) {
    return {
      driftType: 'suffix_mismatch',
      actualField: suf,
      severity: 'warn',
      actionCandidate: 'zombie-candidate',
      notes: `Digit-suffix drift (likely auto-created duplicate). Candidate for deletion.`,
    };
  }

  const enc = findEncodedVariant(expected, actuals);
  if (enc) {
    return {
      driftType: 'fuzzy_match',
      actualField: enc,
      severity: 'warn',
      actionCandidate: 'rename-migrate',
      notes: `_xNNNN_ encoding (SharePoint space/special-char transform).`,
    };
  }

  const trunc = findTruncatedVariant(expected, actuals);
  if (trunc) {
    return {
      driftType: 'fuzzy_match',
      actualField: trunc,
      severity: 'warn',
      actionCandidate: 'rename-migrate',
      notes: `Truncated internal name (likely SharePoint length clip).`,
    };
  }

  const cand = findCandidateMatch(candidates, actuals);
  if (cand) {
    return {
      driftType: 'fallback',
      actualField: cand,
      severity: 'warn',
      actionCandidate: 'add-canonical',
      notes: `Resolved via SSOT candidates list (canonical '${expected}' not present).`,
    };
  }

  if (missingReports.includes(expected)) {
    return {
      driftType: 'missing',
      actualField: null,
      severity: requirement === 'essential' ? 'warn' : 'info',
      actionCandidate: requirement === 'essential' ? 'add-canonical' : 'optional-missing',
      notes: 'Reported missing by application at runtime.',
    };
  }

  if (coverage === 'full') {
    return {
      driftType: 'missing',
      actualField: null,
      severity: requirement === 'essential' ? 'warn' : 'info',
      actionCandidate: requirement === 'essential' ? 'add-canonical' : 'optional-missing',
      notes: 'Not present in snapshot (coverage=full).',
    };
  }

  return {
    driftType: 'unknown',
    actualField: null,
    severity: 'info',
    actionCandidate: 'no-action',
    notes: 'No observation in snapshot (coverage=partial).',
  };
}

/** System fields that always exist and should not be flagged as zombies. */
const SYSTEM_FIELDS = new Set(['Id', 'ID', 'Title', 'Created', 'Modified', 'Author', 'Editor', 'GUID', 'FileRef', 'FileDirRef']);

// ── Row assembly ────────────────────────────────────────────────────────────

const REQUIREMENT_ORDER = { essential: 0, optional: 1, unknown: 2 };

function buildRows(ssot, snapshot) {
  const rows = [];
  const snapshotByTitle = new Map();
  for (const l of snapshot.lists) snapshotByTitle.set(l.listTitle, l);

  const ssotEntries = Object.values(ssot);
  const ssotByTitle = new Map(ssotEntries.map((e) => [e.listTitle, e]));

  // Track which actual fields have been consumed by an expected-match row,
  // so we do not double-count them as zombie candidates.
  const consumedByTitle = new Map();

  // 1. For each SSOT entry, emit expected-based rows.
  for (const entry of ssotEntries) {
    if (entry.lifecycle !== 'required' && entry.lifecycle !== 'optional') continue;
    const snap = snapshotByTitle.get(entry.listTitle);
    const listObserved = Boolean(snap);
    const snapEntry = snap || { actualFields: [], missingReports: [] };
    // For lists not in the snapshot at all, downgrade to partial so that
    // absence-of-signal becomes `unknown` rather than `missing`.
    const effectiveCoverage = listObserved ? snapshot.coverage : 'partial';

    const expectedSet = new Map();
    for (const f of entry.essentialFields) expectedSet.set(f, 'essential');
    for (const pf of entry.provisioningFields) {
      if (!expectedSet.has(pf.internalName)) expectedSet.set(pf.internalName, 'optional');
    }

    const candidatesByName = new Map(entry.provisioningFields.map((pf) => [pf.internalName, pf.candidates || []]));
    const consumed = consumedByTitle.get(entry.listTitle) || new Set();

    for (const [expectedField, requirement] of expectedSet) {
      const candidates = candidatesByName.get(expectedField) || [];
      const cls = classifyExpected(expectedField, candidates, snapEntry, requirement, effectiveCoverage);
      if (cls.actualField) consumed.add(cls.actualField);
      rows.push({
        listKey: entry.listKey,
        listTitle: entry.listTitle,
        expectedField,
        actualField: cls.actualField,
        driftType: cls.driftType,
        severity: cls.severity,
        requirement,
        judgement: cls.actionCandidate,
        notes: cls.notes,
        evidenceSource: snapshot.source,
        _kind: 'expected',
      });
    }
    consumedByTitle.set(entry.listTitle, consumed);
  }

  // 2. For each snapshot list (coverage=full), emit zombie_candidate rows for
  //    actualFields that have no SSOT counterpart and were not already
  //    consumed by a case/fuzzy/suffix match above.
  if (snapshot.coverage === 'full') {
    for (const snap of snapshot.lists) {
      const ssotEntry = ssotByTitle.get(snap.listTitle);
      if (!ssotEntry) continue;
      const expected = new Set();
      for (const f of ssotEntry.essentialFields) expected.add(f);
      for (const pf of ssotEntry.provisioningFields) {
        expected.add(pf.internalName);
        for (const c of pf.candidates || []) expected.add(c);
      }
      const consumed = consumedByTitle.get(snap.listTitle) || new Set();
      for (const actual of snap.actualFields) {
        if (expected.has(actual)) continue;
        if (consumed.has(actual)) continue;
        if (SYSTEM_FIELDS.has(actual)) continue;
        rows.push({
          listKey: ssotEntry.listKey,
          listTitle: snap.listTitle,
          expectedField: null,
          actualField: actual,
          driftType: 'zombie_candidate',
          severity: 'info',
          requirement: 'unknown',
          judgement: 'zombie-candidate',
          notes: 'Present in snapshot but no SSOT counterpart (coverage=full).',
          evidenceSource: snapshot.source,
          _kind: 'snapshot-only',
        });
      }
    }
  }

  // Stable sort.
  rows.sort((a, b) => {
    if (a.listTitle !== b.listTitle) return a.listTitle.localeCompare(b.listTitle);
    if (a._kind !== b._kind) return a._kind === 'expected' ? -1 : 1;
    const ra = REQUIREMENT_ORDER[a.requirement] ?? 2;
    const rb = REQUIREMENT_ORDER[b.requirement] ?? 2;
    if (ra !== rb) return ra - rb;
    const ea = a.expectedField || '';
    const eb = b.expectedField || '';
    if (ea !== eb) return ea.localeCompare(eb);
    const aa = a.actualField || '';
    const ab = b.actualField || '';
    return aa.localeCompare(ab);
  });

  return rows;
}

// ── Live Scan Engine ────────────────────────────────────────────────────────

async function fetchActualFields(listTitle) {
  const url = `${SITE_URL}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/fields?$select=InternalName`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/json;odata=nometadata',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.value || []).map(f => f.InternalName);
}

async function performFullScan(ssot) {
  const lists = [];
  const entries = Object.values(ssot).filter(e => e.lifecycle === 'required' || e.lifecycle === 'optional');

  console.log(`📡 Starting live scan for ${entries.length} lists...`);

  for (const entry of entries) {
    process.stdout.write(`   → ${entry.listTitle}... `);
    try {
      const fields = await fetchActualFields(entry.listTitle);
      lists.push({
        listTitle: entry.listTitle,
        listKey: entry.listKey,
        actualFields: fields,
        missingReports: [],
      });
      process.stdout.write(`✅ (${fields.length} fields)\n`);
    } catch (err) {
      process.stdout.write(`❌ skipped (${err.message})\n`);
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'live-probe',
    coverage: 'full',
    notes: 'Generated via --full-scan (proactive live scan). Enables zombie candidate detection.',
    lists,
  };
}

// ── Output writers ──────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  'listKey', 'listTitle', 'expectedField', 'actualField',
  'driftType', 'severity', 'requirement', 'judgement', 'notes', 'evidenceSource',
];

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvEscape(r[c])).join(','));
  }
  return lines.join('\n') + '\n';
}

function mdEscape(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function toMarkdown(rows, snapshot, stamp, snapshotPath) {
  const driftTypeOrder = [
    'match', 'case_mismatch', 'suffix_mismatch', 'fuzzy_match',
    'fallback', 'missing', 'zombie_candidate', 'unknown',
  ];
  const driftCounts = Object.fromEntries(driftTypeOrder.map((t) => [t, 0]));
  const warnByList = new Map();
  const listsSeen = new Set();
  for (const r of rows) {
    listsSeen.add(r.listTitle);
    if (driftCounts[r.driftType] !== undefined) driftCounts[r.driftType]++;
    if (r.severity === 'warn' || r.severity === 'error') {
      warnByList.set(r.listTitle, (warnByList.get(r.listTitle) || 0) + 1);
    }
  }

  const lines = [];
  lines.push(`# Drift Inventory — ${stamp}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- generatedAt: ${new Date().toISOString()}`);
  lines.push(`- snapshotPath: \`${snapshotPath}\``);
  lines.push(`- snapshotSource: ${snapshot.source}`);
  lines.push(`- snapshotCoverage: ${snapshot.coverage}`);
  if (snapshot.generatedAt) lines.push(`- snapshotGeneratedAt: ${snapshot.generatedAt}`);
  lines.push(`- totalRows: ${rows.length}`);
  lines.push(`- listsScanned: ${listsSeen.size}`);
  if (snapshot.coverage === 'partial') {
    lines.push('');
    lines.push('> ⚠️ **Partial coverage.** actualFields is not authoritative. `zombie_candidate` detection is disabled, and fields with no signal are classified as `unknown` rather than `missing`.');
  }
  if (snapshot.notes) {
    lines.push('');
    lines.push(`> **Snapshot notes:** ${snapshot.notes}`);
  }
  lines.push('');
  lines.push('### driftType別件数');
  lines.push('');
  lines.push('| driftType | count |');
  lines.push('|-----------|-------|');
  for (const t of driftTypeOrder) {
    lines.push(`| ${t} | ${driftCounts[t]} |`);
  }
  lines.push('');
  lines.push('### WARN対象リスト（severity >= warn の行を持つリスト）');
  lines.push('');
  if (warnByList.size === 0) {
    lines.push('_（なし）_');
  } else {
    for (const [title, count] of [...warnByList.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${title}: ${count}`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push(`| ${CSV_COLUMNS.join(' | ')} |`);
  lines.push(`| ${CSV_COLUMNS.map(() => '---').join(' | ')} |`);
  for (const r of rows) {
    lines.push(`| ${CSV_COLUMNS.map((c) => mdEscape(r[c])).join(' | ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────────

function today() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function main() {
  const modeLabel = FULL_SCAN ? 'PROACTIVE (Full Scan)' : 'REACTIVE (Log Snapshot)';
  console.log(`🔍 Drift Inventory — Mode: ${modeLabel}`);

  const ssot = loadSsot();
  const ssotCount = Object.keys(ssot).length;
  console.log(`   SSOT entries loaded: ${ssotCount}`);

  let snapshot;
  let sourceLabel;

  if (FULL_SCAN) {
    snapshot = await performFullScan(ssot);
    sourceLabel = 'live SharePoint API';
  } else {
    snapshot = loadSnapshot(SNAPSHOT_PATH);
    sourceLabel = SNAPSHOT_PATH;
  }

  console.log(`   Snapshot lists: ${snapshot.lists.length}, coverage=${snapshot.coverage}, source=${snapshot.source}`);

  const rows = buildRows(ssot, snapshot);
  console.log(`   Rows: ${rows.length}`);

  const stamp = today();
  mkdirSync(OUT_DIR, { recursive: true });
  const csvPath = join(OUT_DIR, `drift-inventory-${stamp}.csv`);
  const mdPath = join(OUT_DIR, `drift-inventory-${stamp}.md`);
  writeFileSync(csvPath, toCsv(rows));
  writeFileSync(mdPath, toMarkdown(rows, snapshot, stamp, sourceLabel));

  console.log(`✅ CSV: ${csvPath}`);
  console.log(`✅ MD:  ${mdPath}`);
}

main().catch(err => {
  console.error(`❌ Inventory failed: ${err.message}`);
  process.exit(1);
});
