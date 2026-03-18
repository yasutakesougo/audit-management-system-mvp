/* eslint-disable no-console, no-undef, no-restricted-globals */
/**
 * SP Column Provisioning — Browser Console Script
 *
 * Transport_Log / AttendanceUsers の不足列追加
 * CallLogs リスト新規作成 + 全列追加
 *
 * 使い方:
 *   1. https://isogokatudouhome.sharepoint.com/sites/welfare を Chrome/Edge で開く
 *   2. F12 → コンソールタブ
 *   3. このスクリプト全体をコピー → コンソールに貼り付け → Enter
 *   4. 結果がコンソールに表示される
 *
 * ⚠️ DRY RUN モード: 最初は DRY_RUN = true で実行して、何が作成されるか確認してください。
 */

(async () => {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const DRY_RUN = true; // true = 確認のみ, false = 実際に作成

  const siteUrl = (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo.webAbsoluteUrl)
    || 'https://isogokatudouhome.sharepoint.com/sites/welfare';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ヘルパー
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function getDigest() {
    const res = await fetch(`${siteUrl}/_api/contextinfo`, {
      method: 'POST',
      headers: { 'Accept': 'application/json;odata=nometadata' },
    });
    const data = await res.json();
    return data.FormDigestValue;
  }

  async function getExistingFields(listTitle) {
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/fields?$select=InternalName`,
      { headers: { 'Accept': 'application/json;odata=nometadata' } }
    );
    if (!res.ok) return null; // list doesn't exist
    const data = await res.json();
    return new Set(data.value.map(f => f.InternalName));
  }

  async function listExists(listTitle) {
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')`,
      { headers: { 'Accept': 'application/json;odata=nometadata' } }
    );
    return res.ok;
  }

  async function createList(listTitle, digest) {
    const body = {
      '__metadata': { 'type': 'SP.List' },
      'BaseTemplate': 100, // Generic List
      'Title': listTitle,
    };
    const res = await fetch(`${siteUrl}/_api/web/lists`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json;odata=verbose',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': digest,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create list "${listTitle}": ${res.status} — ${err}`);
    }
    console.log(`%c[CREATED] List: ${listTitle}`, 'color: lime');
  }

  async function addField(listTitle, fieldDef, digest) {
    const body = {
      '__metadata': { 'type': 'SP.Field' },
      'Title': fieldDef.internalName,
      'StaticName': fieldDef.internalName,
      'InternalName': fieldDef.internalName,
      'FieldTypeKind': fieldDef.typeKind,
      'Required': fieldDef.required || false,
    };

    if (fieldDef.typeKind === 6) { // Note
      body.NumberOfLines = 6;
    }

    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/fields`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
          'X-RequestDigest': digest,
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[FAIL] ${listTitle} :: ${fieldDef.internalName} — ${res.status}: ${err}`);
      return false;
    }
    console.log(`%c[ADDED] ${listTitle} :: ${fieldDef.internalName} (${fieldDef.type})`, 'color: lime');
    return true;
  }

  // SP FieldTypeKind mapping
  const TYPE_KIND = {
    Text: 2,
    Note: 3,
    DateTime: 4,
    Boolean: 8,
    Number: 9,
    Choice: 6, // Note: Choice via REST is tricky, using Text as fallback
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // P0: Transport_Log — 不足列追加
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const TRANSPORT_LOG_COLUMNS = [
    { internalName: 'UserCode',      type: 'Text',     typeKind: TYPE_KIND.Text,     required: true },
    { internalName: 'RecordDate',    type: 'Text',     typeKind: TYPE_KIND.Text,     required: true },
    { internalName: 'Direction',     type: 'Text',     typeKind: TYPE_KIND.Text,     required: true },
    { internalName: 'Status',        type: 'Text',     typeKind: TYPE_KIND.Text,     required: true },
    { internalName: 'Method',        type: 'Text',     typeKind: TYPE_KIND.Text,     required: false },
    { internalName: 'ScheduledTime', type: 'Text',     typeKind: TYPE_KIND.Text,     required: false },
    { internalName: 'ActualTime',    type: 'Text',     typeKind: TYPE_KIND.Text,     required: false },
    { internalName: 'DriverName',    type: 'Text',     typeKind: TYPE_KIND.Text,     required: false },
    { internalName: 'Notes',         type: 'Note',     typeKind: TYPE_KIND.Note,     required: false },
    { internalName: 'UpdatedBy',     type: 'Text',     typeKind: TYPE_KIND.Text,     required: false },
    { internalName: 'UpdatedAt',     type: 'DateTime', typeKind: TYPE_KIND.DateTime, required: false },
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // P0: AttendanceUsers — 不足列追加
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const ATTENDANCE_USERS_COLUMNS = [
    { internalName: 'UserCode',          type: 'Text',    typeKind: TYPE_KIND.Text,    required: true },
    { internalName: 'IsTransportTarget', type: 'Boolean', typeKind: TYPE_KIND.Boolean, required: false },
    { internalName: 'StandardMinutes',   type: 'Number',  typeKind: TYPE_KIND.Number,  required: false },
    { internalName: 'IsActive',          type: 'Boolean', typeKind: TYPE_KIND.Boolean, required: true },
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // P1: CallLogs — リスト作成 + 全列追加
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const CALL_LOGS_COLUMNS = [
    { internalName: 'ReceivedAt',      type: 'DateTime', typeKind: TYPE_KIND.DateTime, required: true },
    { internalName: 'CallerName',      type: 'Text',     typeKind: TYPE_KIND.Text,     required: true },
    { internalName: 'CallerOrg',       type: 'Text',     typeKind: TYPE_KIND.Text,     required: false },
    { internalName: 'TargetStaffName', type: 'Text',     typeKind: TYPE_KIND.Text,     required: true },
    { internalName: 'ReceivedByName',  type: 'Text',     typeKind: TYPE_KIND.Text,     required: true },
    { internalName: 'MessageBody',     type: 'Note',     typeKind: TYPE_KIND.Note,     required: true },
    { internalName: 'NeedCallback',    type: 'Boolean',  typeKind: TYPE_KIND.Boolean,  required: false },
    { internalName: 'Urgency',         type: 'Text',     typeKind: TYPE_KIND.Text,     required: true },
    { internalName: 'Status',          type: 'Text',     typeKind: TYPE_KIND.Text,     required: true },
    { internalName: 'RelatedUserId',   type: 'Text',     typeKind: TYPE_KIND.Text,     required: false },
    { internalName: 'RelatedUserName', type: 'Text',     typeKind: TYPE_KIND.Text,     required: false },
    { internalName: 'CallbackDueAt',   type: 'DateTime', typeKind: TYPE_KIND.DateTime, required: false },
    { internalName: 'CompletedAt',     type: 'DateTime', typeKind: TYPE_KIND.DateTime, required: false },
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 実行
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const results = { created: [], skipped: [], failed: [] };

  console.log(`%c\n═══ SP Column Provisioning ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ═══\n`, 'color: cyan; font-weight: bold');

  const digest = DRY_RUN ? null : await getDigest();

  // --- Transport_Log ---
  console.log('%c\n── Transport_Log ──', 'color: yellow');
  const transportFields = await getExistingFields('Transport_Log');
  if (transportFields) {
    for (const col of TRANSPORT_LOG_COLUMNS) {
      if (transportFields.has(col.internalName)) {
        console.log(`  [SKIP] ${col.internalName} (already exists)`);
        results.skipped.push(`Transport_Log::${col.internalName}`);
      } else if (DRY_RUN) {
        console.log(`  %c[WOULD ADD] ${col.internalName} (${col.type})`, 'color: orange');
        results.created.push(`Transport_Log::${col.internalName}`);
      } else {
        const ok = await addField('Transport_Log', col, digest);
        (ok ? results.created : results.failed).push(`Transport_Log::${col.internalName}`);
      }
    }
  } else {
    console.warn('  [WARN] Transport_Log list not found!');
  }

  // --- AttendanceUsers ---
  console.log('%c\n── AttendanceUsers ──', 'color: yellow');
  const auFields = await getExistingFields('AttendanceUsers');
  if (auFields) {
    for (const col of ATTENDANCE_USERS_COLUMNS) {
      if (auFields.has(col.internalName)) {
        console.log(`  [SKIP] ${col.internalName} (already exists)`);
        results.skipped.push(`AttendanceUsers::${col.internalName}`);
      } else if (DRY_RUN) {
        console.log(`  %c[WOULD ADD] ${col.internalName} (${col.type})`, 'color: orange');
        results.created.push(`AttendanceUsers::${col.internalName}`);
      } else {
        const ok = await addField('AttendanceUsers', col, digest);
        (ok ? results.created : results.failed).push(`AttendanceUsers::${col.internalName}`);
      }
    }
  } else {
    console.warn('  [WARN] AttendanceUsers list not found!');
  }

  // --- CallLogs ---
  console.log('%c\n── CallLogs ──', 'color: yellow');
  const clExists = await listExists('CallLogs');
  if (!clExists) {
    if (DRY_RUN) {
      console.log(`  %c[WOULD CREATE] CallLogs list`, 'color: orange');
    } else {
      await createList('CallLogs', digest);
    }
  } else {
    console.log('  [OK] CallLogs list already exists');
  }

  const clFields = clExists ? await getExistingFields('CallLogs') : new Set(['Id', 'Title']);
  for (const col of CALL_LOGS_COLUMNS) {
    if (clFields && clFields.has(col.internalName)) {
      console.log(`  [SKIP] ${col.internalName} (already exists)`);
      results.skipped.push(`CallLogs::${col.internalName}`);
    } else if (DRY_RUN) {
      console.log(`  %c[WOULD ADD] ${col.internalName} (${col.type})`, 'color: orange');
      results.created.push(`CallLogs::${col.internalName}`);
    } else {
      const ok = await addField('CallLogs', col, digest);
      (ok ? results.created : results.failed).push(`CallLogs::${col.internalName}`);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // サマリー
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log(`%c\n═══ SUMMARY ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ═══`, 'color: cyan; font-weight: bold');
  console.log(`  Created/Would create: ${results.created.length}`);
  console.log(`  Skipped (exists): ${results.skipped.length}`);
  console.log(`  Failed: ${results.failed.length}`);

  if (results.created.length > 0) {
    console.group('Created/Would create:');
    results.created.forEach(r => console.log(`  + ${r}`));
    console.groupEnd();
  }
  if (results.failed.length > 0) {
    console.group('%cFailed:', 'color: red');
    results.failed.forEach(r => console.log(`  ✗ ${r}`));
    console.groupEnd();
  }

  if (DRY_RUN) {
    console.log('\n%c⚠️ DRY RUN — 実際には何も変更されていません。', 'color: orange; font-weight: bold');
    console.log('%c   DRY_RUN = false に変更して再実行すると、上記の列が作成されます。', 'color: orange');
  }

  window._provisionResults = results;
  console.log('%c[PROVISION] Results saved to window._provisionResults', 'color: cyan');

  return results;
})();
