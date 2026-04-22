/* eslint-disable no-console -- CLI ops script */
import { loadEnvLocal } from './lib/envLoader';


// --- 1. Load Env FIRST ---
loadEnvLocal();

// --- 2. Main logic ---
async function main() {
  const { createCliSpFetch } = await import('./lib/spCliClient');
  const { KNOWN_REQUIRED_INDEXED_FIELDS } = await import('@/features/sp/health/indexAdvisor/spIndexKnownConfig');
  const { SP_LIST_REGISTRY } = await import('@/sharepoint/spListRegistry');
  const { resolveListPath } = await import('@/lib/sp/helpers');

  const spFetch = createCliSpFetch();
  
  console.log("--- SharePoint Index Governance Audit (Drift-Aware Mode) ---");
  
  // Dynamic mapping: KNOWN_REQUIRED_INDEXED_FIELDS keys are List Titles (usually)
  // We need to find the registry entry that resolves to that title.
  const allAdvisorLists = Object.keys(KNOWN_REQUIRED_INDEXED_FIELDS);
  
  for (const advisorKey of allAdvisorLists) {
    // Attempt to find registry entry by key or by resolving its title
    const listDef = (SP_LIST_REGISTRY as any[]).find(l => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // 1. Match with key (preferred)
      if (l.key === advisorKey) return true;
      // 2. Direct match with resolve()
      if (l.resolve() === advisorKey) return true;
      return false;
    });

    if (!listDef) {
      console.log(`\n⚠️ Warning: No registry entry found for advisor list "${advisorKey}". Skipping.`);
      continue;
    }

    const resolvedTitle = listDef.resolve();
    const listAccessor = resolveListPath(resolvedTitle);

    console.log(`\nList: ${listDef.displayName} (${resolvedTitle})`);
    
    // We use spFetch which handles retries and telemetry automatically
    const url = `${listAccessor}/fields?$filter=Indexed eq true&$select=InternalName,Title`;
    
    try {
      const res = await spFetch(url);
      
      if (!res.ok) {
        console.error(`  ❌ Failed to fetch indexes: ${res.status}`);
        continue;
      }
      
      const data = await res.json() as { value: { InternalName: string; Title: string }[] };
      const currentIndexedNames = new Set(data.value.map(f => f.InternalName));
      
      console.log(`  Current Physical Indexes (${currentIndexedNames.size}/20)`);
      
      // REQUIRED Check with Drift-Awareness (checking candidates)
      const requiredSpecs = KNOWN_REQUIRED_INDEXED_FIELDS[advisorKey] || [];
      
      console.log(`  Governance Status:`);
      for (const spec of requiredSpecs) {
        // Find field definition in registry to get candidates
        const fieldDef = listDef.provisioningFields?.find((f: any) => f.internalName === spec.internalName); // eslint-disable-line @typescript-eslint/no-explicit-any
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
    } catch (err) {
      console.error(`  ❌ Failed to audit indices for ${advisorKey}:`, err instanceof Error ? err.message : String(err));
    }
  }
}

main().catch(console.error);
