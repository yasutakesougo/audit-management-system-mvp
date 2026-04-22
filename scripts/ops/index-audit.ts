import * as fs from 'fs';
import * as path from 'path';

// --- 1. Load Env FIRST ---
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length > 0) {
        const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    });
  }
}
loadEnvLocal();

// --- 2. Dynamic Import to ensure env is ready ---
async function main() {
  const { KNOWN_REQUIRED_INDEXED_FIELDS } = await import('../../src/features/sp/health/indexAdvisor/spIndexKnownConfig');
  const { ensureConfig } = await import('../../src/lib/sp/config');
  const { SP_LIST_REGISTRY } = await import('../../src/sharepoint/spListRegistry');

  const token = process.env.SP_TOKEN || process.env.VITE_SP_TOKEN;
  if (!token || token === 'your_real_token_here') {
    console.error("❌ SP_TOKEN or VITE_SP_TOKEN is not set correctly.");
    process.exit(1);
  }

  const config = ensureConfig();
  const apiBaseUrl = config.baseUrl;
  
  const targetMap = [
    { advisorKey: 'UserBenefit_Profile', registryKey: 'user_benefit_profile' },
    { advisorKey: 'Iceberg_Analysis', registryKey: 'iceberg_analysis' }
  ];

  console.log("--- SharePoint Index Governance Audit ---");
  
  for (const { advisorKey, registryKey } of targetMap) {
    const listDef = (SP_LIST_REGISTRY as any[]).find(l => l.key === registryKey);
    if (!listDef) continue;

    const resolvedTitle = listDef.resolve();
    const listAccessor = resolvedTitle.startsWith('guid:') 
        ? `getbyid('${resolvedTitle.substring(5)}')` 
        : `getbytitle('${resolvedTitle}')`;

    console.log(`\nList: ${listDef.displayName} (${resolvedTitle})`);
    
    const url = `${apiBaseUrl}/lists/${listAccessor}/fields?$filter=Indexed eq true&$select=InternalName,Title`;
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json;odata=nometadata',
      },
    });
    
    if (!res.ok) {
      console.error(`  ❌ Failed: ${res.status}`);
      continue;
    }
    
    const data = await res.json() as { value: { InternalName: string; Title: string }[] };
    const currentIndexed = new Map(data.value.map(f => [f.InternalName, f.Title]));
    const required = KNOWN_REQUIRED_INDEXED_FIELDS[advisorKey] || [];
    
    console.log(`  Current Physical Indexes (${currentIndexed.size}/20):`);
    currentIndexed.forEach((title, name) => console.log(`    - ${name} (${title})`));
    
    console.log(`  Required by Design:`);
    required.forEach(f => {
      const status = currentIndexed.has(f.internalName) ? "✅" : "❌ (MISSING)";
      console.log(`    - ${f.internalName}: ${status} - ${f.reason}`);
    });
  }
}

main().catch(console.error);
