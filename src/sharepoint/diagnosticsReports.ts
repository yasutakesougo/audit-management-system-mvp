/**
 * SharePoint Diagnostics_Reports リスト
 * - 環境診断結果を upsert する実装
 * - 既存パターン：src/features/dailyOps/data/sharePointAdapter.ts に準拠
 * - Title を一意キーとして getListItemsByTitle + addListItemByTitle/updateItemByTitle で upsert
 * - フィールド定義は src/sharepoint/fields.ts の FIELD_MAP_DIAGNOSTICS_REPORTS から取得
 */

import type { UseSP } from '@/lib/spClient';
import {
    DIAGNOSTICS_REPORTS_LIST_TITLE, FIELD_MAP_DIAGNOSTICS_REPORTS,
    DIAGNOSTICS_REPORTS_CANDIDATES,
} from '@/sharepoint/fields';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import { findListEntry } from '@/sharepoint/spListRegistry';

export type DiagnosticsReportStatus = 'pass' | 'warn' | 'fail';

export interface DiagnosticsReportInput {
  title: string;
  overall: DiagnosticsReportStatus;
  topIssue?: string | null;
  summaryText?: string | null;
  reportLink?: string | null;
  notified?: boolean;
}

export interface DiagnosticsReportItem {
  Id: number;
  Title: string;
  Overall: { __deferred?: { uri: string } } | { Value: DiagnosticsReportStatus } | DiagnosticsReportStatus;
  TopIssue?: string | null;
  SummaryText?: string | null;
  ReportLink?: string | null;
  Notified: boolean;
  Created: string;
  Modified: string;
}

// ─────────────────────────────────────────────────────────────
// フィールドマッピング
// （Field map は src/sharepoint/fields.ts に一元化）
// ─────────────────────────────────────────────────────────────

// ✅ 使用パターン：
//   - コード内では logicalName (e.g., 'topIssue')
//   - SharePoint API呼び出しは FIELD_MAP_DIAGNOSTICS_REPORTS で内部名に変換
//   - 内部名変更時は fields.ts の FIELD_MAP_DIAGNOSTICS_REPORTS を修正するだけで OK

/**
 * Notified フラグの状態を決定する（Power Automate取得フィルター用）
 *
 * Power Automate フロー設計:
 * - Get items filter: Notified ne true (つまり Notified=false のレコードを拾う)
 * - 処理後: Patch で Notified=true に変更
 *
 * ロジック:
 * 1. 初回作成（prev === null）:
 *    - warn/fail → false（Flow が拾う）
 *    - pass → true（Flow が拾わない）
 * 2. 更新（prev !== null）で内容が変わった:
 *    - warn/fail → false（再通知)
 *    - pass → true（通知不要）
 * 3. 変化なし:
 *    - undefined を返す（payload に含めない = 既存値を保持）
 *
 * @param prev 前回値（null = 初回）
 * @param next 今回値
 * @returns Notified の値 (false | true) または undefined (変更なし)
 */
export function shouldResetNotified(
  prev: DiagnosticsReportItem | null,
  next: DiagnosticsReportInput
): boolean | undefined {
  // 初回作成（prev === null）
  if (prev === null) {
    // warn/fail → false（Flow が拾う）
    // pass → true（Flow が拾わない）
    return next.overall === 'pass';
  }

  // 前回値を正規化（Choice フィールドは { Value: '...' } の場合がある）
  const prevOverall = normalizeChoiceValue(prev.Overall);
  const prevTopIssue = prev.TopIssue ?? null;
  const prevSummaryText = prev.SummaryText ?? null;
  const prevReportLink = prev.ReportLink ?? null;

  // 今回値
  const nextOverall = next.overall;
  const nextTopIssue = next.topIssue ?? null;
  const nextSummaryText = next.summaryText ?? null;
  const nextReportLink = next.reportLink ?? null;

  // コンテンツが変わったか判定
  const contentChanged =
    prevOverall !== nextOverall ||
    prevTopIssue !== nextTopIssue ||
    prevSummaryText !== nextSummaryText ||
    prevReportLink !== nextReportLink;

  // 内容が変わった場合、overall に応じて Notified を決定
  if (contentChanged) {
    // warn/fail → false（再通知）
    // pass → true（通知不要）
    return next.overall === 'pass';
  }

  // 変化なし → undefined（payload に含めない = 既存値を保持）
  return undefined;
}

/**
 * Choice フィールドを正規化
 * SharePoint から受け取る形式：{ Value: 'pass' } or 単なる文字列
 */
