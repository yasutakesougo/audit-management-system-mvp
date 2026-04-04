/**
 * schemaUtils.ts — SharePoint Schema Resolution 共通ユーティリティ
 *
 * 全 SchemaResolver が共有する純粋関数群。
 * ドメイン固有ロジックを持たず、SP リスト名解決とエラー分類のみ担当。
 *
 * @see GenericSchemaResolver.ts
 */

// ── List Path Builder ───────────────────────────────────────────────────────

/**
 * SharePoint REST API 用のリスト参照パスを構築する。
 * 例: 'MonitoringMeetings' → "lists/getbytitle('MonitoringMeetings')"
 */
export const buildListPath = (listTitle: string): string => {
  const escaped = listTitle.replace(/'/g, "''");
  return `lists/getbytitle('${escaped}')`;
};

// ── Normalize ───────────────────────────────────────────────────────────────

/**
 * リスト名を正規化キーに変換する（空白/アンダースコア/ハイフン除去、小文字化）。
 * 候補照合に使用。
 */
export const normalizeListKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\s_\-\u3000]+/gu, '');

// ── HTTP Status Extractor ───────────────────────────────────────────────────

/**
 * エラーオブジェクトから HTTP ステータスコードを抽出する。
 * spFetch が投げるエラーの .status / .cause.status を参照。
 */
export const getHttpStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const obj = error as Record<string, unknown>;
  if (typeof obj.status === 'number') return obj.status;
  if (obj.cause && typeof obj.cause === 'object') {
    const cause = obj.cause as Record<string, unknown>;
    if (typeof cause.status === 'number') return cause.status;
  }
  return undefined;
};

// ── List Title Candidate Builder ────────────────────────────────────────────

/**
 * リスト検索候補を構築する。
 * primary と追加フォールバックを重複排除して返す。
 */
export const buildListTitleCandidates = (
  primary: string,
  fallbacks?: readonly string[]
): string[] => {
  const normalizedPrimary = primary.trim();
  const values = [
    normalizedPrimary,
    ...(fallbacks ?? []),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(values)];
};

// ── SharePoint Response Types ───────────────────────────────────────────────

export type SharePointResponse<T> = {
  value?: T[];
};

export type SharePointFieldItem = {
  InternalName?: string;
};
