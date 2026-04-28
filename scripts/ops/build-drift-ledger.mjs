/* eslint-disable no-console -- CLI ops script */
/**
 * Drift Ledger Builder — Generates an administrative evidence ledger for schema cleanup.
 *
 * This script enriches the basic drift-inventory with production live-probe data
 * (hasData, isIndexed) and classifies each field for the "Controlled Reduction" phase.
 *
 * OUTPUT:
 *   docs/nightly-patrol/drift-ledger.csv
 *   docs/nightly-patrol/drift-ledger.md
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { getAccessToken, refreshM365Token } from './auth-helper.mjs';

// 1. Load SSOT (Top-level for helper visibility)
// NOTE:
// `tsx` can expose TS modules as CJS-compatible namespace objects in this repo setup.
// Resolve exports through namespace + default fallback to support both ESM and CJS shapes.
import * as spListRegistryModule from '../../src/sharepoint/spListRegistry.ts';
import * as spSystemFieldsModule from '../../src/sharepoint/spSystemFields.js';

const SP_LIST_REGISTRY =
  spListRegistryModule.SP_LIST_REGISTRY ??
  spListRegistryModule.default?.SP_LIST_REGISTRY ??
  [];
const SP_SYSTEM_FIELDS =
  spSystemFieldsModule.SP_SYSTEM_FIELDS ??
  spSystemFieldsModule.default?.SP_SYSTEM_FIELDS ??
  new Set();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

// ── Classification Logic ──────────────────────────────────────────────────

/**
 * Classifies a field and assigns a confidence level for potential remediation.
 */
/**
 * Classifies a field using the 4-tier governance model (Phase 2).
 */
function classify(row, prov) {
  // If explicitly tagged in Registry, respect it
  if (prov?.governance) {
    return { 
      classification: prov.governance, 
      evidence: 'explicit_registry_governance', 
      confidence: 'high' 
    };
  }

  // Phase 4: Respect 'isSilent' for confirmed environment drifts
  if (prov?.isSilent) {
    return {
      classification: 'allow',
      evidence: 'silent_drift_registry_governance',
      confidence: 'high'
    };
  }

  const usageCount = row.usageCount || 0;

  // 1. Matched Registry Field -> allow
  if (row.expectedField && row.actualField) {
    return { classification: 'allow', evidence: 'registry_match', confidence: 'high' };
  }

  // 2. Not in Registry but used in Code -> candidate
  if (usageCount > 0) {
    return { classification: 'candidate', evidence: `active_usage_in_code(${usageCount})`, confidence: 'high' };
  }

  // 3. Not in Registry, No usage, but has Data -> provision
  if (row.hasData) {
    return { classification: 'provision', evidence: 'data_exists_no_usage', confidence: 'medium' };
  }

  // 4. No Data, No Usage -> keep-warn (Zombie Candidate)
  if (usageCount === 0 && !row.hasData) {
    const isNumberedSuffix = /\d+$/.test(row.internalName);
    return { 
      classification: 'keep-warn', 
      evidence: 'no_data_no_usage', 
      confidence: isNumberedSuffix ? 'high' : 'medium' 
    };
  }

  return { classification: 'provision', evidence: 'fallback_or_partial', confidence: 'low' };
}

// ── SharePoint API Helpers ────────────────────────────────────────────────

