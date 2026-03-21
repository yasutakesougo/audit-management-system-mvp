import { createSharePointPlanningSheetReassessmentRepository } from '@/data/isp/sharepoint';
import type { PlanningSheetReassessmentRepository } from '@/domain/isp/port';
import { useSP } from '@/lib/spClient';
import { useMemo } from 'react';

export function usePlanningSheetReassessmentRepository(): PlanningSheetReassessmentRepository {
  const client = useSP();

  return useMemo(
    () => createSharePointPlanningSheetReassessmentRepository(client),
    [client],
  );
}
