import { execSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * SharePoint ゾンビ列一括削除ツール (v2.4: 運用OS 保守版 + Audit レポート)
 *
 * [概要]
 * SharePoint リストの 8KB 行サイズ制限およびインデックス上限 (500 エラー) を
 * 回避するため、名前衝突により自動生成された不要な列（ゾンビ列）を特定し、
 * 外科的に一括削除します。
 *
 * [モード]
 * - 既定 (dry-run): 削除候補をコンソール出力のみ
 * - --force:        実際に削除を実行
 * - --audit:        read-only 棚卸しレポート生成 (CSV + Markdown)
 *                   childListSchemas.ts を SSOT として 5-tier 分類を行い、
 *                   管理者向け作業手順書を出力する。削除は一切行わない。
 *
 * [使い方]
 * node scripts/ops/zombie-column-purger.mjs                          -- スキャンのみ (Dry Run)
 * node scripts/ops/zombie-column-purger.mjs --force                  -- 実際に削除を実行
 * node scripts/ops/zombie-column-purger.mjs --audit                  -- 全3リストの棚卸しレポート
 * node scripts/ops/zombie-column-purger.mjs --audit --list=Approval_Logs
 * node scripts/ops/zombie-column-purger.mjs --audit --output-dir=artifacts/zombie-audit
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const M365_PATH = "npx -y --package @pnp/cli-microsoft365 m365";
const WEB_URL = "https://isogokatudouhome.sharepoint.com/sites/welfare";

// ── CLI flag parsing ─────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2);
const AUDIT_MODE = ARGS.includes('--audit');
const DRY_RUN = !ARGS.includes('--force');

function getFlagValue(name) {
  const prefix = `--${name}=`;
  const hit = ARGS.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const LIST_FILTER = getFlagValue('list');
const OUTPUT_DIR = getFlagValue('output-dir') || join(REPO_ROOT, 'artifacts', 'zombie-audit');
const SSOT_PATH = resolve(REPO_ROOT, 'src/sharepoint/fields/childListSchemas.ts');

// 保守対象リストと、その「正解」となる InternalName のプレフィックス
const TARGETS = [
  {
    list: "SupportRecord_Daily",
    patterns: [
      "Record_x0020_Date", "Reporter_x0020_Name", "Reporter_x0020_Role",
      "User_x0020_Count", "Latest_x0020_Version", "Approval_x0020_Status"
    ]
  },
  {
    list: "Approval_Logs",
    patterns: [
      "ApprovedBy", "ApprovedAt", "ApprovalNote", "ApprovalAction", "ParentScheduleId",
      "Approved_x0020_By", "Comment",
      "_x627f__x8a8d__x8005__x30b3__x30", // 承認者コード
      "_x627f__x8a8d__x8005__x540d_", // 承認者名
      "_x627f__x8a8d__x65e5__x6642_" // 承認日時
    ]
  },
  {
    list: "User_Feature_Flags",
    patterns: [
      "UserCode", "FlagKey", "FlagValue", "ExpiresAt",
      "_x30d5__x30e9__x30b0__x30ad__x30", // フラグキー
      "_x30d5__x30e9__x30b0__x5024_",    // フラグ値
      "_x6709__x52b9__x671f__x9650_"     // 有効期限
    ]
  },
  {
    list: "SupportProcedure_Results",
    patterns: [
      "ParentScheduleId", "ResultDate", "ResultStatus", "ResultNote", "StaffCode",
      "Status", "Comment", "CompletedAt", "ProcedureId" // 互換性・旧名の後始末用
    ]
  }
];

// ── SSOT loader ─────────────────────────────────────────────────────────────

/**
 * childListSchemas.ts を読み、リストタイトル → canonical internalName[] を抽出する。
 * 依存なし。textual parsing for zero-dep portability.
 */
function loadSsot(ssotPath) {
  const text = readFileSync(ssotPath, 'utf-8');

  // LIST_TITLE 定数の値を抽出: export const XXX_LIST_TITLE = 'YYY';
  const titleConsts = {};
  const titleRegex = /export const (\w+_LIST_TITLE)\s*=\s*'([^']+)'/g;
  let m;
  while ((m = titleRegex.exec(text)) !== null) {
    titleConsts[m[1]] = m[2];
  }

  // FIELDS 配列を抽出: export const XXX_FIELDS: SpFieldDef[] = [ ... ];
  // プレフィックス (RESULTS / APPROVAL_LOG / USER_FLAG) を LIST_TITLE 定数にマップ
  const prefixToTitleKey = {
    RESULTS: 'RESULTS_LIST_TITLE',
    APPROVAL_LOG: 'APPROVAL_LOGS_LIST_TITLE',
    USER_FLAG: 'USER_FLAGS_LIST_TITLE',
  };

  const ssot = {};
  const blockRegex = /export const (\w+)_FIELDS:\s*SpFieldDef\[\]\s*=\s*\[([\s\S]*?)\n\];/g;
  while ((m = blockRegex.exec(text)) !== null) {
    const prefix = m[1];
    const body = m[2];
    const titleKey = prefixToTitleKey[prefix];
    if (!titleKey) continue;
    const listTitle = titleConsts[titleKey];
    if (!listTitle) continue;

    const names = [];
    const nameRegex = /internalName:\s*'([^']+)'/g;
    let nm;
    while ((nm = nameRegex.exec(body)) !== null) {
      names.push(nm[1]);
    }
    ssot[listTitle] = names;
  }

  return ssot;
}

