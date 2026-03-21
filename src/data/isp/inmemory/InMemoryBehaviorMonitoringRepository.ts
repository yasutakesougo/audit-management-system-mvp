import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';
import type { BehaviorMonitoringRepository } from '@/domain/isp/port';

export class InMemoryBehaviorMonitoringRepository
  implements BehaviorMonitoringRepository
{
  constructor(private records: BehaviorMonitoringRecord[] = []) {}

  setRecords(records: BehaviorMonitoringRecord[]): void {
    this.records = [...records];
  }

  async findByPlanningSheetId(params: {
    planningSheetId: string;
    userId: string;
  }): Promise<BehaviorMonitoringRecord[]> {
    const { planningSheetId, userId } = params;

    return this.records
      .filter(
        (record) =>
          record.planningSheetId === planningSheetId && record.userId === userId,
      )
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  }
}