function normalizeChoiceValue(
  value: unknown
): DiagnosticsReportStatus | null {
  if (typeof value === 'string' && ['pass', 'warn', 'fail'].includes(value)) {
    return value as DiagnosticsReportStatus;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'Value' in value &&
    typeof (value as { Value: unknown }).Value === 'string'
  ) {
    const v = (value as { Value: string }).Value;
    if (['pass', 'warn', 'fail'].includes(v)) {
      return v as DiagnosticsReportStatus;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Upsert 実装（既存パターンに準拠）
// ─────────────────────────────────────────────────────────────

/**
 * SharePoint Diagnostics_Reports に診断結果をupsert
 * - Title 一意キーで既存チェック
 * - 既存 → updateItemByTitle
 * - 新規 → addListItemByTitle
 *
 * @param sp SharePoint クライアント（useSP）
 * @param input 診断入力
 * @returns SharePointに記録したアイテム（レスポンス）
 */
export async function upsertDiagnosticsReport(
  sp: UseSP,
  input: DiagnosticsReportInput
): Promise<DiagnosticsReportItem | null> {
  // バリデーション
  if (!input.title || typeof input.title !== 'string') {
    throw new Error('[diagnosticsReports] title is required');
  }
  if (!['pass', 'warn', 'fail'].includes(input.overall)) {
    throw new Error(`[diagnosticsReports] overall must be pass|warn|fail, got: ${input.overall}`);
  }

  const entry = findListEntry('diagnostics_reports');
  const listTitle = entry?.resolve() || DIAGNOSTICS_REPORTS_LIST_TITLE;

  // ──────────────────────────────────────────
  // Step 0: 実環境の内部名を解決 (Drift 対応)
  // ──────────────────────────────────────────
  const rawFields = await sp.getListFieldInternalNames(listTitle).catch((err) => {
    console.warn(`[diagnosticsReports] Failed to fetch fields for list: ${listTitle}. This list may be missing or inaccessible.`, err);
    return [] as string[];
  });
  const { resolved } = resolveInternalNamesDetailed(
    new Set(rawFields),
    DIAGNOSTICS_REPORTS_CANDIDATES as unknown as Record<string, string[]>
  );
  
  // 物理名の取得ファンクション
  const pName = (logical: keyof typeof DIAGNOSTICS_REPORTS_CANDIDATES): string => {
    return (resolved[logical] as string | undefined) || FIELD_MAP_DIAGNOSTICS_REPORTS[logical];
  };

  const pTitle = pName('title');
  const pId = pName('id');
  const pOverall = pName('overall');
  const pNotified = pName('notified');
  const pTopIssue = pName('topIssue');
  const pSummaryText = pName('summaryText');
  const pReportLink = pName('reportLink');

  // ──────────────────────────────────────────
  // Step 1: Title で既存アイテムを検索
  // ──────────────────────────────────────────
  const filter = `${pTitle} eq '${input.title.replace(/'/g, "''")}'`;
  const existing = await sp.getListItemsByTitle<{ Id: number }>(
    listTitle,
    [pId, pTitle, pOverall, pTopIssue, pSummaryText, pReportLink, pNotified],
    filter,
    undefined,
    1
  );

  // ──────────────────────────────────────────
  // Step 2: 送信ペイロード構築
  // ──────────────────────────────────────────
  const payload: Record<string, unknown> = {
    [pTitle]: input.title,
    // Choice は文字列（JSON reader 'StartObject' エラー対策で primitive で送信）
    [pOverall]: input.overall,
  };

  const notifiedValue = shouldResetNotified(
    existing?.length ? (existing[0] as DiagnosticsReportItem) : null,
    input
  );

  if (notifiedValue !== undefined) {
    payload[pNotified] = notifiedValue;
  }

  if (input.topIssue != null) {
    payload[pTopIssue] = input.topIssue;
  }
  if (input.summaryText != null) {
    payload[pSummaryText] = input.summaryText;
  }
  if (input.reportLink != null) {
    payload[pReportLink] = input.reportLink;
  }

  // ──────────────────────────────────────────
  // Step 3: 更新または作成
  // ──────────────────────────────────────────
  if (existing?.length) {
    // UPDATE: 既存レコード
    // ✅ 動的に解決された ID フィールドから数値型 ID を抽出
    const rawItem = existing[0] as Record<string, unknown>;
    const id = Number(rawItem[pId] ?? rawItem.Id ?? rawItem.ID);
    
    if (Number.isNaN(id)) {
      throw new Error(`[diagnosticsReports] Failed to resolve numeric ID from ${pId}`);
    }

    try {
      await sp.updateItemByTitle(listTitle, id, payload);
      console.info('[diagnosticsReports] updated', { id, title: input.title });

      // 更新後のアイテムを取得して返す
      const updated = await sp.getListItemsByTitle<DiagnosticsReportItem>(
        listTitle,
        [pId, pTitle, pOverall, pTopIssue, pSummaryText, pReportLink, pNotified],
        `${pId} eq ${id}`,
        undefined,
        1
      );
      return updated?.[0] ?? null;
    } catch (error) {
      console.error('[diagnosticsReports] update failed', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  } else {
    // CREATE: 新規レコード
    try {
      const created = await sp.addListItemByTitle<Record<string, unknown>, DiagnosticsReportItem>(
        listTitle,
        payload
      );
      const newId = created?.Id ?? -1;
      console.info('[diagnosticsReports] created', { id: newId, title: input.title });
      return created ?? null;
    } catch (error) {
      console.error('[diagnosticsReports] create failed', {
        error: error instanceof Error ? error.message : String(error),
        title: input.title,
      });
      throw error;
    }
  }
}

/**
 * 複数の診断結果を一括 upsert
 */
export async function upsertDiagnosticsReportBatch(
  sp: UseSP,
  inputs: DiagnosticsReportInput[]
): Promise<Array<DiagnosticsReportItem | null>> {
  const results: Array<DiagnosticsReportItem | null> = [];
  const errors: Array<{ title: string; error: Error }> = [];

  for (const input of inputs) {
    try {
      const result = await upsertDiagnosticsReport(sp, input);
      results.push(result);
    } catch (error) {
      errors.push({
        title: input.title,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  if (errors.length > 0) {
    console.warn('[diagnosticsReports] batch partial error', {
      total: inputs.length,
      succeeded: results.length,
      failed: errors.length,
    });
  }

  return results;
}

/**
 * 診断結果の再通知フラグをリセット（Notified = false）
 */
export async function resetNotificationFlag(sp: UseSP, reportId: number): Promise<void> {
  try {
    await sp.updateItemByTitle(DIAGNOSTICS_REPORTS_LIST_TITLE, reportId, {
      Notified: false,
    });
    console.info('[diagnosticsReports] notification flag reset', { id: reportId });
  } catch (error) {
    console.error('[diagnosticsReports] reset notification flag failed', {
      id: reportId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