// ── Audit classification ────────────────────────────────────────────────────

const AUDIT_TIERS = {
  KEEP_SSOT: 'keep_ssot',
  KEEP_SYSTEM: 'keep_system',
  DRIFT_SUFFIX: 'drift_suffix',
  DRIFT_ENCODED: 'drift_encoded',
  LEGACY_UNKNOWN: 'legacy_unknown',
};

const ENCODED_PATTERN = /_x[0-9a-fA-F]{4}_/;

/**
 * 1 フィールドを 5 tier のいずれかに分類する。
 * 優先順: system > ssot > drift_suffix > drift_encoded > legacy_unknown
 */
function classifyField(field, canonicalNames) {
  const internalName = field.InternalName;
  const reasons = [];

  if (field.Hidden || field.ReadOnlyField || field.FromBaseType) {
    if (field.Hidden) reasons.push('Hidden=true');
    if (field.ReadOnlyField) reasons.push('ReadOnly=true');
    if (field.FromBaseType) reasons.push('FromBaseType=true');
    return { tier: AUDIT_TIERS.KEEP_SYSTEM, reason: reasons.join(', ') };
  }

  if (canonicalNames.includes(internalName)) {
    return { tier: AUDIT_TIERS.KEEP_SSOT, reason: 'Exact match with SSOT' };
  }

  for (const canonical of canonicalNames) {
    if (internalName.startsWith(canonical) && internalName !== canonical) {
      const suffix = internalName.slice(canonical.length);
      if (/^\d+$/.test(suffix)) {
        return {
          tier: AUDIT_TIERS.DRIFT_SUFFIX,
          reason: `Suffix-digit drift from "${canonical}" (suffix="${suffix}")`,
        };
      }
    }
  }

  if (ENCODED_PATTERN.test(internalName)) {
    return {
      tier: AUDIT_TIERS.DRIFT_ENCODED,
      reason: 'UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded',
    };
  }

  return {
    tier: AUDIT_TIERS.LEGACY_UNKNOWN,
    reason: 'Not in SSOT, not system, no drift pattern detected — requires manual review',
  };
}

function recommendedAction(tier) {
  switch (tier) {
    case AUDIT_TIERS.KEEP_SSOT:
    case AUDIT_TIERS.KEEP_SYSTEM:
      return 'KEEP';
    case AUDIT_TIERS.DRIFT_SUFFIX:
    case AUDIT_TIERS.DRIFT_ENCODED:
      return 'DELETE (auto-detected zombie)';
    case AUDIT_TIERS.LEGACY_UNKNOWN:
      return 'MANUAL_REVIEW';
    default:
      return 'MANUAL_REVIEW';
  }
}

