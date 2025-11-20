/**
 * 申し送りタイムライン機能の設定
 * Phase 8A: SharePoint API実装
 */

/**
 * 申し送りタイムラインの設定
 */
export const handoffConfig = {
  // SharePoint リスト設定
  listTitle: import.meta.env.VITE_SP_HANDOFF_LIST_TITLE || 'Handoff_Timeline',
  listId: import.meta.env.VITE_SP_HANDOFF_LIST_ID,

  // ストレージ戦略切り替え
  storage: (import.meta.env.VITE_HANDOFF_STORAGE || 'local') as 'local' | 'sharepoint',

  // デバッグ設定
  debug: import.meta.env.DEV || import.meta.env.VITE_HANDOFF_DEBUG === 'true',
} as const;

/**
 * 設定値の検証
 */
export function validateHandoffConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (handoffConfig.storage === 'sharepoint') {
    if (!handoffConfig.listTitle && !handoffConfig.listId) {
      errors.push('SharePoint mode requires either VITE_SP_HANDOFF_LIST_TITLE or VITE_SP_HANDOFF_LIST_ID');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 設定状況をログ出力
 */
export function logHandoffConfig() {
  if (handoffConfig.debug) {
    console.log('[handoff] Configuration:', {
      storage: handoffConfig.storage,
      listTitle: handoffConfig.listTitle,
      hasListId: !!handoffConfig.listId,
    });

    const validation = validateHandoffConfig();
    if (!validation.valid) {
      console.warn('[handoff] Configuration errors:', validation.errors);
    }
  }
}