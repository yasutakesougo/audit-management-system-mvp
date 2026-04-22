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
  const { runNightlyIndexRemediation } = await import('./nightly-index-remediation');
  const { ensureConfig } = await import('../../src/lib/sp/config');

  const token = process.env.SP_TOKEN || process.env.VITE_SP_TOKEN;
  if (!token) {
    console.error("❌ SP_TOKEN or VITE_SP_TOKEN is not set.");
    process.exit(1);
  }

  const config = ensureConfig();
  const siteUrl = `${config.resource}${config.siteRel}`;
  
  console.log("--- Targeted Index Remediation ---");
  console.log(`Site URL: ${siteUrl}`);
  
  const results = await runNightlyIndexRemediation({ token, siteUrl });
  
  console.log("\n--- Results ---");
  results.forEach(r => {
    const status = r.ok ? "✅" : "⚠️";
    console.log(`${status} [${r.listTitle}] ${r.internalName}: ${r.outcome} - ${r.message}`);
  });
}

main().catch(console.error);
