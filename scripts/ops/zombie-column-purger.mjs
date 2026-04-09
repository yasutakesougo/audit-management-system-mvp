import { execSync } from 'child_process';

/**
 * SharePoint ゾンビ列一括削除ツール (v2.3: 運用OS 保守版)
 * 
 * [概要]
 * SharePoint リストの 8KB 行サイズ制限およびインデックス上限 (500 エラー) を
 * 回避するため、名前衝突により自動生成された不要な列（ゾンビ列）を特定し、
 * 外科的に一括削除します。
 * 
 * [強化点]
 * - 日本語名の UCS-2 エンコード形式 (_x[4桁]...) の前方一致パターン検知に対応
 * - 32文字 truncation (切断) による名前衝突パターンの検知
 * - 複数のリストを一括スキャン可能
 * 
 * [使い方]
 * node scripts/ops/zombie-column-purger.mjs          -- スキャンのみ (Dry Run)
 * node scripts/ops/zombie-column-purger.mjs --force  -- 実際に削除を実行
 */

const M365_PATH = "npx -y --package @pnp/cli-microsoft365 m365";
const WEB_URL = "https://isogokatudouhome.sharepoint.com/sites/welfare";
const DRY_RUN = !process.argv.includes('--force');

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

run().catch(err => {
  console.error("致命的なエラー:", err);
  process.exit(1);
});
