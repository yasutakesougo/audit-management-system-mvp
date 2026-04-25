/* eslint-disable no-console -- CLI ops script */
/**
 * Nightly Remediation Audit (Final Guarded Version)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');

function utcTodayStamp() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveM365() {
  try {
    const which = execSync('which m365', { encoding: 'utf8', stdio: 'pipe' }).trim();
    if (which) return which;
  } catch (_e) { /* ignore */ }
  return 'npx -y @pnp/cli-microsoft365';
}

function readJsonFile(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * m365 CLI を使って SharePoint にアイテムを追加する
 */
function logToSharePoint(entry) {
  const webUrl = "https://isogokatudouhome.sharepoint.com/sites/welfare";
  const listTitle = "RemediationAuditLog";

  const m365 = resolveM365();

  // フィールド名マッピング (x0020 は半角スペース)
  const fields = [
    `Title='${entry.phase}:${entry.planId}'`,
    `Correlation_x0020_ID='${entry.correlationId}'`,
    `Plan_x0020_ID='${entry.planId}'`,
    `Phase1='${entry.phase}'`,
    `List_x0020_Key1='${entry.listKey}'`,
    `Field_x0020_Name0='${entry.fieldName}'`,
    `Action1='${entry.action}'`,
    `Risk0='${entry.risk}'`,
    `Auto_x0020_Executable0=${entry.autoExecutable}`,
    `Requires_x0020_Approval0=${entry.requiresApproval}`,
    `Reason0='${entry.reason.replace(/'/g, "''")}'`,
    `Audit_x0020_Source0='nightly'`,
    `Audit_x0020_Timestamp0='${entry.timestamp.split('T')[0]}'`
  ];

  if (entry.executionStatus) {
    fields.push(`Execution_x0020_Status0='${entry.executionStatus}'`);
    if (entry.executionError) {
      fields.push(`Execution_x0020_Error0='${entry.executionError.replace(/'/g, "''")}'`);
    }
  }

  const cmd = `${m365} spo listitem add --webUrl "${webUrl}" --listTitle "${listTitle}" --${fields.join(' --')}`;
  
  try {
    console.log(`📡 Logging to SP [${entry.phase}]: ${entry.planId}`);
    execSync(cmd, { stdio: 'inherit', env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } });
  } catch (err) {
    console.error(`❌ Failed to log to SP: ${err.message}`);
  }
}

/**
 * 統治下での限定的自動実行 (Guarded Auto Execution)
 */
