import * as fs from 'fs';
import * as path from 'path';

// --- 1. Load Env ---
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [rawKey, ...rest] = trimmed.split('=');
      const key = rawKey.trim();
      if (key && rest.length > 0) {
        const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
}
loadEnvLocal();

async function main() {
  const args = process.argv.slice(2);
  const listKey = args.find((_, i) => args[i] === '--list') ? args[args.indexOf('--list') + 1] : null;
  const fieldName = args.find((_, i) => args[i] === '--field') ? args[args.indexOf('--field') + 1] : null;
  const isDryRun = args.includes('--dry-run');

  if (!listKey || !fieldName) {
    console.error('❌ Usage: npx tsx scripts/ops/index-remediate.ts --list <listKey> --field <fieldName> [--dry-run]');
    process.exit(1);
  }

  const { ensureConfig } = await import('../../src/lib/sp/config');
  const { SP_LIST_REGISTRY } = await import('../../src/sharepoint/spListRegistry');

  const token = process.env.SP_TOKEN || process.env.VITE_SP_TOKEN;
  if (!token && !isDryRun) {
    console.error("❌ SP_TOKEN is not set.");
    process.exit(1);
  }

  const config = ensureConfig();
  const apiBaseUrl = config.baseUrl;

  // Resolve list (Robust matching)
  const listDef = (SP_LIST_REGISTRY as any[]).find(l => 
    l.key.toLowerCase() === listKey.toLowerCase() || 
    l.key.replace(/_/g, '').toLowerCase() === listKey.replace(/_/g, '').toLowerCase()
  );

  if (!listDef) {
    console.error(`❌ List key "${listKey}" not found in registry.`);
    console.error(`Available keys: ${(SP_LIST_REGISTRY as any[]).map(l => l.key).join(', ')}`);
    process.exit(1);
  }

  const resolvedTitle = listDef.resolve();
  const listAccessor = resolvedTitle.startsWith('guid:') 
      ? `getbyid('${resolvedTitle.substring(5)}')` 
      : `getbytitle('${resolvedTitle}')`;

  console.log(`\n--- Index Remediation [${isDryRun ? 'DRY-RUN' : 'LIVE'}] ---`);
  console.log(`Target: ${listDef.displayName} (${resolvedTitle}) / Field: ${fieldName}`);

  if (isDryRun) {
    console.log(`[DRY-RUN] Action: Create index for field "${fieldName}" on list "${resolvedTitle}".`);
    console.log(`[DRY-RUN] Endpoint: POST ${apiBaseUrl}/lists/${listAccessor}/fields/getbyinternalnameortitle('${fieldName}')/Indexed`);
    console.log(`[DRY-RUN] Result: SUCCESS (Simulated)`);
    return;
  }

  // LIVE Remediation (Protected by explicit check)
  console.log(`\n⚠️ LIVE REMEDIATION STARTING...`);
  const url = `${apiBaseUrl}/lists/${listAccessor}/fields/getbyinternalnameortitle('${fieldName}')`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=nometadata',
      'X-HTTP-Method': 'MERGE',
    },
    body: JSON.stringify({ Indexed: true }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error(`❌ Failed to create index: ${res.status}`);
    console.error(error);
    process.exit(1);
  }

  console.log(`✅ Successfully created index for "${fieldName}" on "${resolvedTitle}".`);
}

main().catch((err) => {
  console.error('💥 index-remediate failed unexpectedly:', err);
  process.exit(1);
});
