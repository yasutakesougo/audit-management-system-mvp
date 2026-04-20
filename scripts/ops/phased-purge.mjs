import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * Phased Purge Engine — Data Surgery for SharePoint Zombies
 * 
 * 1. Identifies fields by prefix
 * 2. Samples data to check usage
 * 3. Backups metadata (SchemaXml)
 * 4. Micro-batch deletion (Dry-run by default)
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../');

// Load .env manually to avoid shell expansion issues with long tokens
const loadEnv = (path) => {
  try {
    if (!existsSync(path)) {
      console.log(`   [DEBUG] File NOT found: ${path}`);
      return;
    }
    console.log(`   [DEBUG] Loading: ${path}`);
    const content = readFileSync(path, 'utf8');
    console.log(`   [DEBUG] File size: ${content.length} chars`);
    content.split('\n').forEach(line => {
      if (!line.trim() || line.startsWith('#')) return;
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  } catch (e) { console.log(`   [DEBUG] Error loading ${path}: ${e.message}`); }
};

loadEnv(resolve(REPO_ROOT, '.env.local'));
loadEnv(resolve(REPO_ROOT, 'artifacts/purge-backups/.env.purge'));

console.log('   [ENV] Keys loaded:', Object.keys(process.env).filter(k => k.includes('VITE_SP')));

// Debug check
if (!process.env.VITE_SP_SITE_URL && process.env.SP_SITE_URL) process.env.VITE_SP_SITE_URL = process.env.SP_SITE_URL;
if (!process.env.VITE_SP_TOKEN && process.env.SMOKE_TEST_BEARER_TOKEN) process.env.VITE_SP_TOKEN = process.env.SMOKE_TEST_BEARER_TOKEN;

const ARGS = process.argv.slice(2);
const flagValue = (name) => {
  const prefix = `--${name}=`;
  const hit = ARGS.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = ARGS.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < ARGS.length && !ARGS[idx + 1].startsWith('--')) {
    return ARGS[idx + 1];
  }
  return null;
};

// Config
const LIST_TITLE = flagValue('list');
const PREFIX = flagValue('prefix');
const BATCH_SIZE = parseInt(flagValue('batch') || '5', 10);
const SAMPLE_SIZE = parseInt(flagValue('sample-size') || '100', 10);
const BACKUP_DIR = flagValue('backup-out') || join(REPO_ROOT, 'artifacts', 'purge-backups');
const IS_DRY_RUN = ARGS.includes('--dry-run');
const IS_EXECUTE = ARGS.includes('--execute');

const SITE_URL = process.env.VITE_SP_SITE_URL || process.env.SP_SITE_URL;
const TOKEN_FILE = join(REPO_ROOT, '.token.local');
let TOKEN = '';
try {
  TOKEN = readFileSync(TOKEN_FILE, 'utf-8').trim();
} catch (e) {
  TOKEN = (process.env.VITE_SP_TOKEN || process.env.SMOKE_TEST_BEARER_TOKEN || '').trim();
}

if (!TOKEN) {
  console.error('❌ No valid token found in .token.local or environment.');
  process.exit(1);
}

if (!LIST_TITLE || !PREFIX) {
  console.error('❌ Missing --list <title> or --prefix <prefix>.');
  process.exit(1);
}

if (!SITE_URL || !TOKEN) {
  console.error('❌ Missing credentials (VITE_SP_SITE_URL / VITE_SP_TOKEN).');
  process.exit(1);
}

// Credentials logging removed for security.

const spHeaders = {
  'Accept': 'application/json;odata=nometadata',
  'Content-Type': 'application/json;odata=verbose',
  'Authorization': `Bearer ${TOKEN}`,
};

// ── Service Helpers ─────────────────────────────────────────────────────────

async function spRequest(url, method = 'GET') {
  const response = await fetch(`${SITE_URL}${url}`, {
    method,
    headers: {
      ...spHeaders,
      ...(method === 'DELETE' ? { 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' } : {}),
    },
  });

  if (!response.ok) {
    if (response.status === 204) return null; // No Content is OK for DELETE
    const errorText = await response.text();
    throw new Error(`SP Request Failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  if (method === 'DELETE' || response.status === 204) return null;
  const json = await response.json();
  return json; // odata=nometadata doesn't have .d
}

async function fetchAllFields(listTitle) {
  const url = `/_api/web/lists/GetByTitle('${encodeURIComponent(listTitle)}')/Fields`;
  const data = await spRequest(url);
  // odata=nometadata uses 'value' instead of 'd.results'
  const items = data.value || data.results || [];
  return items.map(f => ({
    InternalName: f.InternalName,
    Title: f.Title,
    StaticName: f.StaticName,
    Id: f.Id,
    SchemaXml: f.SchemaXml,
    Hidden: f.Hidden,
    FromBaseType: f.FromBaseType,
  }));
}

async function sampleFieldUsage(listTitle, fieldNames, limit) {
  if (fieldNames.length === 0) return [];
  
  const CHUNK_SIZE = 15; // Safe limit for select fields in URL
  const resultsByItem = {}; // ID -> Combined Item Object

  for (let i = 0; i < fieldNames.length; i += CHUNK_SIZE) {
    const chunk = fieldNames.slice(i, i + CHUNK_SIZE);
    const select = ['ID', ...chunk].join(',');
    const url = `/_api/web/lists/GetByTitle('${encodeURIComponent(listTitle)}')/items?$select=${select}&$top=${limit}`;
    
    const chunkData = await spRequest(url);
    const items = chunkData.value || chunkData.results || [];
    
    items.forEach(item => {
      if (!resultsByItem[item.ID]) {
        resultsByItem[item.ID] = { ID: item.ID };
      }
      Object.assign(resultsByItem[item.ID], item);
    });
  }

  return Object.values(resultsByItem);
}

// ── Core Logic ─────────────────────────────────────────────────────────────

async function main() {
  const modeLabel = IS_EXECUTE ? 'EXECUTE' : 'DRY-RUN';
  console.log(`🏥 Phased Purge Engine — Mode: ${modeLabel}`);
  console.log(`   Prefix: ${PREFIX}`);

  // Test request
  try {
    const web = await spRequest('/_api/web?$select=Title');
    console.log(`   [DEBUG] Connected to site: ${web.Title}`);
  } catch (err) {
    console.error('❌ Connectivity test failed.');
    throw err;
  }

  // 1. Get Matching Fields
  const allFields = await fetchAllFields(LIST_TITLE);
  
  // Safety Prioritization Rule:
  // - Pure Prefix or Prefix + "0" are RISKY (Tier 2/3)
  // - Prefix + [1-9][0-9]* are LIKELY ZOMBIES (Tier 1)
  const allCandidates = allFields.filter(f => 
    f.InternalName.startsWith(PREFIX) && 
    !f.Hidden && 
    !f.FromBaseType
  );

  // Sorting: 1 to 99 first, then keep bare prefix and 0 for last
  const tier1 = []; // ...Numbe1 to ...Numbe99
  const tier2 = []; // ...Numbe0 or ...Numbe
  
  allCandidates.forEach(f => {
    const suffix = f.InternalName.slice(PREFIX.length);
    if (/^[1-9][0-9]*$/.test(suffix)) {
      tier1.push({ ...f, suffixValue: parseInt(suffix, 10) });
    } else {
      tier2.push(f);
    }
  });

  // Sort Tier 1 descending (99, 98...) to be extra safe
  tier1.sort((a, b) => b.suffixValue - a.suffixValue);
  
  const candidates = [...tier1, ...tier2];
  const highSafetyCandidates = tier1;

  console.log(`   Scanned: ${allFields.length} fields. Found ${tier1.length} Tier-1 (Safe), ${tier2.length} Tier-2/3 (Reserved).`);

  if (candidates.length === 0) {
    console.log('✅ No candidate fields found. Surgery complete or prefix incorrect.');
    return;
  }

  // 2. Usage Analysis
  console.log(`🔍 Analyzing usage (sampleSize=${SAMPLE_SIZE})...`);
  const samples = await sampleFieldUsage(LIST_TITLE, candidates.map(f => f.InternalName), SAMPLE_SIZE);
  const usageStats = candidates.map(field => {
    const nonNullCount = samples.filter(s => s[field.InternalName] !== null && s[field.InternalName] !== undefined).length;
    return {
      ...field,
      nonNullCount,
      sampleCount: samples.length,
      usageRate: samples.length > 0 ? (nonNullCount / samples.length) : 0,
      status: nonNullCount > 0 ? 'active' : 'zombie-candidate',
      isTier1: tier1.some(t => t.InternalName === field.InternalName)
    };
  });

  const zombies = usageStats.filter(s => s.status === 'zombie-candidate' && s.isTier1);
  const activeCount = usageStats.length - usageStats.filter(s => s.status === 'zombie-candidate').length;

  console.log(`   📊 Stats: active=${activeCount}, zombie-candidate (Tier-1)=${zombies.length}`);

  if (zombies.length === 0) {
    if (tier2.length > 0) {
      console.log('\n⚠️ Tier-1 zombies exhausted. Reserved columns (bare prefix or suffix 0) remain.');
      console.log('   Surgical pause required for manual deep-audit of reserved columns.');
    } else {
      console.log('✅ All matching fields have data. No purge candidates identified.');
    }
    return;
  }

  // 3. Selection for current batch (Restricted to Tier 1 ONLY)
  const targetBatch = zombies.slice(0, BATCH_SIZE);
  console.log(`\n📋 Current Batch Candidates (Tier-1 Only, max ${BATCH_SIZE}):`);
  targetBatch.forEach(z => {
    console.log(`   [-] ${z.InternalName} (Id: ${z.Id})`);
  });

  // 4. Backup
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `${LIST_TITLE}-${stamp}.json`);
  const backupData = {
    listTitle: LIST_TITLE,
    timestamp: new Date().toISOString(),
    fields: targetBatch,
    mode: modeLabel
  };
  writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`\n💾 Backup generated: ${backupPath}`);

  // 5. Execution
  if (IS_EXECUTE && !IS_DRY_RUN) {
    console.log(`\n🚀 EXECUTING PURGE (${targetBatch.length} columns)...`);
    for (const field of targetBatch) {
      process.stdout.write(`   Deleting ${field.InternalName}... `);
      try {
        await spRequest(`/_api/web/lists/GetByTitle('${LIST_TITLE}')/Fields/GetByInternalNameOrTitle('${field.InternalName}')`, 'DELETE');
        console.log('✅ SUCCESS');
      } catch (err) {
        console.log('❌ FAILED');
        console.error(`\nError deleting ${field.InternalName}:`, err.message);
        console.error('Surgery halted to prevent corruption.');
        process.exit(1);
      }
    }
    console.log('\n✅ Batch execution complete.');
  } else {
    console.log('\n⚠️ [DRY-RUN] No changes were made to SharePoint.');
    console.log(`   To execute, rerun with --execute instead of --dry-run.`);
  }

  if (zombies.length > BATCH_SIZE) {
    console.log(`\n💡 ${zombies.length - BATCH_SIZE} more zombies remaining. Run again for next batch.`);
  }
}

main().catch(err => {
  console.error('\n💥 Critical Error:', err.message);
  process.exit(1);
});