async function performAutoRemediation(plans) {
  const webUrl = "https://isogokatudouhome.sharepoint.com/sites/welfare";
  const MAX_AUTO_EXEC_PER_DAY = 5;

  console.log('\n🛡️  Starting Guarded Auto Remediation Stage...');

  // [Governance Policy Check] 
  const FORCE_BREACH = process.argv.includes('--force-slo-breach');
  
  // 本来は SP から全ログを取得して算出するが、ここでは簡易的に判定
  let autoRemediationAllowed = !FORCE_BREACH; // 正常時は true

  if (!autoRemediationAllowed) {
    const reason = FORCE_BREACH 
      ? 'SIMULATED SLO BREACH (Manual Test)' 
      : 'Operational quality below threshold (Success Rate/MTTR)';

    console.log(`🛑 SLO BREACH DETECTED: Auto-remediation is disabled by governance policy.`);
    console.log(`Reason: ${reason}`);

    for (const plan of plans) {
      logToSharePoint({
        ...plan,
        phase: 'skipped',
        reason: `SLO BREACHED: ${reason}. Kill-switch activated for safety.`,
        timestamp: new Date().toISOString()
      });
    }
    
    outputAccountabilityReport(plans, 0, alertLevelForBreach(FORCE_BREACH));
    return;
  }

  // 1. 限定対象の抽出 (safe かつ autoExecutable)
  const autoCandidates = plans.filter(p => p.risk === 'safe' && p.autoExecutable);
  const nonAutoCandidates = plans.filter(p => !p.autoExecutable);

  // 自動化対象外のものも理由を記録
  for (const plan of nonAutoCandidates) {
    logToSharePoint({
      ...plan,
      phase: 'skipped',
      reason: `Manual Review Required: Action [${plan.action}] requires human verification.`,
      timestamp: new Date().toISOString()
    });
  }

  if (autoCandidates.length === 0) {
    console.log('✅ No safe auto-remediation candidates found.');
    return;
  }

  // 2. 本日すでに行った自動実行件数をチェック（流量制限）
  let executedCount = 0;
  for (const plan of autoCandidates) {
    if (executedCount >= MAX_AUTO_EXEC_PER_DAY) {
      console.log(`⚠️ Daily limit reached (${MAX_AUTO_EXEC_PER_DAY}). Skipping.`);
      logToSharePoint({
        ...plan,
        phase: 'skipped',
        reason: `Skipped by Quota: Daily limit (${MAX_AUTO_EXEC_PER_DAY}) reached.`,
        timestamp: new Date().toISOString()
      });
      continue;
    }

    console.log(`🤖 Auto-executing: ${plan.planId} [${plan.action}] on ${plan.listKey} / ${plan.fieldName}`);
    
    const m365 = resolveM365();
    
    let success = false;
    try {
      if (plan.action === 'create_index' && plan.fieldName !== '(pending analysis)') {
        execSync(`${m365} spo field set --webUrl "${webUrl}" --listTitle "${plan.listKey}" --name "${plan.fieldName}" --indexed true`, { stdio: 'inherit' });
        success = true;
      } else if (plan.action === 'delete_index' && plan.fieldName !== '(pending analysis)') {
        execSync(`${m365} spo field set --webUrl "${webUrl}" --listTitle "${plan.listKey}" --name "${plan.fieldName}" --indexed false`, { stdio: 'inherit' });
        success = true;
      } else if (plan.action === 'delete_zombie') {
        // execute-zombie-purge.mjs を直接呼び出し
        execSync(`tsx scripts/ops/execute-zombie-purge.mjs --list="${plan.listKey}" --field="${plan.fieldName}" --confirm`, { stdio: 'inherit' });
        success = true;
      } else {
        console.log(`⏩ Action "${plan.action}" skipped: Detailed analysis required.`);
        logToSharePoint({
          ...plan,
          phase: 'skipped',
          reason: `Skipped: Requires manual analysis for action [${plan.action}].`,
          timestamp: new Date().toISOString()
        });
        continue;
      }

      if (success) {
        logToSharePoint({
          ...plan,
          phase: 'executed',
          executionStatus: 'success',
          timestamp: new Date().toISOString()
        });
        executedCount++;
      }
    } catch (err) {
      console.error(`❌ Auto-execution failed: ${err.message}`);
      logToSharePoint({
        ...plan,
        phase: 'executed',
        executionStatus: 'failed',
        executionError: err.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  outputAccountabilityReport(plans, executedCount);
}

function alertLevelForBreach(isSimulated) {
  return isSimulated ? 'WARNING (TEST)' : 'CRITICAL';
}

function outputAccountabilityReport(plans, executedCount, forcedLevel = null) {
  const successRate = executedCount > 0 ? (executedCount / plans.filter(p => p.autoExecutable).length || 1) : 1;
  const backlog = plans.length - executedCount;
  
  const alerts = [];
  let alertLevel = forcedLevel || (successRate < 0.8 && executedCount > 0 ? 'CRITICAL' : (backlog > 5 ? 'WARNING' : 'INFO'));

  if (alertLevel.includes('CRITICAL')) {
    alerts.push(`🚨 SLO BREACH: 修復成功率が目標を下回りました (${Math.round(successRate * 100)}% < 80%)。`);
  } else if (alertLevel.includes('WARNING')) {
    alerts.push(`⚠️ BACKLOG WARNING: 未対応案件が一定数を超えています (${backlog}件)。`);
  } else {
    alerts.push(`✅ SLO COMPLIANT: 運用品質は正常です。`);
  }

  console.log(`\n========================================`);
  console.log(`🤖 AUTO-REMEDIATION NIGHTLY REPORT [${alertLevel}]`);
  console.log(`========================================`);
  console.log(`Date:                  ${utcTodayStamp()}`);
  console.log(`Total Plans:           ${plans.length}`);
  console.log(`Executed:              ${executedCount}`);
  console.log(`Backlog:               ${backlog}`);
  console.log(`Success Rate:          ${Math.round(successRate * 100)}%`);
  console.log(`----------------------------------------`);
  alerts.forEach(a => console.log(a));
  console.log(`========================================\n`);
}

function generatePlans(adminSummary, driftLedger) {
  const date = utcTodayStamp();
  const plans = [];
  const now = new Date().toISOString();

  // 1. インデックス圧迫の検知
  const indexPressureIssue = adminSummary.topIssues?.find(issue => 
    issue.key === 'sp_index_pressure' || (issue.label && issue.label.includes('インデックス逼迫'))
  );

  if (indexPressureIssue) {
    const listNameMatch = indexPressureIssue.summary?.match(/\[([^\]]+)\]/);
    const listKey = listNameMatch ? listNameMatch[1] : (adminSummary.criticalListNames?.[0] || 'UnknownList');
    
    plans.push({
      correlationId: `nightly-idx-${date}-${listKey}`,
      planId: `nightly-idx-${date}-${listKey}`,
      listKey: listKey,
      fieldName: '(pending analysis)',
      action: 'delete_index',
      risk: 'safe',
      autoExecutable: false,
      requiresApproval: true,
      reason: `Nightly Patrol が [${listKey}] のインデックス逼迫を検知しました。管理画面での詳細分析が必要です。`,
      timestamp: now
    });
  }

  // 2. ゾンビ列の自動クリーンアップ候補 (keep-warn + high confidence)
  if (driftLedger && Array.isArray(driftLedger.rows)) {
    const highConfidenceZombies = driftLedger.rows.filter(r => 
      r.classification === 'keep-warn' && r.confidence === 'high'
    );

    for (const z of highConfidenceZombies.slice(0, 10)) { // 1回の実行で最大10件に制限
      plans.push({
        correlationId: `nightly-purge-${date}-${z.listKey}-${z.internalName}`,
        planId: z.fieldId || `zombie-${z.listKey}-${z.internalName}`,
        listKey: z.listKey,
        fieldName: z.internalName,
        action: 'delete_zombie',
        risk: 'safe',
        autoExecutable: true, // keep-warn 且つ high confidence なら自動実行対象とする
        requiresApproval: false,
        reason: `Institutionalized Purge: ${z.displayName || z.internalName} (tier: keep-warn)`,
        timestamp: now
      });
    }
  }

  // 3. スキーマドリフトの検知 (Manual Review)
  if (adminSummary.overall === 'fail' || adminSummary.overall === 'warn') {
    const listKey = adminSummary.criticalListNames?.[0];
    if (listKey) {
       plans.push({
         correlationId: `nightly-drift-${date}-${listKey}`,
         planId: `nightly-drift-${date}-${listKey}`,
         listKey: listKey,
         fieldName: '*',
         action: 'manual_remediation',
         risk: 'complex',
         autoExecutable: false,
         requiresApproval: true,
         reason: `Nightly Patrol が [${listKey}] の構造異常を検知しました。詳細分析が必要です。`,
         timestamp: now
       });
    }
  }

  return plans;
}

async function main() {
  const date = utcTodayStamp();
  const adminSummaryPath = path.join(REPORT_DIR, `admin-status-summary-${date}.json`);
  const adminSummary = readJsonFile(adminSummaryPath);
  
  const driftLedgerPath = path.join(REPORT_DIR, 'drift-ledger.json');
  const driftLedger = readJsonFile(driftLedgerPath);
  
  if (!adminSummary) {
    console.log(`⚠️ No admin status summary found for ${date}. Skipping.`);
    return;
  }

  const plans = generatePlans(adminSummary, driftLedger);
  if (plans.length === 0) {
    console.log(`✅ No remediation needed today.`);
    return;
  }

  console.log(`🚀 Found ${plans.length} potential remediation items.`);

  // Stage 1: Record all as planned
  for (const plan of plans) {
    logToSharePoint({ ...plan, phase: 'planned' });
  }

  // Stage 2: Attempt Guarded Auto Remediation for safe items
  await performAutoRemediation(plans);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
