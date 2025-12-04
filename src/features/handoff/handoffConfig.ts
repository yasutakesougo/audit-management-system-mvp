/**
 * 申し送りタイムライン機能の設定
 * Phase 8A: SharePoint API実装
 */

import { getAppConfig, readBool, readEnv, readOptionalEnv } from '@/lib/env';

/**
 * 申し送りタイムラインの設定
 */
export const handoffConfig = {
  // SharePoint リスト設定
  listTitle: readEnv('VITE_SP_HANDOFF_LIST_TITLE', 'Handoff_Timeline'),
  listId: readOptionalEnv('VITE_SP_HANDOFF_LIST_ID'),

  // ストレージ戦略切り替え
  storage: (readEnv('VITE_HANDOFF_STORAGE', 'local') as 'local' | 'sharepoint'),

  // デバッグ設定
  debug: getAppConfig().isDev || readBool('VITE_HANDOFF_DEBUG', false),
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