/**
 * SharePoint リスト ヘルスチェック ユーティリティ
 *
 * SP_LIST_REGISTRY 内の全リストに対して存在確認・アクセス検証を行う。
 * SmokeTestPage や CLI スクリプトから利用可能。
 */
import { SP_LIST_REGISTRY, type SpListEntry } from '@/sharepoint/spListRegistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ListCheckStatus = 'ok' | 'not_found' | 'forbidden' | 'error';

export interface ListCheckResult {
  /** レジストリキー */
  key: string;
  /** UI表示用名 */
  displayName: string;
  /** 解決されたリスト名 */
  listName: string;
  /** 検証結果 */
  status: ListCheckStatus;
  /** HTTP レスポンスステータス */
  httpStatus?: number;
  /** エラーメッセージ（statusが error の場合） */
  error?: string;
}

export interface HealthCheckSummary {
  total: number;
  ok: number;
  notFound: number;
  forbidden: number;
  errors: number;
  results: ListCheckResult[];
}

/** fetcher は spClient の spFetch 相当。相対パスを受け取り Response を返す。 */
export type SpFetcher = (path: string, init?: RequestInit) => Promise<Response>;

// ---------------------------------------------------------------------------
// GUID detection
// ---------------------------------------------------------------------------

const GUID_PREFIX = 'guid:';
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * リスト名が GUID 形式かを判定し、適切な API パスを返す。
 * - "guid:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" → /lists(guid'xxx')
 * - 通常のタイトル → /lists/getbytitle('xxx')
 */
export function buildListCheckPath(listName: string): string {
  if (listName.startsWith(GUID_PREFIX)) {
    const guid = listName.slice(GUID_PREFIX.length).trim();
    return `/_api/web/lists(guid'${guid}')?$select=Id,Title`;
  }

  if (GUID_REGEX.test(listName)) {
    return `/_api/web/lists(guid'${listName}')?$select=Id,Title`;
  }

  return `/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')?$select=Id,Title`;
}

// ---------------------------------------------------------------------------
// Single list check
// ---------------------------------------------------------------------------

function classifyStatus(httpStatus: number): ListCheckStatus {
  if (httpStatus >= 200 && httpStatus < 300) return 'ok';
  if (httpStatus === 404) return 'not_found';
  if (httpStatus === 401 || httpStatus === 403) return 'forbidden';
  return 'error';
}

export async function checkSingleList(
  entry: SpListEntry,
  fetcher: SpFetcher,
): Promise<ListCheckResult> {
  let listName: string;

  try {
    listName = entry.resolve();
  } catch (err) {
    return {
      key: entry.key,
      displayName: entry.displayName,
      listName: '(resolve failed)',
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const path = buildListCheckPath(listName);
    const response = await fetcher(path, {
      method: 'GET',
      headers: { Accept: 'application/json;odata=nometadata' },
    });

    return {
      key: entry.key,
      displayName: entry.displayName,
      listName,
      status: classifyStatus(response.status),
      httpStatus: response.status,
    };
  } catch (err) {
    return {
      key: entry.key,
      displayName: entry.displayName,
      listName,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Full check
// ---------------------------------------------------------------------------

/**
 * 全24リストのヘルスチェックを実行する。
 *
 * @param fetcher  spFetch 相当の関数（認証ヘッダーは外側で付与済み前提）
 * @param entries  チェック対象（デフォルト: 全レジストリ）
 * @returns 各リストの検証結果とサマリー
 */
export async function checkAllLists(
  fetcher: SpFetcher,
  entries: readonly SpListEntry[] = SP_LIST_REGISTRY,
): Promise<HealthCheckSummary> {
  // 並列実行（サーバー負荷を考慮して最大5並列）
  const CONCURRENCY = 5;
  const results: ListCheckResult[] = [];
  const queue = [...entries];

  while (queue.length > 0) {
    const batch = queue.splice(0, CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((entry) => checkSingleList(entry, fetcher)),
    );
    results.push(...batchResults);
  }

  return {
    total: results.length,
    ok: results.filter((r) => r.status === 'ok').length,
    notFound: results.filter((r) => r.status === 'not_found').length,
    forbidden: results.filter((r) => r.status === 'forbidden').length,
    errors: results.filter((r) => r.status === 'error').length,
    results,
  };
}
