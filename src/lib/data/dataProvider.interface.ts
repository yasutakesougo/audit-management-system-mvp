/**
 * Data Access Layer — Provider Interface
 * 
 * バックエンド（SharePoint, Dataverse, InMemory, etc.）を抽象化するための最小インターフェース。
 */

import type { SpFieldDef } from '@/lib/sp/types';

/** クエリ用オプション。OData ベースの構文を標準とする（SP/Dataverse 互換） */
export interface DataProviderOptions {
  select?: string[];
  filter?: string;
  orderby?: string;
  top?: number;
  expand?: string[];
  /** ページング上限（大量データ取得の安全装置） */
  pageCap?: number;
  signal?: AbortSignal;
  /** 実行時に特定のフィールドが（不整合などで）除外された際の通知 */
  onFieldRemoved?: (fieldName: string, status: number, error: string) => void;
  /** 致命的なスキーマ不整合により最小構成へのフォールバックが発生した際の通知 */
  onCriticalFallback?: (status: number, error: string) => void;
}

export interface UpdateOptions {
  /** 楽観的ロック用の ETag / If-Match */
  etag?: string;
  signal?: AbortSignal;
}

/**
 * データプロバイダーの基本インターフェース
 */
export interface IDataProvider {
  /** 
   * リソース（リスト/テーブル）のアイテム一覧を取得 
   */
  listItems<T>(resourceName: string, options?: DataProviderOptions): Promise<T[]>;

  /** 
   * 単一アイテムを ID で取得 
   */
  getItemById<T>(resourceName: string, id: string | number, options?: DataProviderOptions): Promise<T>;

  /** 
   * アイテムの新規作成 
   */
  createItem<T>(resourceName: string, payload: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<T>;

  /** 
   * アイテムの更新 
   */
  updateItem<T>(
    resourceName: string, 
    id: string | number, 
    payload: Record<string, unknown>, 
    options?: UpdateOptions
  ): Promise<T>;

  /** 
   * アイテムの削除 
   */
  deleteItem(resourceName: string, id: string | number, options?: { signal?: AbortSignal }): Promise<void>;

  /** 
   * メタデータ（GUID 解決後の情報など）の取得 
   */
  getMetadata(resourceName: string): Promise<Record<string, unknown>>;

  /**
   * 利用可能なリソース（リスト/テーブル）名を列挙する。
   * Dynamic Schema Resolution の catalog 解決に使用する。
   */
  getResourceNames(): Promise<string[]>;
  
  /**
   * フィールド（列）の内部名一覧を取得（Dynamic Schema Resolution 用）
   */
  getFieldInternalNames(resourceName: string): Promise<Set<string>>;

  /**
   * 自己修復 (Self-Healing) 用: リソース（リスト）の存在と、指定された列定義を確認し、
   * 不足があれば追加します。
   */
  ensureListExists(resourceName: string, fields: SpFieldDef[]): Promise<void>;

  /**
   * シードデータの注入（テスト・デモ用オプション）
   */
  seed?(resourceName: string, items: Array<Record<string, unknown>>): Promise<void>;
}
