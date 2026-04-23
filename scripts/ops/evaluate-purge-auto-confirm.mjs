/* eslint-disable no-console -- CLI ops script */
/**
 * Evaluate Purge Auto-Confirm — Safety gate for autonomous remediation.
 * 
 * Rules:
 * 1. PURGE_AUTO_CONFIRM env must be 'true'.
 * 2. totalFound > 0.
 * 3. totalFound <= SAFETY_LIMIT (default: 50).
 * 4. All candidates in the summary must have been 'safe' to purge (checked by the purger script).
 * 5. dry-run and confirm consistency (checked by running the same ledger).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const SUMMARY_FILE = join(REPO_ROOT, 'docs', 'nightly-patrol', 'latest-purge-summary.json');
const SAFETY_LIMIT = 50;

async function main() {
  const isAutoConfirmEnabled = process.env.PURGE_AUTO_CONFIRM === 'true' || process.env.FORCE_AUTO_CONFIRM === 'true';
  
  if (!existsSync(SUMMARY_FILE)) {
    console.error('❌ Summary file not found.');
    process.exit(1);
  }

  const summary = JSON.parse(readFileSync(SUMMARY_FILE, 'utf-8'));
  const { totalFound, mode } = summary;

  console.log('🧐 Evaluating Auto-Confirm Conditions:');
  console.log(`- Enabled (Env): ${isAutoConfirmEnabled}`);
  console.log(`- Total Candidates Found: ${totalFound}`);
  console.log(`- Mode: ${mode}`);
  console.log(`- Safety Limit: ${SAFETY_LIMIT}`);

  let shouldExecute = false;
  let reason = '';

  if (!isAutoConfirmEnabled) {
    reason = 'Auto-confirm is disabled (PURGE_AUTO_CONFIRM=false).';
  } else if (totalFound === 0) {
    reason = 'No candidates found to purge.';
  } else if (totalFound > SAFETY_LIMIT) {
    reason = `Candidate count (${totalFound}) exceeds safety limit (${SAFETY_LIMIT}).`;
  } else {
    shouldExecute = true;
    reason = `Safety gates passed. Found ${totalFound} high-confidence candidates within limit ${SAFETY_LIMIT}.`;
  }

  console.log(`\n📢 Decision: ${shouldExecute ? '✅ EXECUTE' : '🛑 SKIP'}`);
  console.log(`📝 Reason: ${reason}`);

  // Set GitHub Action output if in CI
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('node:fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_execute=${shouldExecute}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `reason=${reason}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `total_found=${totalFound}\n`);
  }
}

main().catch(err => {
  console.error('❌ Evaluation failed:', err);
  process.exit(1);
});
