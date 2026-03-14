/**
 * useProcedureRecordRepository — 支援手順記録 Repository DI hook
 *
 * useSP() で取得した SharePoint client から ProcedureRecordRepository を生成する。
 * usePlanningSheetRepositories() と同じパターン。
 *
 * @see src/data/isp/sharepoint/SharePointProcedureRecordRepository.ts
 */
import { useMemo } from 'react';
import { useSP } from '@/lib/spClient';
import { createSharePointProcedureRecordRepository } from '@/data/isp/sharepoint/SharePointProcedureRecordRepository';
import type { ProcedureRecordRepository } from '@/domain/isp/port';

/**
 * ProcedureRecordRepository インスタンスを提供する。
 * useSP() は常に呼び出す（Hook のルール遵守）。
 */
export function useProcedureRecordRepository(): ProcedureRecordRepository {
  const client = useSP();

  return useMemo(
    () => createSharePointProcedureRecordRepository(client),
    [client],
  );
}
