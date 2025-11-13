// tools/generate-audit-checklist.mjs
// Usage: node tools/generate-audit-checklist.mjs [--year 2025] [--out dist/audit-checklist-2025.xlsx]
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import ExcelJS from 'exceljs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args =process.argv.slice(2);
const parsed = new Map();
for (let i = 0; i < args.length; i += 1) {
  const key = args[i];
  if (key.startsWith('--')) {
    parsed.set(key, args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '');
  }
}

const year = Number(parsed.get('--year')) || new Date().getFullYear();
const out = parsed.get('--out') || `audit-checklist-${year}.xlsx`;

const STATUS_VALIDATION = { type: 'list', allowBlank: true, formulae: ['"未,済"'], showErrorMessage: true };
const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
const headerFont = { bold: true };
const wrap = { wrapText: true };
const center = { horizontal: 'center', vertical: 'middle' };

function addSheet(wb, title, rows) {
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.addRows(rows);
  ws.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = center;
  });
  for (let r = 2; r <= ws.rowCount; r += 1) {
    ws.getRow(r).eachCell((cell) => {
      cell.alignment = wrap;
    });
  }
  ws.columns.forEach((column) => {
    let max = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const valueLength = cell.value ? cell.value.toString().length : 0;
      if (valueLength > max) {
        max = valueLength;
      }
    });
    column.width = Math.min(max + 2, 60);
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const headers = ws.getRow(1).values.reduce((acc, value, index) => {
    if (value) acc[value] = index;
    return acc;
  }, {});
  if (headers['状態']) {
    const columnLetter = ws.getColumn(headers['状態']).letter;
    ws.dataValidations.add(`${columnLetter}2:${columnLetter}${Math.max(200, ws.rowCount)}`, STATUS_VALIDATION);
  }
  return ws;
}

const workbook = new ExcelJS.Workbook();

addSheet(workbook, 'Overview', [
  ['項目', '内容'],
  ['レビュー年度', `${year} 年`],
  ['レビュー種別', '年次（または 半期/四半期）'],
  ['実施日', ''],
  ['実施者', ''],
  ['関係ドキュメント（リンク可）', 'docs/security/*, playbook.md など'],
  ['総括（所見）', ''],
  ['是正アクション（概要）', ''],
]);

addSheet(workbook, 'CSP & Web', [
  ['No', '項目', '内容', '状態', '担当', 'コメント'],
  ['CSP-01', 'CSPヘッダー（本番）', 'Content-Security-Policy が適切に設定されている', '', '', ''],
  ['CSP-02', 'CSP Report-Only（ステージング）', 'Report-Only 運用が計画どおり', '', '', ''],
  ['CSP-03', 'CSP違反レポート収集', 'violations.ndjson が収集・保管されている', '', '', ''],
  ['CSP-04', 'Playwright CSPガード', 'test-csp.yml が緑、違反0', '', '', ''],
  ['CSP-05', 'ヘッダー差分（本番/ステージング）', '差分理由と切替手順が docs に明記', '', '', ''],
]);

addSheet(workbook, 'MSAL・Auth', [
  ['No', '項目', '内容', '状態', '担当', 'コメント'],
  ['AUTH-01', 'MSAL ログインフロー（redirect）', 'VITE_MSAL_LOGIN_FLOW=redirect で安定運用', '', '', ''],
  ['AUTH-02', 'SPA Redirect URI 設定', 'Azure AD の SPA Redirect URI が dev/stg/prod で正しい', '', '', ''],
  ['AUTH-03', 'スコープと同意（admin consent）', 'VITE_MSAL_SCOPES（または /.default）が有効で同意済み', '', '', ''],
  ['AUTH-04', 'トークン保存（持続性/期間）', '永続保存を避け、最小限の保存ポリシーを遵守', '', '', ''],
  ['AUTH-05', 'CI/E2E の認証手順', 'Playwright でのサインイン手順が docs に明記', '', '', ''],
]);

addSheet(workbook, 'SharePoint', [
  ['No', '項目', '内容', '状態', '担当', 'コメント'],
  ['SP-01', 'サイト接続設定', 'VITE_SP_RESOURCE / VITE_SP_SITE_RELATIVE が正', '', '', ''],
  ['SP-02', 'リストスキーマ整合性', 'ScheduleEvents / Users / Staff などがコードと一致', '', '', ''],
  ['SP-03', '列名マッピング（内部名）', 'Category 等の内部名が .env と一致', '', '', ''],
  ['SP-04', 'インデックス/クエリ最適化', 'EventDate/EndDate にインデックスを設定', '', '', ''],
  ['SP-05', '権限（最小権限の原則）', 'AllSites.Read 等の権限が最小で運用', '', '', ''],
]);

addSheet(workbook, 'Data Protection', [
  ['No', '項目', '内容', '状態', '担当', 'コメント'],
  ['DP-01', 'データ分類表', 'docs/security/data-protection.md が最新', '', '', ''],
  ['DP-02', '保持期間ポリシー', 'SharePoint リスト保持期間が方針どおり', '', '', ''],
  ['DP-03', '削除プロセス（年次/自動）', 'Power Automate 等で削除処理が実装・実行', '', '', ''],
  ['DP-04', 'バックアップ設計', 'OneDrive/SharePoint バックアップの検証記録', '', '', ''],
  ['DP-05', 'アクセス権剥奪（退職/異動）', '退職者・異動者のアクセス無効化手順が完了', '', '', ''],
]);

addSheet(workbook, 'Incident・Log', [
  ['No', '項目', '内容', '状態', '担当', 'コメント'],
  ['LOG-01', 'インシデント対応手順', 'playbook.md の手順に従い訓練/実績あり', '', '', ''],
  ['LOG-02', '監査ログ（変更履歴）', '重要操作の監査ログが保持・確認できる', '', '', ''],
  ['LOG-03', '通報窓口・SLA', '通報連絡網・対応時間が明文化', '', '', ''],
  ['LOG-04', '再発防止・事後レビュー', 'ポストモーテムの記録と再発防止策が残る', '', '', ''],
]);

addSheet(workbook, 'Sign-off', [
  ['項目', '内容'],
  ['レビュー責任者', ''],
  ['承認日', ''],
  ['次回レビュー予定日', ''],
  ['備考', ''],
]);

const outPath = resolve(__dirname, '..', out);
await mkdir(dirname(outPath), { recursive: true });
await workbook.xlsx.writeFile(outPath);
console.log(`[ok] wrote ${outPath}`);
