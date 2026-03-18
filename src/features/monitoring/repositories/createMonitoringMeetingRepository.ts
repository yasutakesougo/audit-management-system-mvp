// ---------------------------------------------------------------------------
// createMonitoringMeetingRepository — Repository Factory
//
// モニタリング会議記録の永続化先を、mode に応じて切り替える唯一の注入点。
// UI コンポーネントは直接 localStorage / SharePoint 実装を import しない。
//
// 使い方:
//   const repo = createMonitoringMeetingRepository();          // default: local
//   const repo = createMonitoringMeetingRepository('local');
//   const repo = createMonitoringMeetingRepository('sharepoint'); // 将来
//
// @see src/domain/isp/monitoringMeetingRepository.ts (Port)
// ---------------------------------------------------------------------------

import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import { localMonitoringMeetingRepository } from '@/infra/localStorage/localMonitoringMeetingRepository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Repository の実装モード。
 *
 * - `'local'`      — localStorage ベース（開発・デモ用）
 * - `'sharepoint'` — SharePoint リスト（本番用、未実装）
 */
export type MonitoringRepositoryMode = 'local' | 'sharepoint';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * mode に応じた MonitoringMeetingRepository を返す。
 *
 * デフォルトは `'local'`。
 * SharePoint 実装が追加されたら、ここに分岐を1行足すだけで切替完了。
 *
 * @example
 * ```ts
 * // UI 側
 * const repo = createMonitoringMeetingRepository();
 * useLatestBehaviorMonitoring(userId, { repository: repo });
 * ```
 */
export function createMonitoringMeetingRepository(
  mode: MonitoringRepositoryMode = 'local',
): MonitoringMeetingRepository {
  switch (mode) {
    case 'local':
      return localMonitoringMeetingRepository;

    case 'sharepoint':
      // TODO: SharePoint 実装が完成したら差し替え
      // return spMonitoringMeetingRepository;
      throw new Error(
        '[createMonitoringMeetingRepository] sharepoint mode is not yet implemented. ' +
        'Use "local" until spMonitoringMeetingRepository is available.',
      );

    default: {
      const _exhaustive: never = mode;
      throw new Error(`Unknown repository mode: ${_exhaustive}`);
    }
  }
}
