import { loadEnvLocal } from './lib/envLoader';

// --- 1. Load Env FIRST ---
loadEnvLocal();

// --- 2. Main logic ---
async function main() {
  const { runNightlyIndexRemediation } = await import('./nightly-index-remediation');
  const { createCliSpFetch } = await import('./lib/spCliClient');

  console.log("--- Targeted Index Remediation ---");
  
  // NOTE:
  // This script intentionally scopes remediation to governance-critical lists
  // (UserBenefit_Profile, Iceberg_Analysis) to avoid accidental system-wide changes.
  // For full system remediation, use nightly-index-remediation.ts instead.
  
  // spCliClient automatically uses process.env.VITE_SP_TOKEN/URL
  const spFetch = createCliSpFetch();
  
  // We target specific lists relevant to the current governance focus
  const targetListTitles = ['UserBenefit_Profile', 'Iceberg_Analysis'];
  
  const results = await runNightlyIndexRemediation({ 
    spFetch,
    targetListTitles 
  });
  
  console.log("\n--- Results ---");
  results.forEach(r => {
    const status = r.ok ? "✅" : "⚠️";
    console.log(`${status} [${r.listTitle}] ${r.internalName}: ${r.outcome} - ${r.message}`);
  });
}

main().catch(console.error);
