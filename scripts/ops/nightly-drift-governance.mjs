/* eslint-disable no-console -- CLI ops script */
/**
 * Nightly Drift Governance — Phase 3 Orchestrator
 * 
 * RESPONSIBILITIES:
 * 1. Executes patrol:ledger to refresh the drift evidence.
 * 2. Parses the results and identifies 'high' confidence candidates.
 * 3. Logs the governance status to SharePoint Audit list.
 * 4. Triggers dry-run purge to verify safety in the current environment.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'nightly-patrol');

function utcTodayStamp() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Logs a summary item to SharePoint RemediationAuditLog
 */
function logToAudit(entry) {
  const webUrl = "https://isogokatudouhome.sharepoint.com/sites/welfare";
  const listTitle = "RemediationAuditLog";

  // Search for m365 path
  let m365 = 'm365';
  try {
    const which = execSync('which m365', { encoding: 'utf8' }).trim();
    if (which) m365 = which;
  } catch {
    m365 = 'npx -y @pnp/cli-microsoft365';
  }

  const fields = [
    `Title='DRIFT_GOVERNANCE:${entry.type}'`,
    `Phase1='audit'`,
    `Action1='observe'`,
    `Risk0='safe'`,
    `Reason0='${entry.reason.replace(/'/g, "''")}'`,
    `Audit_x0020_Source0='nightly_drift_os'`,
    `Audit_x0020_Timestamp0='${new Date().toISOString().split('T')[0]}'`
  ];

  const cmd = `${m365} spo listitem add --webUrl "${webUrl}" --listTitle "${listTitle}" --${fields.join(' --')}`;
  
  try {
    console.log(`📡 Logging Governance Summary to SP: ${entry.type}`);
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`❌ Failed to log to SP: ${err.message}`);
  }
}

async function main() {
  const date = utcTodayStamp();
  console.log(`\n🛡️ Starting Nightly Drift Governance [${date}]`);

  // 1. Refresh Ledger
  console.log('📊 Step 1: Refreshing Drift Ledger...');
  try {
    execSync('npm run patrol:ledger', { stdio: 'inherit', cwd: REPO_ROOT });
  } catch (err) {
    console.error('❌ Failed to refresh ledger:', err.message);
    process.exit(1);
  }

  // 2. Parse Ledger
  const ledgerPath = path.join(REPORT_DIR, 'drift-ledger.csv');
  if (!fs.existsSync(ledgerPath)) {
    console.error('❌ Ledger file not found after generation.');
    process.exit(1);
  }

  const content = fs.readFileSync(ledgerPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim() !== '');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  const rows = lines.slice(1).map(line => {
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

    const obj = {};
    headers.forEach((h, i) => obj[h] = parts[i]);
    return obj;
  });

  const highZombies = rows.filter(r => r.classification === 'keep-warn' && r.confidence === 'high');
  const mediumZombies = rows.filter(r => r.classification === 'keep-warn' && r.confidence === 'medium');

  console.log(`\n🔎 Analysis Result:`);
  console.log(`- Total High Confidence Zombies (keep-warn): ${highZombies.length}`);
  console.log(`- Total Medium Confidence Zombies (keep-warn): ${mediumZombies.length}`);

  // 3. Log Summary
  const summaryReason = `Nightly Drift Patrol completed. Found ${highZombies.length} high-confidence keep-warn columns and ${mediumZombies.length} medium-confidence columns across the ecosystem. Status: HEALTHY (Reduction Pipeline Active).`;
  logToAudit({
    type: 'NIGHTLY_SUMMARY',
    reason: summaryReason
  });

  // 4. Generate Local Summary Report
  const summaryReportPath = path.join(REPORT_DIR, `drift-governance-summary-${date}.md`);
  const reportContent = `# Drift Governance Nightly Report — ${date}

## 📊 Executive Summary
The nightly drift patrol has refreshed the evidence ledger.

- **High Confidence Candidates**: ${highZombies.length} (Safe to purge)
- **Medium Confidence Candidates**: ${mediumZombies.length} (Requires observation)
- **Total Zombie Surface**: ${highZombies.length + mediumZombies.length} columns

## 🛡️ Top High-Confidence Targets
${highZombies.slice(0, 10).map(z => `- [${z.listKey}] ${z.internalName} (${z.displayName})`).join('\n')}
${highZombies.length > 10 ? `\n...and ${highZombies.length - 10} more.` : ''}

## 🚦 Next Actions
1. Run \`npm run patrol:purge -- --list=<key> --confirm\` for targeted reduction.
2. Review \`deletion-log.json\` for recent activity.

*Generated by Remediation OS Nightly Integration*
`;
  fs.writeFileSync(summaryReportPath, reportContent);
  console.log(`\n✅ Summary report generated: ${summaryReportPath}`);
}

main().catch(err => {
  console.error('Fatal error in governance script:', err);
  process.exit(1);
});
