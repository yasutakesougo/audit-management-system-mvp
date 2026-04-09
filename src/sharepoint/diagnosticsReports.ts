/**
 * SharePoint Diagnostics_Reports リスト
 * - 環境診断結果を upsert する実装
 * - 既存パターン：src/features/dailyOps/data/sharePointAdapter.ts に準拠
 * - Title を一意キーとして getListItemsByTitle + addListItemByTitle/updateItemByTitle で upsert
 * - フィールド定義は src/sharepoint/fields.ts の FIELD_MAP_DIAGNOSTICS_REPORTS から取得
 */

import type { UseSP } from '@/lib/spClient';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import {
    DIAGNOSTICS_REPORTS_CANDIDATES,
    DIAGNOSTICS_REPORTS_LIST_TITLE,
    FIELD_MAP_DIAGNOSTICS_REPORTS,
} from '@/sharepoint/fields';

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

type DiagnosticsFieldKey = keyof typeof DIAGNOSTICS_REPORTS_CANDIDATES;
type DiagnosticsResolvedFields = Record<DiagnosticsFieldKey, string | undefined>;

const DEFAULT_DIAGNOSTICS_RESOLVED_FIELDS: DiagnosticsResolvedFields = {
  id: FIELD_MAP_DIAGNOSTICS_REPORTS.id,
  title: FIELD_MAP_DIAGNOSTICS_REPORTS.title,
  overall: FIELD_MAP_DIAGNOSTICS_REPORTS.overall,
  topIssue: FIELD_MAP_DIAGNOSTICS_REPORTS.topIssue,
  summaryText: FIELD_MAP_DIAGNOSTICS_REPORTS.summaryText,
  reportLink: FIELD_MAP_DIAGNOSTICS_REPORTS.reportLink,
  notified: FIELD_MAP_DIAGNOSTICS_REPORTS.notified,
  notifiedAt: FIELD_MAP_DIAGNOSTICS_REPORTS.notifiedAt,
  created: FIELD_MAP_DIAGNOSTICS_REPORTS.created,
  modified: FIELD_MAP_DIAGNOSTICS_REPORTS.modified,
};

let diagnosticsResolvedFieldsCache: DiagnosticsResolvedFields | null = null;

const toNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  return value;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const buildDiagnosticsSelectFields = (
  resolved: DiagnosticsResolvedFields,
  options: { includeOptional?: boolean } = { includeOptional: true }
): string[] => {
  const seen = new Set<string>();
  const fields: string[] = [];
  
  // 必須フィールド (Id, Title, Overall)
  const essentialKeys: DiagnosticsFieldKey[] = ['id', 'title', 'overall'];
  
  // 解決されたフィールドのみ追加
  for (const key of essentialKeys) {
    const value = resolved[key];
    if (value && !seen.has(value)) {
      seen.add(value);
      fields.push(value);
    }
  }

  // オプションフィールド
  if (options.includeOptional) {
    for (const key of Object.keys(resolved) as DiagnosticsFieldKey[]) {
      if (essentialKeys.includes(key)) continue;
      const value = resolved[key];
      if (value && !seen.has(value)) {
        seen.add(value);
        fields.push(value);
      }
    }
  }

  return fields;
};

const pickRawField = (
  row: Record<string, unknown>,
  resolvedName: string | undefined,
  fallbackName: string,
): unknown => {
  if (resolvedName && resolvedName in row) return row[resolvedName];
  if (fallbackName in row) return row[fallbackName];
  return undefined;
};

const normalizeDiagnosticsReportItem = (
  row: Record<string, unknown>,
  resolved: DiagnosticsResolvedFields,
): DiagnosticsReportItem => {
  return {
    Id: toNumber(pickRawField(row, resolved.id, FIELD_MAP_DIAGNOSTICS_REPORTS.id)),
    Title: String(pickRawField(row, resolved.title, FIELD_MAP_DIAGNOSTICS_REPORTS.title) ?? ''),
    Overall:
      (pickRawField(row, resolved.overall, FIELD_MAP_DIAGNOSTICS_REPORTS.overall) as DiagnosticsReportItem['Overall']) ??
      'pass',
    TopIssue: toNullableString(pickRawField(row, resolved.topIssue, FIELD_MAP_DIAGNOSTICS_REPORTS.topIssue)),
    SummaryText: toNullableString(
      pickRawField(row, resolved.summaryText, FIELD_MAP_DIAGNOSTICS_REPORTS.summaryText),
    ),
    ReportLink: toNullableString(
      pickRawField(row, resolved.reportLink, FIELD_MAP_DIAGNOSTICS_REPORTS.reportLink),
    ),
    Notified: toBoolean(pickRawField(row, resolved.notified, FIELD_MAP_DIAGNOSTICS_REPORTS.notified)),
    Created: String(pickRawField(row, resolved.created, FIELD_MAP_DIAGNOSTICS_REPORTS.created) ?? ''),
    Modified: String(pickRawField(row, resolved.modified, FIELD_MAP_DIAGNOSTICS_REPORTS.modified) ?? ''),
  };
};

