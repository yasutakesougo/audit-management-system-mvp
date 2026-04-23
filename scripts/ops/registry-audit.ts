import { ListKeys } from '../../src/sharepoint/fields/listRegistry';
import { SP_LIST_REGISTRY } from '../../src/sharepoint/spListRegistry';
import fs from 'node:fs';

/**
 * SharePoint Registry Static Audit
 * 
 * 役割: 
 * 1. ListKeys (enum) と SP_LIST_REGISTRY (definitions) の整合性確認
 * 2. 運用上必須なリスト (Essential Lists) の存在確認
 */

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.find(a => a.startsWith('--json-output='))?.split('=')[1];

  console.log('--- SharePoint Registry Static Audit ---');

  const registry = SP_LIST_REGISTRY;
  const errors: string[] = [];

  // 1. Enum と Registry の整合性
  const allPhysicalNamesInEnum = Object.values(ListKeys);
  const registeredPhysicalNames = registry.map(entry => entry.resolve());

  console.log(`Checking ${allPhysicalNamesInEnum.length} keys from ListKeys...`);

  for (const physicalName of allPhysicalNamesInEnum) {
    if (!registeredPhysicalNames.includes(physicalName)) {
      errors.push(`Missing registry definition for physical name: "${physicalName}"`);
    }
  }

  // 2. Essential Lists の存在確認 (運用クリティカルなもの)
  const ESSENTIAL_KEYS = [
    'users_master',
    'staff_master',
    'remediation_audit_log',
    'drift_events_log'
  ];

  console.log(`Checking ${ESSENTIAL_KEYS.length} essential keys...`);
  for (const key of ESSENTIAL_KEYS) {
    const entry = registry.find(e => e.key === key);
    if (!entry) {
      errors.push(`CRITICAL: Essential registry entry missing: "${key}"`);
    }
  }

  // 3. 結果出力
  const result = {
    success: errors.length === 0,
    timestamp: new Date().toISOString(),
    stats: {
      totalKeys: allPhysicalNamesInEnum.length,
      essentialKeys: ESSENTIAL_KEYS.length,
      errors: errors.length
    },
    errors
  };

  if (jsonOutput) {
    fs.writeFileSync(jsonOutput, JSON.stringify(result, null, 2));
    console.log(`JSON report saved to: ${jsonOutput}`);
  }

  if (errors.length > 0) {
    console.error('\n❌ Registry Audit Failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log('\n✅ Registry Audit Passed: All keys synchronized and essential lists present.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
