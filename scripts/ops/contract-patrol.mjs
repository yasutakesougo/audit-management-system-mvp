/* eslint-disable no-console -- CLI ops script */
/**
 * contract-patrol.mjs
 * 
 * Core API 契約テストを実行し、Drift レポート (JSON) を出力します。
 * 失敗を「エラー」ではなく「観測データ」として扱うため、常に exit 0 で終了します。
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs/nightly-patrol');
const OUTPUT_PATH = path.join(REPORT_DIR, 'contract-drift.json');
const RAW_VITEST_PATH = path.join(REPORT_DIR, 'contract-patrol.raw.json');

// 監視対象の契約テスト
const CONTRACT_TARGETS = [
  'src/lib/spClient.contract.spec.ts',
  'src/app/config/__tests__/navigationConfig.contract.spec.ts',
  'src/features/users/infra/__tests__/DataProviderUserRepository.contract.spec.ts',
  'tests/contracts/dataProvider.contract.spec.ts'
];

async function run() {
  console.log('🔍 Running Core API Contract Patrol...');
  
  // 準備
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const report = {
    version: 1,
    timestamp: new Date().toISOString(),
    results: []
  };

  for (const target of CONTRACT_TARGETS) {
    const checkName = path.basename(target, '.spec.ts');
    console.log(`  Checking ${checkName}...`);
    
    let status = 'pass';
    let errorDetails = null;

    try {
      // Vitest を実行 (json レポーターで詳細を取得)
      // リポジトリ内の RAW_VITEST_PATH に出力
      execSync(`npx vitest run ${target} --reporter=json --outputFile=${RAW_VITEST_PATH}`, { 
        stdio: 'pipe',
        env: { ...process.env, CI: 'true' } 
      });
    } catch (error) {
      status = 'fail';
      
      // 失敗時は raw json から詳細を抽出
      try {
        if (fs.existsSync(RAW_VITEST_PATH)) {
          const raw = JSON.parse(fs.readFileSync(RAW_VITEST_PATH, 'utf8'));
          errorDetails = raw.testResults?.[0]?.assertionResults
            ?.filter(r => r.status === 'failed')
            .map(r => ({
              title: r.title,
              failureMessages: r.failureMessages
            }));
        }
      } catch (e) {
        errorDetails = `Failed to parse vitest results: ${e.message}`;
      }
    }

    report.results.push({
      kind: 'api_contract',
      name: checkName,
      status,
      severity: status === 'fail' ? 'action_required' : 'ok',
      fingerprint: `contract:${checkName}:${target}`,
      summary: status === 'fail' ? `${checkName} contract violation detected` : `${checkName} is stable`,
      targetFile: target,
      details: errorDetails,
      command: `npx vitest run ${target}`
    });
  }

  // Drift Report 出力
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');
  
  const failCount = report.results.filter(r => r.status === 'fail').length;
  if (failCount > 0) {
    console.log(`❌ Done. ${failCount} contract violations detected.`);
  } else {
    console.log(`✅ Done. All contracts are stable.`);
  }
  
  console.log(`📊 Reports written to ${REPORT_DIR}`);
  
  // Patrol は「観測」であるため、テストの成否に関わらず exit 0
  process.exit(0);
}

run().catch(err => {
  console.error('💥 Contract Patrol failed unexpectedly:', err);
  process.exit(1);
});