// ── CSV / Markdown writers ──────────────────────────────────────────────────

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(filePath, rows) {
  const header = [
    'ListName', 'InternalName', 'DisplayName', 'TypeAsString',
    'Hidden', 'ReadOnly', 'FromBaseType', 'Indexed',
    'Classification', 'Reason', 'RecommendedAction',
  ].join(',');
  const lines = rows.map((r) => [
    r.listName, r.internalName, r.displayName, r.typeAsString,
    r.hidden, r.readOnly, r.fromBaseType, r.indexed,
    r.classification, r.reason, r.action,
  ].map(csvEscape).join(','));
  writeFileSync(filePath, [header, ...lines].join('\n') + '\n', 'utf-8');
}

function writeListMarkdown(filePath, listName, rows, scanTimestamp, ssotCommit) {
  const counts = rows.reduce((acc, r) => {
    acc[r.classification] = (acc[r.classification] || 0) + 1;
    return acc;
  }, {});
  const total = rows.length;
  const deletable = rows.filter((r) => r.classification === AUDIT_TIERS.DRIFT_SUFFIX || r.classification === AUDIT_TIERS.DRIFT_ENCODED);
  const manualReview = rows.filter((r) => r.classification === AUDIT_TIERS.LEGACY_UNKNOWN);
  const keepSsot = rows.filter((r) => r.classification === AUDIT_TIERS.KEEP_SSOT);
  const keepSystem = rows.filter((r) => r.classification === AUDIT_TIERS.KEEP_SYSTEM);

  const lines = [];
  lines.push(`# Zombie Column Audit — ${listName}`);
  lines.push('');
  lines.push(`**Scan timestamp**: ${scanTimestamp}`);
  lines.push(`**SSOT source**: \`src/sharepoint/fields/childListSchemas.ts\` @ ${ssotCommit}`);
  lines.push(`**Total fields on list**: ${total}`);
  lines.push('');
  lines.push('## Classification summary');
  lines.push('');
  lines.push('| Tier | Count |');
  lines.push('|---|---|');
  for (const tier of Object.values(AUDIT_TIERS)) {
    lines.push(`| \`${tier}\` | ${counts[tier] || 0} |`);
  }
  lines.push('');

  lines.push('## 🔴 Deletion candidates (auto-detected zombies)');
  lines.push('');
  if (deletable.length === 0) {
    lines.push('_None detected._');
  } else {
    lines.push('| InternalName | DisplayName | Type | Classification | Reason |');
    lines.push('|---|---|---|---|---|');
    for (const r of deletable) {
      lines.push(`| \`${r.internalName}\` | ${r.displayName} | ${r.typeAsString} | \`${r.classification}\` | ${r.reason} |`);
    }
    lines.push('');
    lines.push('### UI deletion path');
    lines.push('');
    lines.push(`1. SharePoint サイト: ${WEB_URL}`);
    lines.push(`2. リスト設定 → "${listName}" → 列`);
    lines.push('3. 上表の InternalName と一致する列をクリック → 削除');
    lines.push('4. ⚠️ **削除前に必ず `Hidden=false` / `ReadOnly=false` / `FromBaseType=false` であることを UI 側でも再確認**');
  }
  lines.push('');

  lines.push('## 🟡 Manual review required (legacy_unknown)');
  lines.push('');
  if (manualReview.length === 0) {
    lines.push('_None._');
  } else {
    lines.push('⚠️ SSOT にもドリフトパターンにも一致しない列です。削除前に必ず以下を確認してください:');
    lines.push('- 旧スキーマの残骸か、現役機能が参照しているか');
    lines.push('- `git log -S "<InternalName>"` で履歴を追跡');
    lines.push('- 管理者とユースケースを確認');
    lines.push('');
    lines.push('| InternalName | DisplayName | Type | Indexed |');
    lines.push('|---|---|---|---|');
    for (const r of manualReview) {
      lines.push(`| \`${r.internalName}\` | ${r.displayName} | ${r.typeAsString} | ${r.indexed} |`);
    }
  }
  lines.push('');

  lines.push('## 🟢 Keep list (do NOT delete)');
  lines.push('');
  lines.push(`### SSOT canonical columns (${keepSsot.length})`);
  lines.push('');
  if (keepSsot.length > 0) {
    lines.push('| InternalName | DisplayName | Type |');
    lines.push('|---|---|---|');
    for (const r of keepSsot) {
      lines.push(`| \`${r.internalName}\` | ${r.displayName} | ${r.typeAsString} |`);
    }
  }
  lines.push('');
  lines.push(`### System / built-in columns (${keepSystem.length})`);
  lines.push('');
  lines.push('_Hidden / ReadOnly / FromBaseType = true — SharePoint が管理する列。削除禁止。_');
  lines.push('');

  writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

function writeSummaryMarkdown(filePath, perList, scanTimestamp, ssotCommit) {
  const lines = [];
  lines.push('# Zombie Column Audit — Summary');
  lines.push('');
  lines.push(`**Scan timestamp**: ${scanTimestamp}`);
  lines.push(`**SSOT source**: \`src/sharepoint/fields/childListSchemas.ts\` @ ${ssotCommit}`);
  lines.push('');
  lines.push('## Per-list counts');
  lines.push('');
  lines.push('| List | Total | keep_ssot | keep_system | drift_suffix | drift_encoded | legacy_unknown |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const entry of perList) {
    const c = entry.counts;
    lines.push(`| [${entry.listName}](./${entry.listName}.md) | ${entry.total} | ${c.keep_ssot || 0} | ${c.keep_system || 0} | ${c.drift_suffix || 0} | ${c.drift_encoded || 0} | ${c.legacy_unknown || 0} |`);
  }
  lines.push('');
  lines.push('## Next steps');
  lines.push('');
  lines.push('1. Review each list\'s `.md` report and confirm the deletion candidates.');
  lines.push('2. For `legacy_unknown` rows, trace usage via `git log -S` before deciding.');
  lines.push('3. Once confirmed, either:');
  lines.push('   - Use the SharePoint UI to delete columns manually (safest), or');
  lines.push('   - Run `node scripts/ops/zombie-column-purger.mjs --force` (⚠️ deletes columns matching the hardcoded `TARGETS.patterns` — not the audit output).');
  lines.push('4. After deletion, re-run bootstrap and confirm `sp:provision_partial` no longer fires for these lists.');
  lines.push('');
  writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

// ── Audit runner ────────────────────────────────────────────────────────────

function getSsotCommit() {
  try {
    return execSync('git log -n 1 --pretty=format:%h -- src/sharepoint/fields/childListSchemas.ts', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function auditRun() {
  console.log(`\n🔍 SharePoint ゾンビ列棚卸しモード (read-only audit)\n`);

  const ssot = loadSsot(SSOT_PATH);
  const scanTimestamp = new Date().toISOString();
  const ssotCommit = getSsotCommit();

  console.log(`SSOT loaded from ${SSOT_PATH} @ ${ssotCommit}`);
  for (const [name, cols] of Object.entries(ssot)) {
    console.log(`  ${name}: ${cols.length} canonical columns`);
  }
  console.log('');

  const targetListNames = LIST_FILTER
    ? [LIST_FILTER]
    : Object.keys(ssot);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  const perList = [];

  for (const listName of targetListNames) {
    const canonicalNames = ssot[listName];
    if (!canonicalNames) {
      console.error(`⚠️ List "${listName}" not found in SSOT. Skipping.`);
      continue;
    }

    console.log(`--- Auditing [${listName}] ---`);

    let fields;
    try {
      const output = execSync(`${M365_PATH} spo field list --webUrl "${WEB_URL}" --listTitle "${listName}" -o json`, {
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe'],
      });
      fields = JSON.parse(output);
    } catch (err) {
      const message = err.stderr || err.message;
      console.error(`❌ Failed to fetch fields for "${listName}": ${message}`);
      continue;
    }

    const rows = fields.map((f) => {
      const classification = classifyField(f, canonicalNames);
      return {
        listName,
        internalName: f.InternalName,
        displayName: f.Title || '',
        typeAsString: f.TypeAsString || '',
        hidden: Boolean(f.Hidden),
        readOnly: Boolean(f.ReadOnlyField),
        fromBaseType: Boolean(f.FromBaseType),
        indexed: Boolean(f.Indexed),
        classification: classification.tier,
        reason: classification.reason,
        action: recommendedAction(classification.tier),
      };
    });

    const counts = rows.reduce((acc, r) => {
      acc[r.classification] = (acc[r.classification] || 0) + 1;
      return acc;
    }, {});

    console.log(`  Total fields: ${rows.length}`);
    for (const tier of Object.values(AUDIT_TIERS)) {
      console.log(`  ${tier.padEnd(16)}: ${counts[tier] || 0}`);
    }

    const safeName = listName.replace(/[^\w.-]/g, '_');
    const csvPath = join(OUTPUT_DIR, `${safeName}.csv`);
    const mdPath = join(OUTPUT_DIR, `${safeName}.md`);
    writeCsv(csvPath, rows);
    writeListMarkdown(mdPath, listName, rows, scanTimestamp, ssotCommit);
    console.log(`  ✅ CSV: ${csvPath}`);
    console.log(`  ✅ MD:  ${mdPath}\n`);

    perList.push({ listName, total: rows.length, counts });
  }

  if (perList.length > 0) {
    const summaryPath = join(OUTPUT_DIR, 'summary.md');
    writeSummaryMarkdown(summaryPath, perList, scanTimestamp, ssotCommit);
    console.log(`📋 Summary: ${summaryPath}`);
  }

  console.log(`\n✨ Audit complete. No modifications were made to SharePoint.\n`);
}

/**
 * ゾンビ判定ロジック:
 * 1. 正解の InternalName (p) と完全一致する場合は残す。
 * 2. p で始まり、かつ末尾が数字のみ（SharePoint が衝突回避で付与するもの）の場合はゾンビ。
 */
function isZombie(internalName, patterns) {
  for (const p of patterns) {
    if (internalName === p) continue;

    // 前方一致かつ、残りの部分が数字のみならゾンビ
    if (internalName.startsWith(p)) {
      const suffix = internalName.substring(p.length);
      if (suffix === "" || /^\d+$/.test(suffix)) {
        return true;
      }
    }
  }
  return false;
}

async function run() {
  console.log(`\n🚀 SharePoint ゾンビ列救出フェーズ開始 (${DRY_RUN ? 'DRY RUN' : '実実行 --force'})\n`);

  let successCount = 0;
  let failCount = 0;

  for (const target of TARGETS) {
    console.log(`--- リスト [${target.list}] をスキャン中 ---`);
    
    let fields;
    try {
      const output = execSync(`${M365_PATH} spo field list --webUrl "${WEB_URL}" --listTitle "${target.list}" -o json`, { 
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe']
      });
      fields = JSON.parse(output);
    } catch (err) {
      const message = err.stderr || err.message;
      console.error(`❌ リスト情報の取得に失敗: ${target.list}`);
      console.error(`   詳細: ${message}`);
      continue;
    }

    for (const field of fields) {
      const internalName = field.InternalName;
      
      if (isZombie(internalName, target.patterns)) {
        if (DRY_RUN) {
          console.log(`[DRY-RUN] 削除候補発見: ${internalName.padEnd(35)} (${field.Title})`);
          successCount++;
        } else {
          process.stdout.write(`⚠️ 削除中: ${internalName.padEnd(35)} (${field.Title})... `);
          try {
            execSync(`${M365_PATH} spo field remove --webUrl "${WEB_URL}" --listTitle "${target.list}" --id "${field.Id}" --force`, { stdio: 'ignore' });
            console.log('✅ 完了');
            successCount++;
          } catch {
            console.log('❌ 失敗');
            failCount++;
          }
        }
      }
    }
  }

  console.log(`\n--- 最終報告 ---`);
  console.log(`削除(候補)件数: ${successCount}`);
  console.log(`失敗件数: ${failCount}\n`);
  
  if (DRY_RUN) {
    console.log(`💡 DRY RUN が終了しました。物理的な削除を行うには '--force' を付けて実行してください。`);
  } else {
    console.log(`✨ クリーンアップが完了しました。ゴミ箱のパージを行い、アプリの安定性を確認してください。`);
  }
}

const entryPoint = AUDIT_MODE ? auditRun : run;
entryPoint().catch(err => {
  console.error("致命的なエラー:", err);
  process.exit(1);
});
