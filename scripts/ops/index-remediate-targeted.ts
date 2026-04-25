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

// --- 2. Dynamic Import ---
async function main() {
  const hasApply = process.argv.includes('--apply');
  const isDryRun = !hasApply || process.argv.includes('--dry-run'); // Default to dry-run
  
  // Extract --list value
  const listIdx = process.argv.indexOf('--list');
  const targetList = (listIdx !== -1 && process.argv[listIdx + 1]) ? process.argv[listIdx + 1] : null;

  const { runNightlyIndexRemediation } = await import('./nightly-index-remediation');
  const { ensureConfig } = await import('../../src/lib/sp/config');
  const { KNOWN_REQUIRED_INDEXED_FIELDS } = await import('../../src/features/sp/health/indexAdvisor/spIndexKnownConfig');

  const token = process.env.SP_TOKEN || process.env.VITE_SP_TOKEN;
  if (!token) {
    console.error("❌ SP_TOKEN or VITE_SP_TOKEN is not set.");
    process.exit(1);
  }

  const config = ensureConfig();
  const siteUrl = `${config.resource}${config.siteRel}`;
  
  console.log(`--- Targeted Index Remediation ${isDryRun ? '(DRY-RUN)' : '(APPLY)'} ---`);
  if (isDryRun && !hasApply) {
    console.log("ℹ️ Defaulting to DRY-RUN. Use --apply to execute changes.");
  }
  console.log(`Site URL: ${siteUrl}`);
  if (targetList) {
    console.log(`Filter: list="${targetList}"`);
    if (!KNOWN_REQUIRED_INDEXED_FIELDS[targetList]) {
      console.error(`❌ Target list "${targetList}" not found in governance config.`);
      process.exit(1);
    }
  }

  const results = await runNightlyIndexRemediation({ 
    token, 
    siteUrl, 
    dryRun: isDryRun,
    targetList: targetList || undefined,
  });
  
  console.log("\n--- Results ---");
  if (results.length === 0) {
    console.log("✅ No pending remediation actions found.");
  } else {
    results.forEach(r => {
      let status = "⚠️";
      if (r.outcome === 'added') status = "✅";
      if (r.outcome === 'dry_run_success') status = "🔍";
      
      console.log(`${status} [${r.listTitle}] ${r.internalName}: ${r.outcome} - ${r.message}`);
    });
  }

  if (isDryRun && results.some(r => r.outcome === 'dry_run_success')) {
    console.log("\n👉 To apply these changes, run:");
    const listCmd = targetList ? `--list "${targetList}" ` : "";
    console.log(`npx tsx scripts/ops/index-remediate-targeted.ts ${listCmd}--apply`);
  }
}

main().catch(console.error);
