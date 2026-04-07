/* eslint-disable no-console */

/**
 * Stage 5.0 Operational Run Script (Direct Execution)
 * 
 * Usage: npx vite-node src/features/sp/health/indexAdvisor/scripts/operational_run_attendance.ts
 */
import { createSpClient } from '../../../../../lib/spClient';
import { executeIndexRemediation } from '../spIndexRemediationService';
import { ensureConfig } from '../../../../../lib/sp/config';

async function main() {
  console.log('🚀 Starting Stage 5.0 Operational Run for AttendanceDaily...');

  // 1. Initial Setup
  const cfg = ensureConfig();
  const acquireToken = async () => null; // Mock token for dev/demo if needed
  const sp = createSpClient(acquireToken, cfg.baseUrl);

  const params = {
    listTitle: 'attendance_daily', // USE THE REGISTRY KEY
    internalName: 'RecordDate',
    action: 'create' as const,
  };

  console.log(`📡 Sending remediation request for: ${params.listTitle}.${params.internalName}`);

  // 2. Execution
  const result = await executeIndexRemediation(sp, params);

  // 3. Output results
  if (result.ok) {
    console.log('✅ SUCCESS: Remediation completed.');
    console.log(`📝 Message: ${result.message}`);
  } else {
    console.error('❌ FAILED: Remediation did not complete.');
    console.error(`📝 Message: ${result.message}`);
    process.exit(1);
  }

  console.log('🏁 Operational Run Finished.');
}

main().catch(err => {
  console.error('💥 UNEXPECTED ERROR:', err);
  process.exit(1);
});
