/* eslint-disable no-console -- CLI ops script */
/**
 * Evaluate Purge Auto-Confirm — Safety gate for autonomous remediation.
 * 
 * Rules:
 * 1. ENABLE_ZOMBIE_PURGE_AUTO_EXECUTE env must be 'true'.
 * 2. totalFound > 0.
 * 3. totalFound <= SAFETY_LIMIT (default: 20).
 * 4. Individual Candidate Safeguards (via full ledger check):
 *    - NO essential fields.
 *    - NO registry canonical fields (must be 'zombie_candidate' classification).
 *    - Pattern match: Must have numeric suffix (e.g., Field0, Field_x0020_1).
 *    - hasData must be false.
 *    - usageCount must be 0.
 * 5. If any high-risk pattern is detected -> manual_required.
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const SUMMARY_FILE = join(REPO_ROOT, 'docs', 'nightly-patrol', 'latest-purge-summary.json');
const LEDGER_FILE = join(REPO_ROOT, 'docs', 'nightly-patrol', 'drift-ledger.csv');
const SAFETY_LIMIT = 20;
const SAFE_GRACE_PERIOD_HOURS = 24;

// Hard blocklist for auto-purge (even if not in registry)
const AUTO_PURGE_BLOCKLIST = [
  'Title', 'ID', 'Id', 'Created', 'Modified', 'Author', 'Editor', 'Attachments', 'GUID', 
  'ContentType', 'ContentTypeId', 'owshiddenversion', 'FileRef', 'FileLeafRef'
];

function parseCsv(content) {
  const lines = content.split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const parts = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'; i++;
        } else inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current); current = '';
      } else current += char;
    }
    parts.push(current);
    const row = {};
    headers.forEach((h, i) => row[h] = parts[i]);
    return row;
  });
}

async function main() {
  const isAutoExecuteEnabled = process.env.ENABLE_ZOMBIE_PURGE_AUTO_EXECUTE === 'true' || process.env.FORCE_AUTO_CONFIRM === 'true';
  
  if (!existsSync(SUMMARY_FILE) || !existsSync(LEDGER_FILE)) {
    console.error('❌ Required ledger or summary files not found.');
    process.exit(1);
  }

  const _summary = JSON.parse(readFileSync(SUMMARY_FILE, 'utf-8'));
  const ledger = parseCsv(readFileSync(LEDGER_FILE, 'utf-8'));
  
  // const { totalFound } = _summary;
  const candidates = ledger.filter(r => r.classification === 'zombie_candidate');

  console.log('🧐 Evaluating Guardian Auto-Purge Gates:');
  console.log(`- Auto-Execute Enabled: ${isAutoExecuteEnabled}`);
  console.log(`- Candidates Found: ${candidates.length}`);
  console.log(`- Safety Limit: ${SAFETY_LIMIT}`);

  let status = 'no_candidates';
  let shouldExecute = false;
  let reason = '';
  let blockedCount = 0;
  const manualCandidates = [];
  const observeOnlyCount = { recent: 0, first: 0 };

  if (candidates.length === 0) {
    status = 'no_candidates';
    reason = 'No zombie candidates identified in the current ledger.';
  } else if (candidates.length > SAFETY_LIMIT) {
    status = 'manual_required';
    reason = `Batch size (${candidates.length}) exceeds safety limit (${SAFETY_LIMIT}). Manual verification required.`;
  } else {
    // Individual safety check
    const verifiedCandidates = [];

    for (const c of candidates) {
      const isSystem = AUTO_PURGE_BLOCKLIST.includes(c.internalName) || c.internalName.startsWith('_');
      const isNumbered = /[0-9]+$/.test(c.internalName);
      const isZeroUsage = parseInt(c.usageCount || '0') === 0;
      const hasNoData = c.hasData === 'false';

      // 🛡️ Persistence Gates
      const firstSeen = new Date(c.firstSeenAt);
      const lastSeen = new Date(c.lastSeenAt);
      const ageHours = (lastSeen - firstSeen) / 3600000;
      const isFirstDetection = c.firstSeenAt === c.lastSeenAt;

      if (isSystem) {
        blockedCount++;
        continue; 
      }

      if (isFirstDetection) {
        observeOnlyCount.first++;
        continue;
      }

      if (ageHours < SAFE_GRACE_PERIOD_HOURS) {
        observeOnlyCount.recent++;
        continue;
      }

      if (isNumbered && isZeroUsage && hasNoData && c.confidence === 'high') {
        verifiedCandidates.push(c.internalName);
      } else {
        manualCandidates.push(c.internalName);
      }
    }

    if (blockedCount > 0) {
      console.log(`- ⚠️  Blocked ${blockedCount} system/protected fields.`);
    }
    if (observeOnlyCount.first > 0) {
      console.log(`- 👀 Observing ${observeOnlyCount.first} fields (First detection).`);
    }
    if (observeOnlyCount.recent > 0) {
      console.log(`- ⏳ Waiting for grace period: ${observeOnlyCount.recent} fields (<${SAFE_GRACE_PERIOD_HOURS}h old).`);
    }

    if (manualCandidates.length > 0) {
      status = 'manual_required';
      reason = `Some candidates require manual review (ambiguous pattern or low confidence): ${manualCandidates.join(', ')}`;
    } else if (verifiedCandidates.length === 0) {
      status = (observeOnlyCount.first > 0 || observeOnlyCount.recent > 0) ? 'observe_only' : 'no_candidates';
      reason = 'No persistent candidates ready for auto-purge yet.';
    } else if (!isAutoExecuteEnabled) {
      status = 'auto_confirmed';
      shouldExecute = false;
      reason = `Safety gates passed for ${verifiedCandidates.length} fields, but ENABLE_ZOMBIE_PURGE_AUTO_EXECUTE is false.`;
    } else {
      status = 'auto_confirmed';
      shouldExecute = true;
      reason = `Verified ${verifiedCandidates.length} persistent numbered zombies for auto-purge.`;
    }
  }

  console.log(`\n🛡️  Final Verdict: ${status.toUpperCase()}`);
  console.log(`📝 Reason: ${reason}`);

  // Set GitHub Action output if in CI
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `purge_status=${status}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `should_execute=${shouldExecute}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `reason=${reason}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `total_found=${candidates.length}\n`);
  }
}

main().catch(err => {
  console.error('❌ Evaluation failed:', err);
  process.exit(1);
});
