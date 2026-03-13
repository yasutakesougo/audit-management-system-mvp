/**
 * usePlanningSheetRepositories — 支援計画シート画面用 Repository DI hook
 *
 * useSP() で取得した SharePoint client から PlanningSheetRepository を生成する。
 * useIspRepositories() と同じパターン。
 *
 * @see src/features/support-plan-guide/hooks/useIspRepositories.ts
 */
import { useMemo } from 'react';
import { useSP } from '@/lib/spClient';
import { createSharePointPlanningSheetRepository } from '@/data/isp/sharepoint/SharePointPlanningSheetRepository';
import type { PlanningSheetRepository } from '@/domain/isp/port';

/**
 * PlanningSheetRepository インスタンスを提供する。
 * useSP() は常に呼び出す（Hook のルール遵守）。
 */
export function usePlanningSheetRepositories(): PlanningSheetRepository {
  const client = useSP();

  return useMemo(
    () => createSharePointPlanningSheetRepository(client),
    [client],
  );
}
