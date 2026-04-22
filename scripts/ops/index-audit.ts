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

// --- 2. Dynamic Import ---
async function main() {
  const { KNOWN_REQUIRED_INDEXED_FIELDS } = await import('../../src/features/sp/health/indexAdvisor/spIndexKnownConfig');
  const { ensureConfig } = await import('../../src/lib/sp/config');
  const { SP_LIST_REGISTRY } = await import('../../src/sharepoint/spListRegistry');

  const token = process.env.SP_TOKEN || process.env.VITE_SP_TOKEN;
  if (!token) {
    console.error("❌ SP_TOKEN is not set.");
    process.exit(1);
  }

  const config = ensureConfig();
  const apiBaseUrl = config.baseUrl;
  
  console.log("--- SharePoint Index Governance Audit (Drift-Aware Mode) ---");
  
  // Dynamic mapping: KNOWN_REQUIRED_INDEXED_FIELDS keys are List Titles (usually)
  // We need to find the registry entry that resolves to that title.
  const allAdvisorLists = Object.keys(KNOWN_REQUIRED_INDEXED_FIELDS);
  
  for (const advisorTitle of allAdvisorLists) {
    // Attempt to find registry entry by displayName or by resolving its title
    const listDef = (SP_LIST_REGISTRY as any[]).find(l => {
      // 1. Direct match with resolve()
      if (l.resolve() === advisorTitle) return true;
      // 2. Match with key (case insensitive-ish)
      if (l.key.toLowerCase() === advisorTitle.toLowerCase()) return true;
      // 3. Fallback to some common mappings if needed
      return false;
    });

    if (!listDef) {
      console.log(`\n⚠️ Warning: No registry entry found for advisor list "${advisorTitle}". Skipping.`);
      continue;
    }

    const resolvedTitle = listDef.resolve();
    const listAccessor = resolvedTitle.startsWith('guid:') 
        ? `getbyid('${resolvedTitle.substring(5)}')` 
        : `getbytitle('${resolvedTitle}')`;

    console.log(`\nList: ${listDef.displayName} (${resolvedTitle})`);
    
    // Fetch physical indexes
    const url = `${apiBaseUrl}/lists/${listAccessor}/fields?$filter=Indexed eq true&$select=InternalName,Title`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json;odata=nometadata',
      },
    });
    
    if (!res.ok) {
      console.error(`  ❌ Failed to fetch indexes: ${res.status}`);
      continue;
    }
    
    const data = await res.json() as { value: { InternalName: string; Title: string }[] };
    const currentIndexedNames = new Set(data.value.map(f => f.InternalName));
    
    console.log(`  Current Physical Indexes (${currentIndexedNames.size}/20)`);
    
    // REQUIRED Check with Drift-Awareness (checking candidates)
    const requiredSpecs = KNOWN_REQUIRED_INDEXED_FIELDS[advisorTitle] || [];
    
    console.log(`  Governance Status:`);
    for (const spec of requiredSpecs) {
      // Find field definition in registry to get candidates
      const fieldDef = listDef.provisioningFields?.find((f: any) => f.internalName === spec.internalName);
      const candidates = fieldDef?.candidates || [spec.internalName];
      
      // Check if ANY candidate is indexed
      const foundPhysicalName = candidates.find((c: string) => currentIndexedNames.has(c));
      
      if (foundPhysicalName) {
        const driftWarn = foundPhysicalName !== spec.internalName ? ` (Drift: ${foundPhysicalName})` : "";
        console.log(`    ✅ ${spec.internalName}: OK${driftWarn}`);
      } else {
        console.log(`    ❌ ${spec.internalName}: MISSING (Candidates: ${candidates.join(', ')})`);
      }
    }
  }
}

main().catch(console.error);
