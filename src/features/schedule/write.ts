import type { UseSP } from '@/lib/spClient';

export type UpdateScheduleRequest = {
  id: number;
  etag?: string;
  patch: Record<string, unknown>;
};

export async function updateSchedule(_sp: UseSP, _request: UpdateScheduleRequest): Promise<void> {
  // Demo environment stub – real implementation will call SharePoint.
}
