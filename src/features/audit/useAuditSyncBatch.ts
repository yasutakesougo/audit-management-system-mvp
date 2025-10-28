import { getAppConfig } from '../../lib/env';
export * from './useAuditSyncBatch.core';
export { useAuditSyncBatch as default } from './useAuditSyncBatch.core';

if (typeof window !== 'undefined') {
  let isDev = false;
  try {
    isDev = Boolean(getAppConfig().isDev);
  } catch {
    isDev = false;
  }

  if (isDev) {
    (window as typeof window & { __E2E_INVOKE_SYNC_BATCH__?: (size?: number) => Promise<unknown> }).__E2E_INVOKE_SYNC_BATCH__ = async (size?: number) => {
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
