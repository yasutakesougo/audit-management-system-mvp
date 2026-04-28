import * as fs from 'fs';
import * as path from 'path';

// --- 1. Load Env FIRST ---
function loadEnv() {
  const root = process.cwd();
  const envFiles = ['.env', '.env.local'];
  
  for (const file of envFiles) {
    const envPath = path.resolve(root, file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [rawKey, ...rest] = trimmed.split('=');
        const key = rawKey.trim();
        if (key && rest.length > 0) {
          const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
          // local overrides base .env
          process.env[key] = val;
        }
      });
    }
  }
}
loadEnv();

type IndexPressureStatus = 'missing_index' | 'indexed_with_drift' | 'indexed';
type IndexPressureSeverity = 'ok' | 'watch' | 'action_required' | 'critical';

interface IndexPressureResult {
  kind: 'index_pressure';
  listKey: string;
  fieldName: string;
  status: IndexPressureStatus;
  severity: IndexPressureSeverity;
  fingerprint: string;
  summary: string;
  dryRunCommand: string;
}

interface IndexPressureReport {
  version: 1;
  timestamp: string;
  results: IndexPressureResult[];
}

const REPORT_DIR = path.resolve(process.cwd(), 'docs/nightly-patrol');
const OUTPUT_PATH = path.join(REPORT_DIR, 'index-pressure.json');

function buildResult(
  listKey: string,
  fieldName: string,
  status: IndexPressureStatus,
  driftPhysicalName?: string
): IndexPressureResult {
  const fingerprint = `index-pressure:${listKey}:${fieldName}`;
  const dryRunCommand = `npm run ops:index-remediate -- --list ${listKey} --field ${fieldName} --dry-run`;

  let severity: IndexPressureSeverity;
  let summary: string;
  switch (status) {
    case 'missing_index':
      severity = 'action_required';
      summary = `${listKey}.${fieldName} index is recommended but missing`;
      break;
    case 'indexed_with_drift':
      severity = 'watch';
      summary = `${listKey}.${fieldName} is indexed under drift candidate "${driftPhysicalName}"`;
      break;
    case 'indexed':
      severity = 'ok';
      summary = `${listKey}.${fieldName} is properly indexed`;
      break;
  }

  return {
    kind: 'index_pressure',
    listKey,
    fieldName,
    status,
    severity,
    fingerprint,
    summary,
    dryRunCommand,
  };
}

function writeReport(report: IndexPressureReport) {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n📊 Index pressure report written to ${OUTPUT_PATH}`);
}

// --- 2. Dynamic Import ---
async function main() {
  const isJson = process.argv.includes('--json');
  const { KNOWN_REQUIRED_INDEXED_FIELDS } = await import('../../src/features/sp/health/indexAdvisor/spIndexKnownConfig');
  const { ensureConfig } = await import('../../src/lib/sp/config');
  const { SP_LIST_REGISTRY } = await import('../../src/sharepoint/spListRegistry');

  const report: IndexPressureReport = {
    version: 1,
    timestamp: new Date().toISOString(),
    results: [],
  };

  const token = process.env.SP_TOKEN || process.env.VITE_SP_TOKEN;
  if (!token) {
    if (isJson) {
      console.log(JSON.stringify({ error: "SP_TOKEN is not set" }));
    } else {
      console.error("❌ SP_TOKEN is not set.");
    }
    writeReport(report);
    process.exit(1);
  }

  let config;
  try {
    config = ensureConfig();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      console.log(JSON.stringify({ error: `Config failed: ${msg}` }));
    } else {
      console.error(`❌ Configuration error: ${msg}`);
    }
    process.exit(1);
  }

  const apiBaseUrl = config.baseUrl;
  if (!isJson) {
    console.log("--- SharePoint Index Governance Audit (Drift-Aware Mode) ---");
  }

  const results: any[] = [];
  
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
      if (!isJson) console.log(`\n⚠️ Warning: No registry entry found for advisor list "${advisorTitle}". Skipping.`);
      continue;
    }

    const resolvedTitle = listDef.resolve();
    const listAccessor = resolvedTitle.startsWith('guid:') 
        ? `getbyid('${resolvedTitle.substring(5)}')` 
        : `getbytitle('${resolvedTitle}')`;

    if (!isJson) console.log(`\nList: ${listDef.displayName} (${resolvedTitle})`);
    
    // Fetch physical indexes
    const url = `${apiBaseUrl}/lists/${listAccessor}/fields?$filter=Indexed eq true&$select=InternalName,Title`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json;odata=nometadata',
      },
    });
    
    if (!res.ok) {
      if (!isJson) console.error(`  ❌ Failed to fetch indexes: ${res.status}`);
      continue;
    }
    
    const data = await res.json() as { value: { InternalName: string; Title: string }[] };
    const currentIndexedNames = new Set(data.value.map(f => f.InternalName));
    
    if (!isJson) console.log(`  Current Physical Indexes (${currentIndexedNames.size}/20)`);
    
    // REQUIRED Check with Drift-Awareness (checking candidates)
    const requiredSpecs = KNOWN_REQUIRED_INDEXED_FIELDS[advisorTitle] || [];
    const missingFields: string[] = [];
    const okFields: { internalName: string; physicalName: string; drifted: boolean }[] = [];

    if (!isJson) console.log(`  Governance Status:`);
    for (const spec of requiredSpecs) {
      const fieldDef = listDef.provisioningFields?.find((f: any) => f.internalName === spec.internalName);
      const candidates = fieldDef?.candidates || [spec.internalName];
      
      const foundPhysicalName = candidates.find((c: string) => currentIndexedNames.has(c));
      
      if (foundPhysicalName) {
        const isDrift = foundPhysicalName !== spec.internalName;
        const driftWarn = isDrift ? ` (Drift: ${foundPhysicalName})` : "";
        if (!isJson) console.log(`    ✅ ${spec.internalName}: OK${driftWarn}`);
        
        okFields.push({ internalName: spec.internalName, physicalName: foundPhysicalName, drifted: isDrift });
        report.results.push(
          buildResult(
            advisorTitle,
            spec.internalName,
            isDrift ? 'indexed_with_drift' : 'indexed',
            isDrift ? foundPhysicalName : undefined
          )
        );
      } else {
        if (!isJson) console.log(`    ❌ ${spec.internalName}: MISSING (Candidates: ${candidates.join(', ')})`);
        missingFields.push(spec.internalName);
        report.results.push(buildResult(advisorTitle, spec.internalName, 'missing_index'));
      }
    }

    if (isJson) {
      results.push({
        kind: "index_pressure",
        list: advisorTitle,
        displayName: listDef.displayName,
        status: missingFields.length > 0 ? "FAIL" : "PASS",
        indexCount: currentIndexedNames.size,
        missingIndexes: missingFields,
        okIndexes: okFields
      });
    }
  }

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
  }

  writeReport(report);
}

main().catch((err) => {
  console.error('💥 index-audit failed unexpectedly:', err);
});
