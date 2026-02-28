/**
 * SharePoint リスト設定 — 型安全な一元アクセス API
 *
 * 呼び出し側は、リストが環境変数由来か・ハードコード由来か・
 * Title ベースか GUID ベースか、一切気にする必要がない。
 *
 * @example
 * // リスト名の取得
 * const title = resolveListTitle('users_master');
 *
 * // REST API パス生成（Title/GUID 自動判定）
 * const endpoint = getListEndpointPath('compliance_check_rules');
 * // → /_api/web/lists(guid'576f882f-...')  (環境変数に guid: があれば)
 * // → /_api/web/lists/getbytitle('Compliance_CheckRules')  (なければ)
 *
 * // items パス
 * const items = getListItemsPath('users_master');
 * // → /_api/web/lists/getbytitle('Users_Master')/items
 */
import { SP_LIST_REGISTRY, type SpListEntry } from '@/sharepoint/spListRegistry';

// ---------------------------------------------------------------------------
// SpListKey — 型安全なリストキー
// ---------------------------------------------------------------------------

/**
 * 全24リストのキーを型として定義。
 * レジストリの key プロパティから自動導出されるため、
 * レジストリに追加すれば自動的にこの型にも反映される。
 */
export type SpListKey = (typeof SP_LIST_REGISTRY)[number]['key'];

// 内部: 高速ルックアップ用 Map
const _registryMap = new Map<string, SpListEntry>(
  SP_LIST_REGISTRY.map((e) => [e.key, e]),
);

// ---------------------------------------------------------------------------
// Core resolvers
// ---------------------------------------------------------------------------

/**
 * 指定されたキーのレジストリエントリを返す。
 * キーが存在しない場合は Error をスローする。
 */
export function getListEntry(key: SpListKey): SpListEntry {
  const entry = _registryMap.get(key);
  if (!entry) {
    throw new Error(`[spListConfig] Unknown list key: "${key}"`);
  }
  return entry;
}

/**
 * リスト識別子（env変数値 or フォールバック定数）を返す。
 * 返値は "Title名" か "guid:xxxxxxxx-..." 形式。
 */
export function resolveListIdentifier(key: SpListKey): string {
  return getListEntry(key).resolve();
}

/**
 * リスト名を返す。GUID プレフィックスは除去される。
 * ログ表示やデバッグ用途に適している。
 */
export function resolveListTitle(key: SpListKey): string {
  const raw = resolveListIdentifier(key);
  if (raw.toLowerCase().startsWith('guid:')) {
    return raw; // GUID はそのまま返す（Title に変換はできない）
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Identifier classification
// ---------------------------------------------------------------------------

export type ListIdentifierType = 'guid' | 'title';

export interface ResolvedListIdentifier {
  type: ListIdentifierType;
  value: string;
}

const GUID_PREFIX = 'guid:';
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * リスト識別子を解析し、type ('guid' | 'title') と value を返す。
 */
export function classifyIdentifier(raw: string): ResolvedListIdentifier {
  if (raw.toLowerCase().startsWith(GUID_PREFIX)) {
    return { type: 'guid', value: raw.slice(GUID_PREFIX.length).trim() };
  }
  if (GUID_REGEX.test(raw.trim())) {
    return { type: 'guid', value: raw.trim() };
  }
  return { type: 'title', value: raw };
}

/**
 * キーから分類済み識別子を取得する。
 */
export function resolveClassifiedIdentifier(key: SpListKey): ResolvedListIdentifier {
  return classifyIdentifier(resolveListIdentifier(key));
}

// ---------------------------------------------------------------------------
// Endpoint path builders — GUID/Title 透過
// ---------------------------------------------------------------------------

/**
 * SharePoint REST API のリストエンドポイントパスを生成する。
 * GUID の場合: /_api/web/lists(guid'xxx')
 * Title の場合: /_api/web/lists/getbytitle('xxx')
 */
export function getListEndpointPath(key: SpListKey): string {
  const { type, value } = resolveClassifiedIdentifier(key);

  if (type === 'guid') {
    return `/_api/web/lists(guid'${value}')`;
  }
  return `/_api/web/lists/getbytitle('${encodeURIComponent(value)}')`;
}

/**
 * リストアイテムの REST API パスを生成する。
 * /_api/web/lists/getbytitle('xxx')/items
 * /_api/web/lists(guid'xxx')/items
 */
export function getListItemsPath(key: SpListKey): string {
  return `${getListEndpointPath(key)}/items`;
}

/**
 * 特定アイテムの REST API パスを生成する。
 * /_api/web/lists/getbytitle('xxx')/items(42)
 */
export function getListItemPath(key: SpListKey, itemId: number): string {
  return `${getListItemsPath(key)}(${itemId})`;
}

/**
 * リストフィールド一覧の REST API パスを生成する。
 */
export function getListFieldsPath(key: SpListKey): string {
  return `${getListEndpointPath(key)}/fields`;
}

/**
 * ドキュメントライブラリの RootFolder/Files パスを生成する。
 * ファイルアップロード時に使用する。
 *
 * @example
 * getListRootFolderFilesPath('official_forms')
 * // → /_api/web/lists/getbytitle('OfficialForms')/RootFolder/Files
 */
export function getListRootFolderFilesPath(key: SpListKey): string {
  return `${getListEndpointPath(key)}/RootFolder/Files`;
}

// ---------------------------------------------------------------------------
// Display name (i18n ready)
// ---------------------------------------------------------------------------

/**
 * リストの日本語表示名を返す。
 */
export function getListDisplayName(key: SpListKey): string {
  return getListEntry(key).displayName;
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

/**
 * 全リストキーを返す。
 */
export function getAllListKeys(): SpListKey[] {
  return SP_LIST_REGISTRY.map((e) => e.key as SpListKey);
}

/**
 * 指定カテゴリのリストキーを返す。
 */
export function getListKeysByCategory(
  category: SpListEntry['category'],
): SpListKey[] {
  return SP_LIST_REGISTRY
    .filter((e) => e.category === category)
    .map((e) => e.key as SpListKey);
}
