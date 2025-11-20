import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import type { UseSP } from '@/lib/spClient';

export type UpdateScheduleRequest = {
  id: number;
  etag?: string;
  patch: Record<string, unknown>;
};

export async function updateSchedule(_sp: UseSP, _request: UpdateScheduleRequest): Promise<void> {
  const span = startFeatureSpan(HYDRATION_FEATURES.schedules.write, {
    operation: 'updateSchedule',
    bytes: estimatePayloadSize(_request),
  });
  try {
    // Demo environment stub – real implementation will call SharePoint.
    span({ meta: { status: 'noop' } });
  } catch (error) {
    span({
      meta: { status: 'error' },
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
