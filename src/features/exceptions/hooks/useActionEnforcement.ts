import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useExceptionCenterOrchestrator } from './useExceptionCenterOrchestrator';
import { useWorkTaskStore } from '../store/workTaskStore';

/**
 * @fileoverview 行動強制ロジック (Action Enforcement Hook)
 * @description
 * 致命的な不備（Critical/High Tasks）がある場合、ユーザーを Today 画面等へ拘束し、
 * 「対応しないと他の業務ができない」状態を作り出す。
 */

import { MANDATORY_TASK_MESSAGES, MandatoryTaskCategory } from '../domain/mandatoryTaskMessages';

export type ActionEnforcementMode = 'warn' | 'soft-lock' | 'hard-lock';

export function useActionEnforcement() {
  const { items, isLoading } = useExceptionCenterOrchestrator();
  const location = useLocation();
  const acknowledgedIds = useWorkTaskStore(s => s.acknowledgedIds);

  const enforcement = useMemo(() => {
    // 導入フェーズ設定 (本来はサーバー/Feature Flagから取得)
    const mode = 'soft-lock' as ActionEnforcementMode;

    if (isLoading) return { isBlocked: false, criticalTasks: [], totalCriticalCount: 0, mode, blockingMessage: '', resolutionHint: '' };

    // 拘束対象: Critical または High のタスク
    const criticalTasks = items.filter(
      item => item.severity === 'critical' || item.severity === 'high'
    );

    const unacknowledgedCriticals = criticalTasks.filter(
      t => !acknowledgedIds[t.stableId || t.id]
    );

    const hasUrgentTasks = unacknowledgedCriticals.length > 0;
    
    // 現在のページが「逃げ道」として許可されているか
    const isWhiteListedPage = 
      location.pathname === '/today' || 
      location.pathname === '/exception-center' ||
      location.pathname.startsWith('/auth');

    // ロック判定の基本条件
    const shouldBlock = hasUrgentTasks && !isWhiteListedPage;

    // モードに応じたブロック挙動の調整
    const isBlocked = mode === 'warn' ? false : shouldBlock;

    // 代表的なカテゴリーの決定 (最初のタスクを優先)
    const firstTask = unacknowledgedCriticals[0];
    const category: MandatoryTaskCategory = firstTask?.mandatoryCategory || 
                                              (firstTask?.title?.includes('記録') ? 'MISSING_RECORD' : 
                                               firstTask?.title?.includes('計画') ? 'PLAN_GAP' : 
                                               'DEFAULT');
    
    const messages = MANDATORY_TASK_MESSAGES[category];

    return {
      isBlocked,
      mode,
      criticalTasks: unacknowledgedCriticals,
      totalCriticalCount: criticalTasks.length,
      // 現場向けメッセージ (マトリクスから取得)
      blockingMessage: messages.blockingMessage,
      resolutionHint: messages.resolutionHint,
    };
  }, [items, isLoading, location.pathname, acknowledgedIds]);

  return enforcement;
}