async function spFetch(url, auth, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json;odata=nometadata',
      'Authorization': `Bearer ${auth.token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    console.log('🔑 Token expired (401). Attempting auto-refresh...');
    const newToken = refreshM365Token();
    if (newToken) {
      auth.token = newToken;
      return spFetch(url, auth, options);
    }
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After') || '5';
    console.log(`⏳ Rate limited. Retrying after ${retryAfter}s...`);
    await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
    return spFetch(url, auth, options);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

/** Simple concurrency-limited map. */
async function pMap(items, fn, limit = 5) {
  const results = [];
  const batches = [];
  for (let i = 0; i < items.length; i += limit) {
    batches.push(items.slice(i, i + limit));
  }
  for (const batch of batches) {
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

async function checkHasData(siteUrl, listTitle, internalName, auth) {
  try {
    // Attempt with filter (fastest)
    const url = `${siteUrl}/lists/getbytitle('${listTitle}')/items?$select=${internalName}&$top=1&$filter=${internalName} ne null`;
    const data = await spFetch(url, auth);
    return data.value && data.value.length > 0;
  } catch (e) {
    // Fallback for non-filterable fields (e.g., Note/Multiline)
    if (e.message.includes('Note') || e.message.includes('SPException')) {
      try {
        const url = `${siteUrl}/lists/getbytitle('${listTitle}')/items?$select=${internalName}&$top=1`;
        const data = await spFetch(url, auth);
        if (data.value && data.value.length > 0) {
          const val = data.value[0][internalName];
          return val !== null && val !== undefined && val !== '';
        }
      } catch (_error) {
        // ignore
      }
    }
    return false;
  }
}

function countUsage(internalName) {
  try {
    // -F: fixed strings, -w: whole word, --count: total matches per file
    // Note: rg returns exit code 1 if no matches, which throws in execSync
    const output = execSync(`rg -F -w "${internalName}" src/ --glob "!**/node_modules/*" --glob "!**/__tests__/*" --glob "!**/spListRegistry.definitions.ts" --glob "!**/userFields.ts" --glob "!**/transportFields.ts" --glob "!**/dailyFields.ts" --glob "!**/constants.ts" --glob "!**/spIndexKnownConfig.ts" --count`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    // Sum the counts from all files
    const lines = output.trim().split('\n');
    let total = 0;
    for (const line of lines) {
      const parts = line.split(':');
      const count = parseInt(parts[parts.length - 1]);
      if (!isNaN(count)) total += count;
    }
    return total;
  } catch (_error) {
    return 0; // Exit code 1 or other errors
  }
}

/**
 * Determines if a field is a SharePoint system/built-in field that should NEVER be treated as a zombie.
 */
function isSystemField(internalName) {
  // 1. In known system fields set
  if (SP_SYSTEM_FIELDS.has(internalName)) return true;

  // 2. Starts with underscore (usually internal system fields)
  if (internalName.startsWith('_')) return true;

  // 3. Known SharePoint patterns
  const systemPatterns = [
    /^OData_/,           // OData extensions
    /^File/,             // File system properties (FileRef, FileLeafRef, etc.)
    /^MediaService/,     // Media services
    /Virus/i,            // Antivirus metadata
    /Compliance/i,       // Compliance/Retention
    /SharedWith/i,       // Sharing metadata
    /Workflow/i,         // Legacy workflows
    /^App[A-Z]/,         // App-related
    /Version/i,          // Versioning
    /Originator/i,       // Flow/Workflow related
    /SyncClient/i,       // OneDrive/Sync related
    /^SMTotal/,          // Storage Metrics
    /^SMLastModified/,   // Storage Metrics
    /ParentUniqueId/i,   // Internal ID
    /SortBehavior/i,     // Internal behavior
    /Restricted/i,       // Security
    /NoExecute/i,        // Security
    /AccessPolicy/i,     // Security
    /MainLinkSettings/i, // UI/Link settings
    /HTML_x0020_File/i,  // File type
    /owshiddenversion/i  // Versioning
  ];
  if (systemPatterns.some(p => p.test(internalName))) return true;

  // 4. Well-known infrastructure columns (ADR-021: Soft-Delete Governance)
  const infrastructureFields = new Set([
    'DeletedAt', 'DeletedBy', 'IsDeleted',
  ]);
  if (infrastructureFields.has(internalName)) return true;

  return false;
}

// ── Churn Suppression ─────────────────────────────────────────────────────

/**
 * Fields that represent meaningful structural state of a ledger row.
 * If none of these change between runs, we keep the previous `lastSeenAt`
 * to avoid noisy git diffs (688+ line churn from timestamp-only updates).
 */
const STRUCTURAL_FIELDS = [
  'driftType', 'usageCount', 'hasData', 'isIndexed',
  'classification', 'confidence', 'evidence',
  'fieldId', 'expectedField', 'actualField', 'candidatesMatched',
];

/**
 * Returns true if any structural field differs between the previous CSV row
 * (string values from parsed CSV) and the current in-memory row.
 */
function hasStructuralChange(prev, current) {
  for (const field of STRUCTURAL_FIELDS) {
    const prevVal = String(prev[field] ?? '');
    const curVal  = String(current[field] ?? '');
    if (prevVal !== curVal) return true;
  }
  return false;
}

// ── Main Execution ───────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Building Drift Ledger — Phase 2 Evidence Generation');
  
  // Load .env and .env.local if they exist
  ['.env', '.env.local'].forEach(file => {
    try {
      const envPath = join(REPO_ROOT, file);
      if (existsSync(envPath)) {
        const envContent = readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
          const [key, ...valParts] = line.split('=');
          if (key && valParts.length > 0) {
            process.env[key.trim()] = valParts.join('=').trim();
          }
        });
      }
    } catch (_error) {
      // Ignore
    }
  });
  
  const OUT_DIR = join(REPO_ROOT, 'docs', 'nightly-patrol');
  mkdirSync(OUT_DIR, { recursive: true });

  const SITE_URL = process.env.VITE_SP_SITE_URL;
  const auth = { token: getAccessToken() };

  if (!SITE_URL || !auth.token) {
    console.error('❌ Missing credentials (VITE_SP_SITE_URL or .token.local).');
    process.exit(2);
  }

  const normalizedSiteUrl = SITE_URL.endsWith('/_api/web') ? SITE_URL : SITE_URL.replace(/\/$/, '') + '/_api/web';

  const ledgerRows = [];
  const registry = SP_LIST_REGISTRY;

  for (const entry of registry) {
    const listTitle = entry.resolve();
    console.log(`📡 Probing list: ${listTitle}...`);

    // Inter-list delay to avoid burst limits
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Fetch actual fields
      const fieldsUrl = `${normalizedSiteUrl}/lists/getbytitle('${listTitle}')/fields?$select=Id,InternalName,Title,Indexed`;
      const fieldsData = await spFetch(fieldsUrl, auth);
      const actualFields = fieldsData.value;
      
      const consumedActuals = new Set();

      // 1. Prepare Expected Rows
      const allExpected = [
        ...(entry.essentialFields || []).map(f => ({ name: f, requirement: 'essential' })),
        ...(entry.provisioningFields || [])
          .filter(pf => !entry.essentialFields?.includes(pf.internalName))
          .map(pf => ({ name: pf.internalName, requirement: 'optional' }))
      ];

      const expectedResults = await pMap(allExpected, async (exp) => {
        const prov = entry.provisioningFields?.find(p => p.internalName === exp.name);
        const candidates = prov?.candidates || [exp.name];
        
        const matchedActual = actualFields.find(f => candidates.includes(f.InternalName));
        let driftType = 'match';
        let candidatesMatched = false;

        if (matchedActual) {
          consumedActuals.add(matchedActual.InternalName);
          if (matchedActual.InternalName !== exp.name) {
            driftType = 'fuzzy_match';
            candidatesMatched = true;
          }
        } else {
          driftType = 'optional_missing';
        }

        const hasData = matchedActual ? await checkHasData(normalizedSiteUrl, listTitle, matchedActual.InternalName, auth) : false;
        const usageCount = matchedActual ? countUsage(matchedActual.InternalName) : 0;

        return {
          listKey: entry.key,
          listTitle,
          fieldId: matchedActual?.Id || null,
          internalName: matchedActual?.InternalName || exp.name,
          displayName: matchedActual?.Title || exp.name,
          expectedField: exp.name,
          actualField: matchedActual?.InternalName || null,
          driftType,
          candidatesMatched,
          usageCount,
          hasData,
          isIndexed: matchedActual?.Indexed || false,
          lastSeenAt: new Date().toISOString(),
          prov // Store prov for classification
        };
      }, 2); // Lower concurrency

      ledgerRows.push(...expectedResults);

      // 2. Prepare Zombie Rows
      const zombies = actualFields.filter(f => !consumedActuals.has(f.InternalName) && !isSystemField(f.InternalName));
      const zombieResults = await pMap(zombies, async (z) => {
        const hasData = await checkHasData(normalizedSiteUrl, listTitle, z.InternalName, auth);
        const usageCount = countUsage(z.InternalName);
        return {
          listKey: entry.key,
          listTitle,
          fieldId: z.Id,
          internalName: z.InternalName,
          displayName: z.Title,
          expectedField: null,
          actualField: z.InternalName,
          driftType: 'zombie_candidate',
          candidatesMatched: false,
          usageCount,
          hasData,
          isIndexed: z.Indexed,
          lastSeenAt: new Date().toISOString()
        };
      }, 2); // Lower concurrency

      ledgerRows.push(...zombieResults);
    } catch (e) {
      console.warn(`⚠️  Failed to probe list ${listTitle}: ${e.message}`);
    }
  }

  // 3. Load Existing Ledger for Persistence (firstSeenAt + churn suppression)
  //    We store full previous rows so we can compare structural fields and
  //    only bump lastSeenAt when something actually changed.
  const existingLedgerPath = join(OUT_DIR, 'drift-ledger.csv');
  const persistenceMap = new Map();
  if (existsSync(existingLedgerPath)) {
    try {
      const prevContent = readFileSync(existingLedgerPath, 'utf-8');
      const prevLines = prevContent.split('\n').filter(Boolean);
      if (prevLines.length > 1) {
        const prevHeaders = prevLines[0].split(',').map(h => h.replace(/"/g, ''));
        const listIdx = prevHeaders.indexOf('listKey');
        const nameIdx = prevHeaders.indexOf('internalName');
        
        if (listIdx !== -1 && nameIdx !== -1) {
          prevLines.slice(1).forEach(line => {
            const parts = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) { parts.push(current); current = ''; } else current += char;
            }
            parts.push(current);
            const key = `${parts[listIdx]}|${parts[nameIdx]}`;
            // Store full row as a header→value object
            const rowObj = {};
            prevHeaders.forEach((h, idx) => { rowObj[h] = parts[idx]; });
            persistenceMap.set(key, rowObj);
          });
        }
      }
    } catch (_error) { /* ignore */ }
  }

  const now = new Date().toISOString();
  const ledgerWithPersistence = ledgerRows.map(r => {
    const key = `${r.listKey}|${r.internalName}`;
    const prev = persistenceMap.get(key);
    const firstSeenAt = prev?.firstSeenAt || now;
    // Only bump lastSeenAt when structural fields have actually changed
    const lastSeenAt = (prev && !hasStructuralChange(prev, r)) ? prev.lastSeenAt : now;
    return { ...r, firstSeenAt, lastSeenAt };
  });

  // 4. Classify and Format
  const finalRows = ledgerWithPersistence.map(r => ({ ...r, ...classify(r, r.prov) }));

  // 5. Output
  writeCsv(join(OUT_DIR, 'drift-ledger.csv'), finalRows);
  writeMarkdown(join(OUT_DIR, 'drift-ledger.md'), finalRows);
  writeFileSync(join(OUT_DIR, 'drift-ledger.json'), JSON.stringify({
    version: 1,
    timestamp: now,
    rows: finalRows
  }, null, 2), 'utf8');

  console.log(`\n✅ Ledger generated at ${OUT_DIR}`);
}

function writeCsv(path, rows) {
  const headers = ['listKey', 'listTitle', 'fieldId', 'internalName', 'displayName', 'expectedField', 'actualField', 'driftType', 'candidatesMatched', 'usageCount', 'hasData', 'isIndexed', 'firstSeenAt', 'lastSeenAt', 'classification', 'confidence', 'evidence'];
  const content = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const val = r[h];
      return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(','))
  ].join('\n');
  writeFileSync(path, content);
}

function writeMarkdown(path, rows) {
  const headers = ['listKey', 'listTitle', 'internalName', 'displayName', 'driftType', 'classification', 'confidence', 'firstSeenAt', 'isIndexed', 'evidence'];
  const tableHeaders = `| ${headers.join(' | ')} |`;
  const tableDivider = `| ${headers.map(() => '---').join(' | ')} |`;
  const tableRows = rows.map(r => `| ${headers.map(h => h === 'confidence' ? `**${r[h]}**` : r[h]).join(' | ')} |`).join('\n');
  
  const content = `# Drift Ledger — ${new Date().toISOString().split('T')[0]}\n\n${tableHeaders}\n${tableDivider}\n${tableRows}\n`;
  writeFileSync(path, content);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
