import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import { buildEq } from '@/sharepoint/query/builders';
import type { 
  MonitoringMeetingRepository 
} from '@/domain/isp/monitoringMeetingRepository';
import type {
  MonitoringMeetingRecord,
  MeetingType,
  PlanChangeDecision,
  GoalEvaluation,
  MeetingAttendee,
  MeetingStatus,
} from '@/domain/isp/monitoringMeeting';
import {
  MONITORING_MEETING_CANDIDATES,
  MONITORING_MEETING_ENSURE_FIELDS,
  safeJsonParse,
  type MonitoringMeetingCandidateKey,
  type MonitoringMeetingFieldMapping,
  type SpMonitoringMeetingRow,
} from '@/sharepoint/fields/monitoringMeetingFields';
import { MonitoringMeetingSchemaResolver } from './modules/MonitoringMeetingSchemaResolver';

/**
 * DataProviderMonitoringMeetingRepository
 * 
 * IDataProvider ベースの MonitoringMeetingRepository 実装。
 * モニタリング会議記録の管理を担当する。
 */
export class DataProviderMonitoringMeetingRepository implements MonitoringMeetingRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  private readonly schemaResolver: MonitoringMeetingSchemaResolver;

  constructor(provider: IDataProvider, listTitle: string = 'MonitoringMeetings') {
    this.provider = provider;
    this.listTitle = listTitle;
    this.schemaResolver = new MonitoringMeetingSchemaResolver(provider, listTitle);
  }

  private mf(mapping: MonitoringMeetingFieldMapping, key: MonitoringMeetingCandidateKey): string {
    return mapping[key] ?? MONITORING_MEETING_CANDIDATES[key][0];
  }

  private async ensureResolvedSchema(): Promise<{ listTitle: string; mapping: MonitoringMeetingFieldMapping; select: readonly string[] }> {
    const resolved = await this.schemaResolver.resolve();
    if (resolved) return resolved;

    // Fail-open with self-healing: ensure list and reprobe once.
    auditLog.warn('monitoring', `Schema resolution failed for ${this.listTitle}. Triggering self-healing...`);
    type FieldsType = Parameters<IDataProvider['ensureListExists']>[1];
    await this.provider.ensureListExists(this.listTitle, [...MONITORING_MEETING_ENSURE_FIELDS] as unknown as FieldsType);
    this.schemaResolver.reset();

    const healed = await this.schemaResolver.resolve();
    if (healed) return healed;

    throw new Error(`MonitoringMeeting schema could not be resolved: ${this.listTitle}`);
  }

  async getAll(): Promise<MonitoringMeetingRecord[]> {
    const { listTitle, mapping, select } = await this.ensureResolvedSchema();
    try {
      const rows = await this.provider.listItems<SpMonitoringMeetingRow>(listTitle, {
        select: [...select],
        orderby: `${this.mf(mapping, 'meetingDate')} desc`,
        top: 500,
      });
      return rows.map((row) => this.mapSpRowToRecord(row, mapping));
    } catch (err) {
      auditLog.error('monitoring', 'Failed to list all meetings', err);
      return [];
    }
  }

  async getById(id: string): Promise<MonitoringMeetingRecord | null> {
    const { listTitle, mapping, select } = await this.ensureResolvedSchema();
    try {
      const rows = await this.provider.listItems<SpMonitoringMeetingRow>(listTitle, {
        select: [...select],
        filter: buildEq(this.mf(mapping, 'recordId'), id),
        top: 1,
      });
      return rows[0] ? this.mapSpRowToRecord(rows[0], mapping) : null;
    } catch (err) {
      auditLog.error('monitoring', `Failed to get meeting by id: ${id}`, err);
      return null;
    }
  }

  async listByUser(userId: string): Promise<MonitoringMeetingRecord[]> {
    const { listTitle, mapping, select } = await this.ensureResolvedSchema();
    try {
      const rows = await this.provider.listItems<SpMonitoringMeetingRow>(listTitle, {
        select: [...select],
        filter: buildEq(this.mf(mapping, 'userId'), userId),
        orderby: `${this.mf(mapping, 'meetingDate')} desc`,
      });
      return rows.map((row) => this.mapSpRowToRecord(row, mapping));
    } catch (err) {
      auditLog.error('monitoring', `Failed to list meetings for user: ${userId}`, err);
      return [];
    }
  }

  async listByIsp(ispId: string): Promise<MonitoringMeetingRecord[]> {
    const { listTitle, mapping, select } = await this.ensureResolvedSchema();
    try {
      const rows = await this.provider.listItems<SpMonitoringMeetingRow>(listTitle, {
        select: [...select],
        filter: buildEq(this.mf(mapping, 'ispId'), ispId),
        orderby: `${this.mf(mapping, 'meetingDate')} desc`,
      });
      return rows.map((row) => this.mapSpRowToRecord(row, mapping));
    } catch (err) {
      auditLog.error('monitoring', `Failed to list meetings for isp: ${ispId}`, err);
      return [];
    }
  }

  async save(record: MonitoringMeetingRecord): Promise<MonitoringMeetingRecord> {
    const { listTitle, mapping } = await this.ensureResolvedSchema();
    const body = this.buildPatchBody(record, mapping);
    
    try {
      const spId = await this.findSpItemIdByRecordId(record.id, listTitle, mapping);

      if (spId !== null) {
        await this.provider.updateItem(listTitle, String(spId), body, { etag: '*' });
      } else {
        await this.provider.createItem<Record<string, unknown>>(listTitle, body);
      }

      const updated = await this.getById(record.id);
      if (!updated) throw new Error('Failed to re-fetch meeting after save');
      return updated;
    } catch (err) {
      auditLog.error('monitoring', 'Failed to save meeting record', err);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    const { listTitle, mapping } = await this.ensureResolvedSchema();
    try {
      const spId = await this.findSpItemIdByRecordId(id, listTitle, mapping);
      if (spId !== null) {
        await this.provider.deleteItem(listTitle, String(spId));
      }
    } catch (err) {
      auditLog.error('monitoring', `Failed to delete meeting: ${id}`, err);
      throw err;
    }
  }

  private async findSpItemIdByRecordId(
    recordId: string,
    listTitle: string,
    mapping: MonitoringMeetingFieldMapping,
  ): Promise<number | null> {
    const rows = await this.provider.listItems<SpMonitoringMeetingRow>(listTitle, {
      select: ['Id'],
      filter: buildEq(this.mf(mapping, 'recordId'), recordId),
      top: 1,
    });
    const spId = rows[0]?.Id;
    return typeof spId === 'number' && spId > 0 ? spId : null;
  }

  private mapSpRowToRecord(row: SpMonitoringMeetingRow, mapping: MonitoringMeetingFieldMapping): MonitoringMeetingRecord {
    return {
      id: String(row[this.mf(mapping, 'recordId')] ?? ''),
      userId: String(row[this.mf(mapping, 'userId')] ?? ''),
      userName: (row[this.mf(mapping, 'userName')] as string | undefined) || undefined,
      ispId: String(row[this.mf(mapping, 'ispId')] ?? ''),
      planningSheetId: (row[this.mf(mapping, 'planningSheetId')] as string | undefined) || undefined,
      planningSheetTitle: (row[this.mf(mapping, 'planningSheetTitle')] as string | undefined) || undefined,
      meetingType: ((row[this.mf(mapping, 'meetingType')] as string | undefined) || 'regular') as MeetingType,
      meetingDate: (row[this.mf(mapping, 'meetingDate')] as string | undefined) || '',
      venue: (row[this.mf(mapping, 'venue')] as string | undefined) || '',
      attendees: safeJsonParse<MeetingAttendee[]>(row[this.mf(mapping, 'attendeesJson')], []),
      goalEvaluations: safeJsonParse<GoalEvaluation[]>(row[this.mf(mapping, 'goalEvaluationsJson')], []),
      overallAssessment: (row[this.mf(mapping, 'overallAssessment')] as string | undefined) || '',
      userFeedback: (row[this.mf(mapping, 'userFeedback')] as string | undefined) || '',
      familyFeedback: (row[this.mf(mapping, 'familyFeedback')] as string | undefined) || '',
      planChangeDecision: ((row[this.mf(mapping, 'planChangeDecision')] as string | undefined) || 'no_change') as PlanChangeDecision,
      changeReason: (row[this.mf(mapping, 'changeReason')] as string | undefined) || '',
      decisions: safeJsonParse<string[]>(row[this.mf(mapping, 'decisionsJson')], []),
      nextMonitoringDate: (row[this.mf(mapping, 'nextMonitoringDate')] as string | undefined) || '',
      recordedBy: (row[this.mf(mapping, 'recordedBy')] as string | undefined) || '',
      recordedAt: (row[this.mf(mapping, 'recordedAt')] as string | undefined) || '',

      // 強度行動障害支援
      implementationSummary: (row[this.mf(mapping, 'implementationSummary')] as string | undefined) || '',
      behaviorChangeSummary: (row[this.mf(mapping, 'behaviorChangeSummary')] as string | undefined) || '',
      effectiveSupportSummary: (row[this.mf(mapping, 'effectiveSupportSummary')] as string | undefined) || '',
      issueSummary: (row[this.mf(mapping, 'issueSummary')] as string | undefined) || '',
      discussionSummary: (row[this.mf(mapping, 'discussionSummary')] as string | undefined) || '',
      requiresPlanSheetUpdate: Boolean(row[this.mf(mapping, 'requiresPlanSheetUpdate')]),
      requiresIspUpdate: Boolean(row[this.mf(mapping, 'requiresIspUpdate')]),
      nextActions: safeJsonParse<string[]>(row[this.mf(mapping, 'nextActions')], []),
      hasBasicTrainedMember: Boolean(row[this.mf(mapping, 'hasBasicTrainedMember')]),
      hasPracticalTrainedMember: Boolean(row[this.mf(mapping, 'hasPracticalTrainedMember')]),
      qualificationCheckStatus: (row[this.mf(mapping, 'qualificationCheckStatus')] as 'ok' | 'warning' | 'invalid' | undefined) || 'ok',

      // 監査ステータス
      status: (row[this.mf(mapping, 'status')] as MeetingStatus) || 'draft',
      finalizedAt: (row[this.mf(mapping, 'finalizedAt')] as string | undefined) || undefined,
      finalizedBy: (row[this.mf(mapping, 'finalizedBy')] as string | undefined) || undefined,
      previousMeetingId: (row[this.mf(mapping, 'previousMeetingId')] as string | undefined) || undefined,
    };
  }

  private buildPatchBody(record: MonitoringMeetingRecord, mapping: MonitoringMeetingFieldMapping): Record<string, unknown> {
    const meetingDate = record.meetingDate?.slice(0, 10) ?? '';
    const nextMonitoringDate = record.nextMonitoringDate?.slice(0, 10) ?? '';

    return {
      Title: `${record.userId}_${meetingDate}`,
      [this.mf(mapping, 'recordId')]: record.id,
      [this.mf(mapping, 'userId')]: record.userId,
      [this.mf(mapping, 'userName')]: record.userName || '',
      [this.mf(mapping, 'ispId')]: record.ispId,
      [this.mf(mapping, 'planningSheetId')]: record.planningSheetId ?? '',
      [this.mf(mapping, 'planningSheetTitle')]: record.planningSheetTitle ?? '',
      [this.mf(mapping, 'meetingType')]: record.meetingType,
      [this.mf(mapping, 'meetingDate')]: meetingDate,
      [this.mf(mapping, 'venue')]: record.venue,
      [this.mf(mapping, 'attendeesJson')]: JSON.stringify(record.attendees),
      [this.mf(mapping, 'goalEvaluationsJson')]: JSON.stringify(record.goalEvaluations),
      [this.mf(mapping, 'overallAssessment')]: record.overallAssessment,
      [this.mf(mapping, 'userFeedback')]: record.userFeedback,
      [this.mf(mapping, 'familyFeedback')]: record.familyFeedback ?? '',
      [this.mf(mapping, 'planChangeDecision')]: record.planChangeDecision,
      [this.mf(mapping, 'changeReason')]: record.changeReason ?? '',
      [this.mf(mapping, 'decisionsJson')]: JSON.stringify(record.decisions ?? []),
      [this.mf(mapping, 'nextMonitoringDate')]: nextMonitoringDate,
      [this.mf(mapping, 'recordedBy')]: record.recordedBy,
      [this.mf(mapping, 'recordedAt')]: record.recordedAt,

      // 強度行動障害支援
      [this.mf(mapping, 'implementationSummary')]: record.implementationSummary || '',
      [this.mf(mapping, 'behaviorChangeSummary')]: record.behaviorChangeSummary || '',
      [this.mf(mapping, 'effectiveSupportSummary')]: record.effectiveSupportSummary || '',
      [this.mf(mapping, 'issueSummary')]: record.issueSummary || '',
      [this.mf(mapping, 'discussionSummary')]: record.discussionSummary || '',
      [this.mf(mapping, 'requiresPlanSheetUpdate')]: Boolean(record.requiresPlanSheetUpdate),
      [this.mf(mapping, 'requiresIspUpdate')]: Boolean(record.requiresIspUpdate),
      [this.mf(mapping, 'nextActions')]: JSON.stringify(record.nextActions ?? []),
      [this.mf(mapping, 'hasBasicTrainedMember')]: Boolean(record.hasBasicTrainedMember),
      [this.mf(mapping, 'hasPracticalTrainedMember')]: Boolean(record.hasPracticalTrainedMember),
      [this.mf(mapping, 'qualificationCheckStatus')]: record.qualificationCheckStatus || 'ok',

      // 監査ステータス
      [this.mf(mapping, 'status')]: record.status || 'draft',
      [this.mf(mapping, 'finalizedAt')]: record.finalizedAt || '',
      [this.mf(mapping, 'finalizedBy')]: record.finalizedBy || '',
      [this.mf(mapping, 'previousMeetingId')]: record.previousMeetingId || '',
    };
  }
}
