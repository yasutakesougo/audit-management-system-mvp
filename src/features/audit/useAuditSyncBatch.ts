import { getAppConfig } from '../../lib/env';
export * from './useAuditSyncBatch.core';
export { useAuditSyncBatch as default } from './useAuditSyncBatch.core';

// E2E テスト用の SyncResult 型（useAuditSyncBatch.core.ts の SyncResult と対応）
interface E2ESyncResult {
  total: number;
  success: number;
  failed?: number;
  duplicates?: number;
  errors?: { contentId: number; status: number; statusText: string }[];
  durationMs?: number;
  categories?: Record<string, number>;
}

// DEV 環境のみ: Playwright 等から監査バッチ同期を直接呼び出すための E2E 用フック
// 本番ビルドでは isDev=false により公開されない
if (typeof window !== 'undefined') {
  let isDev = false;
  try {
    isDev = Boolean(getAppConfig().isDev);
  } catch {
    // getAppConfig 失敗時は安全のため本番モード扱い
    isDev = false;
  }

  if (isDev) {
    // 型安全な E2E フック: SyncResult または error オブジェクトを返却
    (window as typeof window & {
      __E2E_INVOKE_SYNC_BATCH__?: (size?: number) => Promise<E2ESyncResult | { error: string }>
    }).__E2E_INVOKE_SYNC_BATCH__ = async (size?: number) => {
      try {
        const { useAuditSyncBatch } = await import('./useAuditSyncBatch.core');
        const hook = useAuditSyncBatch();
        return await hook.syncAllBatch(size);
      } catch (error) {
        return { error: String(error) };
      }
    };
  }
}
