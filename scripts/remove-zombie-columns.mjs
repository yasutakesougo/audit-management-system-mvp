import { execSync } from 'child_process';

/**
 * SharePoint ゾンビ列一括削除スクリプト (m365 CLI v11 + Apple Silicon 対応版)
 */

// which m365 で確認されたパスを使用します
const M365_PATH = "/opt/homebrew/bin/m365";
const WEB_URL = "https://isogokatudouhome.sharepoint.com/sites/welfare";
const DRY_RUN = process.argv.includes('--dry-run');

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
      "_x627f__x8a8d__x65e5__x6642_", 
      "_x627f__x8a8d__x8005__x30b3__x30", // 承認者コード（32文字切断対応）
      "_x627f__x8a8d__x30e1__x30e2_", 
      "_x627f__x8a8d__x30a2__x30af__x30"  // 承認アクション（32文字切断対応）
    ]
  }
];

async function run() {
  console.log(`\n🚀 SharePoint ゾンビ列救出フェーズ開始 (${DRY_RUN ? 'DRY RUN' : '実実行'})\n`);

  let successCount = 0;
  let failCount = 0;

  for (const target of TARGETS) {
    console.log(`--- リスト [${target.list}] をスキャン中 ---`);
    
    let fields;
    try {
      // フルパスを使用してコマンド実行
      const output = execSync(`${M365_PATH} spo field list --webUrl "${WEB_URL}" --listTitle "${target.list}" -o json`, { 
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe'] // 標準エラーもキャプチャ
      });
      fields = JSON.parse(output);
    } catch (err) {
      console.error(`❌ リスト情報の取得に失敗: ${target.list}`);
      if (err.stderr) console.error("Error Detail:", err.stderr.toString());
      continue;
    }

    for (const field of fields) {
      const internalName = field.InternalName;
      // ベース名 + 数字 で終わるゾンビ列を正規表現で判定
      const matchedPattern = target.patterns.find(p => new RegExp(`^${p}\\d+$`).test(internalName));
      
      if (matchedPattern) {
        if (DRY_RUN) {
          console.log(`[DRY-RUN] 削除候補発見: ${internalName} (${field.Title})`);
          successCount++;
        } else {
          process.stdout.write(`⚠️ 削除中: ${internalName} (${field.Title})... `);
          try {
            // フルパスを使用して削除コマンド実行
            execSync(`${M365_PATH} spo field remove --webUrl "${WEB_URL}" --listTitle "${target.list}" --id "${field.Id}" --force`, { stdio: 'ignore' });
            console.log('✅ 完了');
            successCount++;
          } catch (err) {
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
    console.log(`💡 DRY RUN が終了しました。物理的な削除を行うには '--dry-run' を外して実行してください。`);
  } else {
    console.log(`✨ クリーンアップが完了しました。アプリを再読み込みし、管理画面で整合結果を確認してください。`);
  }
}

run().catch(err => {
  console.error("致命的なエラーが発生しました:", err);
  process.exit(1);
});
