/**
 * Repository Contract Types
 * 
 * データ層における「更新」という行為の厳格な型定義。
 */

/**
 * クリア可能な値の基本型。
 * - undefined: 何もしない（値を変えない）
 * - null: 値をクリアする（SharePoint 側を null にする）
 */
export type Clearable<T> = T | null | undefined;

/**
 * リポジトリが受け取るべき正規化されたペイロード。
 * T のすべてのプロパティを Clearable に変換し、
 * 「不変(undefined)」か「クリア(null)」かを明示的に扱うことを強制する。
 */
export type NormalizedPayload<T> = {
  [K in keyof T]?: Clearable<T[K]>;
};

/**
 * 物理的な書き込みペイロード（正規化済み）。
 * 文字列の空文字などはすでに null に変換されている状態。
 */
export type PhysicalWritePayload = Record<string, unknown>;
