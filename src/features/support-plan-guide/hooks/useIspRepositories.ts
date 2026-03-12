/**
 * useIspRepositories — ISP 三層 Repository インスタンスを提供する hook
 *
 * useSP() で取得した SharePoint client から ISP 三層の Repository を初期化する。
 *
 * @see src/data/isp/sharepoint/SharePointIspRepository.ts
 * @see src/data/isp/sharepoint/SharePointPlanningSheetRepository.ts
 * @see src/data/isp/sharepoint/SharePointProcedureRecordRepository.ts
 */
import { useMemo } from 'react';
import { useSP } from '@/lib/spClient';
import { createSharePointIspRepository } from '@/data/isp/sharepoint/SharePointIspRepository';
import { createSharePointPlanningSheetRepository } from '@/data/isp/sharepoint/SharePointPlanningSheetRepository';
import { createSharePointProcedureRecordRepository } from '@/data/isp/sharepoint/SharePointProcedureRecordRepository';
import type { SupportPlanBundleRepositories } from './useSupportPlanBundle';

/**
 * ISP 三層 Repository を初期化して返す。
 * useSP() は常に呼び出す（Hook のルール遵守）。
 * データ取得時のエラーは useSupportPlanBundle 側でキャッチする。
 */
export function useIspRepositories(): SupportPlanBundleRepositories {
  const client = useSP();

  return useMemo(() => ({
    ispRepo: createSharePointIspRepository(client),
    planningSheetRepo: createSharePointPlanningSheetRepository(client),
    procedureRecordRepo: createSharePointProcedureRecordRepository(client),
  }), [client]);
}