const resolveDiagnosticsFields = async (sp: UseSP): Promise<DiagnosticsResolvedFields> => {
  if (diagnosticsResolvedFieldsCache) {
    return diagnosticsResolvedFieldsCache;
  }

  try {
    let available: Set<string> | null = null;

    const fetchExistingFields = (sp as Partial<UseSP>).fetchExistingFields;
    if (typeof fetchExistingFields === 'function') {
      const fields = await fetchExistingFields(DIAGNOSTICS_REPORTS_LIST_TITLE);
      available = new Set(Array.from(fields.keys()));
    }

    if (!available) {
      available = await sp.getListFieldInternalNames(DIAGNOSTICS_REPORTS_LIST_TITLE);
    }

    const { resolved } = resolveInternalNamesDetailed(
      available,
      DIAGNOSTICS_REPORTS_CANDIDATES as unknown as Record<DiagnosticsFieldKey, string[]>,
    );
    diagnosticsResolvedFieldsCache = {
      ...DEFAULT_DIAGNOSTICS_RESOLVED_FIELDS,
      ...resolved,
    };
    return diagnosticsResolvedFieldsCache;
  } catch (error) {
    console.warn('[diagnosticsReports] failed to resolve field drift, fallback to defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
    diagnosticsResolvedFieldsCache = { ...DEFAULT_DIAGNOSTICS_RESOLVED_FIELDS };
    return diagnosticsResolvedFieldsCache;
  }
};

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

  const listTitle = DIAGNOSTICS_REPORTS_LIST_TITLE;
  const resolvedFields = await resolveDiagnosticsFields(sp);
  const selectFields = buildDiagnosticsSelectFields(resolvedFields);
  const titleFieldName = resolvedFields.title ?? FIELD_MAP_DIAGNOSTICS_REPORTS.title;
  const idFieldName = resolvedFields.id ?? FIELD_MAP_DIAGNOSTICS_REPORTS.id;

  // ──────────────────────────────────────────
  // Step 1: Title で既存アイテムを検索
  // ──────────────────────────────────────────
  const filter = `${titleFieldName} eq '${input.title.replace(/'/g, "''")}'`;
  const existing = await sp.getListItemsByTitle<Record<string, unknown>>(
    listTitle,
    selectFields,
    filter,
    undefined,
    1
  );
  const existingItem = existing.length > 0
    ? normalizeDiagnosticsReportItem(existing[0], resolvedFields)
    : null;

  // ──────────────────────────────────────────
  // Step 2: 送信ペイロード構築
  // ──────────────────────────────────────────
  // ✅ Field map を使用してキー名を統一
  const payload: Record<string, unknown> = {
    [titleFieldName]: input.title,
    // Choice/Text ともに互換性が高い primitive 文字列で送信する。
    [(resolvedFields.overall ?? FIELD_MAP_DIAGNOSTICS_REPORTS.overall)]: input.overall,
  };

  // Notified フラグの制御（Power Automate取得フィルター対応）:
  // Power Automate: Get items filter "Notified ne true" で未通知を拾う
  // - 初回作成の warn/fail → false（Flow が拾う）
  // - 初回作成の pass → true（Flow が拾わない）
  // - 更新で内容変更の warn/fail → false（再通知）
  // - 更新で内容変更の pass → true（通知不要）
  // - 更新で内容変更なし → 既存値保持
  const notifiedValue = shouldResetNotified(
    existingItem,
    input
  );

  // undefined の場合は payload に含めない（既存値を保持）
  if (notifiedValue !== undefined) {
    payload[(resolvedFields.notified ?? FIELD_MAP_DIAGNOSTICS_REPORTS.notified)] = notifiedValue;
  }

  // Optional: null/undefined チェック
  if (input.topIssue != null && resolvedFields.topIssue) {
    payload[resolvedFields.topIssue] = input.topIssue;
  } else if (input.topIssue != null && !resolvedFields.topIssue) {
    console.warn('[diagnosticsReports] topIssue field is missing in tenant schema; skipping field', {
      title: input.title,
    });
  }
  if (input.summaryText != null) {
    payload[(resolvedFields.summaryText ?? FIELD_MAP_DIAGNOSTICS_REPORTS.summaryText)] = input.summaryText;
  }
  if (input.reportLink != null) {
    payload[(resolvedFields.reportLink ?? FIELD_MAP_DIAGNOSTICS_REPORTS.reportLink)] = input.reportLink;
  }

  // ──────────────────────────────────────────
  // Step 3: 更新または作成
  // ──────────────────────────────────────────
  if (existing?.length) {
    // UPDATE: 既存レコード
    const id = existingItem?.Id ?? toNumber(existing[0][idFieldName]);
    try {
      await sp.updateItemByTitle(listTitle, id, payload);
      console.info('[diagnosticsReports] updated', { id, title: input.title });

      // 更新後のアイテムを取得して返す
      const updated = await sp.getListItemsByTitle<Record<string, unknown>>(
        listTitle,
        selectFields,
        `${idFieldName} eq ${id}`,
        undefined,
        1
      );
      return updated?.[0] ? normalizeDiagnosticsReportItem(updated[0], resolvedFields) : null;
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
      const created = await sp.addListItemByTitle<Record<string, unknown>, Record<string, unknown>>(
        listTitle,
        payload
      );
      const newId = toNumber(pickRawField(created ?? {}, resolvedFields.id, FIELD_MAP_DIAGNOSTICS_REPORTS.id));
      console.info('[diagnosticsReports] created', { id: newId, title: input.title });
      if (!newId) {
        return created ? normalizeDiagnosticsReportItem(created, resolvedFields) : null;
      }

      const inserted = await sp.getListItemsByTitle<Record<string, unknown>>(
        listTitle,
        selectFields,
        `${idFieldName} eq ${newId}`,
        undefined,
        1,
      );
      if (inserted[0]) {
        return normalizeDiagnosticsReportItem(inserted[0], resolvedFields);
      }
      return created ? normalizeDiagnosticsReportItem(created, resolvedFields) : null;
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

/**
 * テスト用: フィールド解決キャッシュをクリア
 */
export const __resetDiagnosticsReportFieldResolutionForTest = (): void => {
  diagnosticsResolvedFieldsCache = null;
};
