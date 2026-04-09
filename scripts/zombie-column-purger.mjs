import { execSync } from 'child_process';

/**
 * SharePoint ゾンビ列一括削除スクリプト (zombie-column-purger.mjs)
 * Windows / macOS 兼用
 */

const WEB_URL = "https://isogokatudouhome.sharepoint.com/sites/welfare";
const DRY_RUN = process.argv.includes('--dry-run');

// 自動検知するリストとベースフィールド名の定義
const TARGET_MAP = {
  "SupportRecord_Daily": [
    "RecordDate", "ReporterName", "ReporterRole", "UserCount", "ApprovalStatus",
    "Record_x0020_Date", "Reporter_x0020_Name", "Reporter_x0020_Role", "User_x0020_Count"
  ],
  "Approval_Logs": [
    "ApprovalDate", "ApproverCode", "ApproveeCode", "Action", "Comment",
    "_x627f__x8a8d__x65e5__x6642_", "_x627f__x8a8d__x8005__x30b3__x30", "_x627f__x8a8d__x30a2__x30af__x30"
  ],
  "Diagnostics_Reports": [
    "Overall", "TopIssue", "SummaryText", "ReportLink", "Notified", "NotifiedAt"
  ],
  "DriftEventsLog": [
    "ListName", "FieldName", "DetectedAt", "Severity", "ResolutionType", "Resolved"
  ],
  "Schedules": [
    "EventDate", "EndDate", "Status", "ServiceType", "TargetUserId", "AssignedStaffId", "RowKey"
  ]
};

async function run() {
  console.log(`\n🚀 SharePoint ゾンビ列一括削除 (Purge) フェーズ開始 (${DRY_RUN ? 'DRY RUN' : '実実行'})\n`);

  // m365 CLI のコマンド判定 (Windows/Mac)
  const m365 = process.platform === 'win32' ? 'm365.cmd' : 'm365';

  let totalSuccess = 0;
  let totalFail = 0;

  for (const [listTitle, patterns] of Object.entries(TARGET_MAP)) {
    console.log(`\n--- リスト [${listTitle}] をスキャン中 ---`);
    
    let fields;
    try {
      const output = execSync(`${m365} spo field list --webUrl "${WEB_URL}" --listTitle "${listTitle}" -o json`, { 
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe']
      });
      fields = JSON.parse(output);
    } catch {
      console.error(`❌ リスト情報の取得に失敗: ${listTitle}`);
      continue;
    }

    for (const field of fields) {
      const internalName = field.InternalName;
      const isHidden = field.Hidden;
      const readOnly = field.ReadOnlyField;

      if (isHidden || readOnly) continue;

      // 判定ロジック:
      // 1. patterns にある名前 + 数字 (e.g. RecordDate0, Title1)
      // 2. _x0030_ 系 (数字のエンコード) を含む重複
      const isZombie = patterns.some(p => {
        // 例: RecordDate0, RecordDate1...
        const suffixMatch = new RegExp(`^${p}\\d+$`).test(internalName);
        // 例: RecordDate_x0030_
        const encodedMatch = new RegExp(`^${p}_x003\\d_`).test(internalName);
        return suffixMatch || encodedMatch;
      });

      if (isZombie) {
        if (DRY_RUN) {
          console.log(`[DRY-RUN] 削除候補: ${internalName} (${field.Title}) [ID: ${field.Id}]`);
          totalSuccess++;
        } else {
          process.stdout.write(`⚠️ 削除中: ${internalName} (${field.Title})... `);
          try {
            execSync(`${m365} spo field remove --webUrl "${WEB_URL}" --listTitle "${listTitle}" --id "${field.Id}" --force`, { stdio: 'ignore' });
            console.log('✅ 完了');
            totalSuccess++;
          } catch {
            console.log('❌ 失敗');
            totalFail++;
          }
        }
      }
    }
  }

  console.log(`\n--- 最終報告 ---`);
  console.log(`削除(候補)件数: ${totalSuccess}`);
  console.log(`失敗件数: ${totalFail}\n`);
  
  if (DRY_RUN) {
    console.log(`💡 DRY RUN が終了しました。物理的な削除を行うには '--dry-run' を外して実行してください。`);
  } else {
    console.log(`✨ クリーンアップが完了しました。物理制限(8KB)が緩和されているはずです。`);
  }
}

run().catch(_err => {
  console.error("致命的なエラーが発生しました:", _err);
  process.exit(1);
});
