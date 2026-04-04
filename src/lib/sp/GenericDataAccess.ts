/**
 * GenericDataAccess.ts — SharePoint リスト読み取りの共通基盤
 *
 * 2モジュール (Daily / MonitoringMeeting) で共通だった
 * 「SP REST クエリ構築 + fetch + JSON パース」パターンを1箇所に統合。
 *
 * 責務:
 * 1. resolved fields から $select 文字列を構築 (buildSelectFromResolved)
 * 2. SP リストアイテムの汎用取得 (spFetchItems / spFindOne)
 * 3. エラー時の安全なフォールバック (try/catch + telemetry)
 *
 * 各ドメインの DataAccess はこのモジュールの関数を使い、
 * ドメイン固有の mapper / join / ID解決 だけ自前で持つ。
 *
 * @see GenericSchemaResolver.ts — schema resolution
 * @see GenericSaver.ts — fail-open persistence
 */
import type { SpFetchFn } from '@/lib/sp/spLists';
import { auditLog } from '@/lib/debugLogger';

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * SP REST クエリのオプション。
 */
export interface SpQueryOptions {
  /** OData $filter 式 */
  filter?: string;
  /** OData $orderby 式 */
  orderby?: string;
  /** 返却件数上限 */
  top?: number;
  /** $select カラム指定 (文字列配列 or カンマ区切り文字列) */
  select?: string[] | string;
  /** AbortSignal (任意) */
  signal?: AbortSignal;
}

// ── Select Builder ──────────────────────────────────────────────────────────

/**
 * resolved フィールド名マップから $select 用のカラム一覧を構築する。
 * 常に 'Id' を含め、オプションで 'Created' / 'Modified' も付与する。
 *
 * @param resolved - SchemaResolver から取得した { candidateKey → actualSpName } マップ
 * @param includeMetadata - Created/Modified を含めるか (default: true)
 */
export function buildSelectFromResolved(
  resolved: Record<string, string | undefined>,
  includeMetadata = true,
): string[] {
  const fields = new Set<string>(['Id', 'Title']);
  for (const value of Object.values(resolved)) {
    if (value) fields.add(value);
  }
  if (includeMetadata) {
    fields.add('Created');
    fields.add('Modified');
  }
  return [...fields];
}

// ── SP REST Fetch ───────────────────────────────────────────────────────────

/**
 * SP リストから複数アイテムを取得する汎用関数。
 *
 * URLSearchParams の構築・fetch・JSON パース・value 配列のデフォルト処理を共通化。
 *
 * @returns SP アイテム配列 (失敗時は空配列)
 */
export async function spFetchItems<T = Record<string, unknown>>(
  spFetch: SpFetchFn,
  listPath: string,
  options: SpQueryOptions = {},
  telemetryLabel?: string,
): Promise<T[]> {
  const queryParams = new URLSearchParams();
  if (options.filter) queryParams.set('$filter', options.filter);
  if (options.orderby) queryParams.set('$orderby', options.orderby);
  if (options.top) queryParams.set('$top', String(options.top));
  if (options.select) {
    const selectStr = Array.isArray(options.select)
      ? options.select.join(',')
      : options.select;
    queryParams.set('$select', selectStr);
  }

  const url = `${listPath}/items?${queryParams.toString()}`;

  try {
    const fetchOpts: RequestInit = {};
    if (options.signal) fetchOpts.signal = options.signal;

    const response = await spFetch(url, fetchOpts);
    const json = (await response.json()) as { value?: T[] };
    return json.value ?? [];
  } catch (error) {
    if (telemetryLabel) {
      auditLog.error('sp', `sp:fetch_failed`, {
        list: telemetryLabel,
        url,
        error: String(error),
      });
    }
    return [];
  }
}

/**
 * SP リストから単一アイテムを検索する。
 * $top=1 を強制し、最初のアイテムを返す。見つからなければ null。
 *
 * @returns 単一 SP アイテム or null
 */
export async function spFindOne<T = Record<string, unknown>>(
  spFetch: SpFetchFn,
  listPath: string,
  options: SpQueryOptions = {},
  telemetryLabel?: string,
): Promise<T | null> {
  const items = await spFetchItems<T>(spFetch, listPath, {
    ...options,
    top: 1,
  }, telemetryLabel);
  return items.length > 0 ? items[0] : null;
}

/**
 * SP リストから指定フィールドの値で SP ID (number) を検索する。
 * 単一アイテムの Id を返す。見つからなければ null。
 */
export async function spFindIdByField(
  spFetch: SpFetchFn,
  listPath: string,
  fieldName: string,
  fieldValue: string,
  telemetryLabel?: string,
): Promise<number | null> {
  const item = await spFindOne<{ Id?: number }>(spFetch, listPath, {
    filter: `${fieldName} eq '${fieldValue.replace(/'/g, "''")}'`,
    select: ['Id'],
  }, telemetryLabel);
  return item?.Id ?? null;
}
