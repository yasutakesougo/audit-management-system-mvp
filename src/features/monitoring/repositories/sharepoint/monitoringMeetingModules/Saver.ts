/**
 * MonitoringMeeting Saver — GenericSaver 利用版
 *
 * ドメイン固有のペイロード変換のみ担当。
 * Fail-Open ペイロード構築と SP REST 操作は GenericSaver に委譲。
 */
import type { SpFetchFn } from '@/lib/sp/spLists';
import { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import { MonitoringMeetingSchemaResolver } from './SchemaResolver';
import { auditLog } from '@/lib/debugLogger';
import {
  buildFailOpenPayload,
  spCreate,
  spUpdate,
  type FieldMapping,
} from '@/lib/sp/GenericSaver';

export class MonitoringMeetingSaver {
  constructor(
    private readonly spFetch: SpFetchFn,
    private readonly schema: MonitoringMeetingSchemaResolver
  ) {}

  public async save(
    record: MonitoringMeetingRecord,
    listPath: string,
    existingSpId: number | null
  ): Promise<void> {
    const resolved = await this.schema.getResolvedCanonicalNames();

    // ドメイン固有: MonitoringMeetingRecord → FieldMapping[] 変換
    const mappings: FieldMapping[] = [
      [record.id, 'recordId'],
      [record.userId, 'userId'],
      [record.ispId, 'ispId'],
      [record.planningSheetId, 'planningSheetId'],
      [record.meetingType, 'meetingType'],
      [record.meetingDate?.split('T')[0], 'meetingDate'],
      [record.venue, 'venue'],
      [JSON.stringify(record.attendees), 'attendeesJson'],
      [JSON.stringify(record.goalEvaluations), 'goalEvaluationsJson'],
      [record.overallAssessment, 'overallAssessment'],
      [record.userFeedback, 'userFeedback'],
      [record.familyFeedback, 'familyFeedback'],
      [record.planChangeDecision, 'planChangeDecision'],
      [record.changeReason, 'changeReason'],
      [JSON.stringify(record.decisions), 'decisionsJson'],
      [record.nextMonitoringDate?.split('T')[0], 'nextMonitoringDate'],
      [record.recordedBy, 'recordedBy'],
      [record.recordedAt, 'recordedAt'],
    ];

    const { payload } = buildFailOpenPayload(
      resolved,
      mappings,
      'MonitoringMeetings',
      record.id, // Title fallback
    );

    try {
      if (existingSpId) {
        await spUpdate(this.spFetch, listPath, existingSpId, payload);
      } else {
        await spCreate(this.spFetch, listPath, payload);
      }

      auditLog.info('monitoring', 'MonitoringMeeting saved successfully', {
        id: record.id,
      });
    } catch (error: unknown) {
      auditLog.error('monitoring', `Failed to save meeting: ${record.id}`, error);
      throw error;
    }
  }
}
