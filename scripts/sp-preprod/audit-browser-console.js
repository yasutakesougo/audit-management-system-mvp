/* eslint-disable no-console, no-undef, no-restricted-globals */
/**
 * SP List Audit — Browser Console Script
 *
 * 使い方:
 *   1. https://isogokatudouhome.sharepoint.com/sites/welfare を Chrome/Edge で開く
 *   2. F12 → コンソールタブ
 *   3. このスクリプト全体をコピー → コンソールに貼り付け → Enter
 *   4. 結果がコンソールに表示される（JSON キャプチャ可能）
 *
 * ※ CSP 制限で fetch が弾かれる場合は _spPageContextInfo.webAbsoluteUrl が
 *    正しいサイトURLを指しているか確認してください。
 */

(async () => {

  // ── manifest (インライン版) ────────────────────────────────────────────────
  // lists.manifest.json の lists 配列をここに貼ります（ファイルから自動生成）

  const MANIFEST_LISTS = [
    { listTitle: "Users_Master",                 indexes: [{ field: "UserID", unique: true }, { field: "IsActive", unique: false }] },
    { listTitle: "Holiday_Master",               indexes: [{ field: "Date", unique: false }, { field: "FiscalYear", unique: false }] },
    { listTitle: "SupportTemplates",             indexes: [{ field: "UserCode0", unique: false }] },
    { listTitle: "Schedules",                    indexes: [{ field: "cr014_dayKey", unique: false }, { field: "MonthKey", unique: false }, { field: "RowKey", unique: false }, { field: "cr014_personId", unique: false }] },
    { listTitle: "DailyActivityRecords",         indexes: [{ field: "UserCode", unique: false }, { field: "RecordDate", unique: false }] },
    { listTitle: "SupportProcedureRecord_Daily", indexes: [{ field: "UserCode", unique: false }, { field: "RecordDate", unique: false }, { field: "PlanningSheetId", unique: false }] },
    { listTitle: "ISP_Master",                   indexes: [{ field: "UserCode", unique: false }, { field: "IsCurrent", unique: false }] },
    { listTitle: "SupportPlanningSheet_Master",  indexes: [{ field: "UserCode", unique: false }, { field: "ISPId", unique: false }, { field: "IsCurrent", unique: false }] },
    { listTitle: "SupportPlans",                 indexes: [] },
    { listTitle: "PlanGoal",                     indexes: [] },
    { listTitle: "MeetingMinutes",               indexes: [] },
    { listTitle: "Staff_Attendance",             indexes: [] },
    { listTitle: "AttendanceUsers",              indexes: [{ field: "UserCode", unique: false }, { field: "IsActive", unique: false }] },
    { listTitle: "AttendanceDaily",              indexes: [] },
    { listTitle: "Daily_Attendance",             indexes: [] },
    { listTitle: "Transport_Log",                indexes: [{ field: "UserCode", unique: false }, { field: "RecordDate", unique: false }] },
    { listTitle: "Iceberg_PDCA",                 indexes: [] },
    { listTitle: "Iceberg_Analysis",             indexes: [{ field: "EntryHash", unique: true }, { field: "SessionId", unique: false }, { field: "UserId", unique: false }] },
    { listTitle: "Compliance_CheckRules",        indexes: [] },
    { listTitle: "Diagnostics_Reports",          indexes: [] },
    { listTitle: "FormsResponses_Tokusei",       indexes: [] },
    { listTitle: "NurseObservations",            indexes: [] },
    { listTitle: "PdfOutput_Log",               indexes: [] },
    { listTitle: "CallLogs",                     indexes: [{ field: "ReceivedAt", unique: false }, { field: "Status", unique: false }] },
  ];

  // ── ヘルパー ───────────────────────────────────────────────────────────────
  const siteUrl = (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo.webAbsoluteUrl)
    || 'https://isogokatudouhome.sharepoint.com/sites/welfare';

  const headers = {
    'Accept': 'application/json;odata=nometadata',
    'Content-Type': 'application/json;odata=nometadata',
  };

  async function apiFetch(endpoint) {
    const res = await fetch(`${siteUrl}/_api/${endpoint}`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${endpoint}`);
    return res.json();
  }

  // ── SP リスト一覧取得 ─────────────────────────────────────────────────────
  console.log('%c[AUDIT] Fetching SP list inventory...', 'color: cyan');
  const listsData = await apiFetch('web/lists?$select=Title,Hidden&$filter=Hidden eq false');
  const spListTitles = new Set(listsData.value.map(l => l.Title));
  console.log(`%c[AUDIT] ${spListTitles.size} lists found in SP`, 'color: cyan');

  // ── 監査 ──────────────────────────────────────────────────────────────────
  const results = [];

  for (const listDef of MANIFEST_LISTS) {
    const title = listDef.listTitle;

    // 1. リスト存在チェック
    if (!spListTitles.has(title)) {
      console.warn(`[MISSING/List] ${title}`);
      results.push({ list: title, category: 'Missing', sub: 'List', field: '', message: `List "${title}" not found in SP` });
      continue;
    }

    console.log(`%c[OK] List exists: ${title}`, 'color: green');

    // 2. フィールド・インデックス取得
    let fields;
    try {
      const fd = await apiFetch(
        `web/lists/getbytitle('${encodeURIComponent(title)}')/fields?$select=InternalName,Indexed,EnforceUniqueValues`
      );
      fields = new Map(fd.value.map(f => [f.InternalName, f]));
    } catch (e) {
      console.error(`[ERROR] Failed to fetch fields for ${title}:`, e.message);
      results.push({ list: title, category: 'Error', sub: 'FieldFetch', field: '', message: e.message });
      continue;
    }

    // 3. インデックス・ユニーク監査
    for (const idx of (listDef.indexes || [])) {
      const f = fields.get(idx.field);

      if (!f) {
        console.warn(`[MISSING/Field] ${title} :: ${idx.field}`);
        results.push({ list: title, category: 'Missing', sub: 'Field', field: idx.field, message: `Field "${idx.field}" not found` });
        continue;
      }

      if (!f.Indexed) {
        console.warn(`[MISMATCH/Index] ${title} :: ${idx.field}`);
        results.push({ list: title, category: 'Mismatch', sub: 'Indexed', field: idx.field, message: `Field "${idx.field}" has no index` });
      } else {
        results.push({ list: title, category: 'OK', sub: 'Indexed', field: idx.field, message: 'OK' });
      }

      if (idx.unique && !f.EnforceUniqueValues) {
        console.warn(`[MISMATCH/Unique] ${title} :: ${idx.field}`);
        results.push({ list: title, category: 'Mismatch', sub: 'Unique', field: idx.field, message: `Field "${idx.field}" has no unique constraint` });
      } else if (idx.unique) {
        results.push({ list: title, category: 'OK', sub: 'Unique', field: idx.field, message: 'OK' });
      }
    }
  }

  // ── サマリー表示 ──────────────────────────────────────────────────────────
  const missingList  = results.filter(r => r.category === 'Missing'  && r.sub === 'List');
  const missingField = results.filter(r => r.category === 'Missing'  && r.sub === 'Field');
  const mismatchIdx  = results.filter(r => r.category === 'Mismatch' && r.sub === 'Indexed');
  const mismatchUniq = results.filter(r => r.category === 'Mismatch' && r.sub === 'Unique');
  const oks          = results.filter(r => r.category === 'OK');

  console.log('%c\n========== AUDIT SUMMARY ==========', 'color: cyan; font-weight: bold');
  console.log(`%cMissing / List  : ${missingList.length}`,  missingList.length  ? 'color: red'    : 'color: green');
  console.log(`%cMissing / Field : ${missingField.length}`, missingField.length ? 'color: red'    : 'color: green');
  console.log(`%cMismatch/Index  : ${mismatchIdx.length}`,  mismatchIdx.length  ? 'color: orange' : 'color: green');
  console.log(`%cMismatch/Unique : ${mismatchUniq.length}`, mismatchUniq.length ? 'color: orange' : 'color: green');
  console.log(`%cOK              : ${oks.length}`,          'color: green');
  console.log('%c====================================\n', 'color: cyan');

  if (missingList.length)  { console.group('%cMissing Lists', 'color:red');    missingList.forEach(r  => console.log(r.list));         console.groupEnd(); }
  if (missingField.length) { console.group('%cMissing Fields', 'color:red');   missingField.forEach(r => console.log(`${r.list} :: ${r.field}`)); console.groupEnd(); }
  if (mismatchIdx.length)  { console.group('%cNo Index', 'color:orange');      mismatchIdx.forEach(r  => console.log(`${r.list} :: ${r.field}`)); console.groupEnd(); }
  if (mismatchUniq.length) { console.group('%cNo Unique', 'color:orange');     mismatchUniq.forEach(r => console.log(`${r.list} :: ${r.field}`)); console.groupEnd(); }

  // ── JSON 出力（コピー用）────────────────────────────────────────────────
  console.log('%c\n[AUDIT] Full results (copy below):', 'color: cyan');
  console.log(JSON.stringify(results, null, 2));

  // グローバル変数に保存（後から参照できる）
  window._auditResults = results;
  console.log('%c[AUDIT] Results saved to window._auditResults', 'color: cyan');

  return results;

})();
