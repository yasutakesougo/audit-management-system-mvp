// ---------------------------------------------------------------------------
// createMonitoringMeetingRepository — Repository Factory
//
// モニタリング会議記録の永続化先を、mode に応じて切り替える唯一の注入点。
// UI コンポーネントは直接 localStorage / SharePoint 実装を import しない。
//
// 使い方:
//   const repo = createMonitoringMeetingRepository();          // default: local
//   const repo = createMonitoringMeetingRepository('local');
//   const repo = createMonitoringMeetingRepository('sharepoint', { spClient });
//
// @see src/domain/isp/monitoringMeetingRepository.ts (Port)
// ---------------------------------------------------------------------------

import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import { localMonitoringMeetingRepository } from '@/infra/localStorage/localMonitoringMeetingRepository';
import { createSpMonitoringMeetingRepository } from '@/infra/sharepoint/repos/spMonitoringMeetingRepository';
import type { UseSP } from '@/lib/spClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Repository の実装モード。
 *
 * - `'local'`      — localStorage ベース（開発・デモ用）
 * - `'sharepoint'` — SharePoint リスト（本番用）
 */
export type MonitoringRepositoryMode = 'local' | 'sharepoint';

/**
 * Factory のオプション。
 * `sharepoint` モードでは `spClient` が必須。
 */
export interface MonitoringRepositoryOptions {
  /** useSP() の戻り値。sharepoint モードで必須 */
  spClient?: UseSP;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * mode に応じた MonitoringMeetingRepository を返す。
 *
 * デフォルトは `'local'`。
 *
 * @example
 * ```ts
 * // local mode (開発・デモ)
 * const repo = createMonitoringMeetingRepository();
 *
 * // SharePoint mode (本番)
 * const sp = useSP();
 * const repo = createMonitoringMeetingRepository('sharepoint', { spClient: sp });
 * ```
 */
export function createMonitoringMeetingRepository(
  mode: MonitoringRepositoryMode = 'local',
  options: MonitoringRepositoryOptions = {},
): MonitoringMeetingRepository {
  switch (mode) {
    case 'local':
      return localMonitoringMeetingRepository;

    case 'sharepoint': {
      if (!options.spClient) {
        throw new Error(
          '[createMonitoringMeetingRepository] sharepoint mode requires options.spClient. ' +
          'Pass useSP() result via { spClient }.',
        );
      }
      return createSpMonitoringMeetingRepository(options.spClient);
    }

    default: {
      const _exhaustive: never = mode;
      throw new Error(`Unknown repository mode: ${_exhaustive}`);
    }
  }
}

