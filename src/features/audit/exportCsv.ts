export type AuditCsvRow = {
  ts: string;                 // ISO string (UI 表示時は任意フォーマット)
  actor: string;              // UPN / display name
  action: string;             // e.g. create/update/view/batch.sync
  entity: string;             // e.g. SupportRecord_Daily / Compliance_Checklist
  entity_id?: string | number;
  details?: unknown;          // ハッシュ化済みやサマリ文字列/オブジェクト
};

/** CSV 本文を構築（ヘッダ含む）。RFC4180 準拠の最低限実装 */
export function buildAuditCsv(rows: AuditCsvRow[]): string {
  const headers = ['ts', 'actor', 'action', 'entity', 'entity_id', 'details'] as const;
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // ダブルクォート/改行/カンマが含まれる場合は引用
    const needsQuote = /[",\n]/.test(s);
    const inner = s.replace(/"/g, '""');
    return needsQuote ? '"' + inner + '"' : inner;
  };
  const body = rows.map((r) => {
    const values: (string | number)[] = [
      r.ts,
      r.actor,
      r.action,
      r.entity,
      r.entity_id ?? '',
      r.details != null ? JSON.stringify(r.details) : ''
    ] as (string | number)[];
    return values.map(escape).join(',');
  });
  return [headers.join(','), ...body].join('\n');
}

/** ブラウザで CSV をダウンロード開始 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
