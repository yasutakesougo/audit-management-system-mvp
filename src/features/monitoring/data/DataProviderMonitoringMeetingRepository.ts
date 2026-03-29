import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import { escapeODataString } from '@/lib/odata';
import { resolveInternalNames } from '@/lib/sp/helpers';
import type { 
  MonitoringMeetingRepository 
} from '@/domain/isp/monitoringMeetingRepository';
import type {
  MonitoringMeetingRecord,
  MeetingType,
  PlanChangeDecision,
  GoalEvaluation,
  MeetingAttendee,
} from '@/domain/isp/monitoringMeeting';
import {
  MONITORING_MEETING_CANDIDATES,
  MONITORING_MEETING_ENSURE_FIELDS,
  safeJsonParse,
  type SpMonitoringMeetingRow,
} from '@/sharepoint/fields/monitoringMeetingFields';

/**
 * DataProviderMonitoringMeetingRepository
 * 
 * IDataProvider ベースの MonitoringMeetingRepository 実装。
 * モニタリング会議記録の管理を担当する。
 */
export class DataProviderMonitoringMeetingRepository implements MonitoringMeetingRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  private resolvedFields: Record<string, string> | null = null;

  constructor(provider: IDataProvider, listTitle: string = 'MonitoringMeetings') {
    this.provider = provider;
    this.listTitle = listTitle;
  }

  private async ensureResolved(): Promise<Record<string, string>> {
    if (this.resolvedFields) return this.resolvedFields;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      const resolved = resolveInternalNames(available, MONITORING_MEETING_CANDIDATES as unknown as Record<string, string[]>) as Record<string, string>;
      this.resolvedFields = resolved;
      return resolved;
    } catch (err) {
      auditLog.warn('monitoring', `Field resolution failed for ${this.listTitle}. Triggering self-healing...`, err);
      
      await this.provider.ensureListExists(this.listTitle, MONITORING_MEETING_ENSURE_FIELDS as unknown as any[]);
      
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      const resolved = resolveInternalNames(available, MONITORING_MEETING_CANDIDATES as unknown as Record<string, string[]>) as Record<string, string>;
      this.resolvedFields = resolved;
      return resolved;
    }
  }

  async getAll(): Promise<MonitoringMeetingRecord[]> {
    const fields = await this.ensureResolved();
    try {
      const rows = await this.provider.listItems<SpMonitoringMeetingRow>(this.listTitle, {
        select: ['Id', 'Title', ...Object.values(fields)],
        orderby: `${fields.meetingDate} desc`,
        top: 500,
      });
      return rows.map(r => this.mapSpRowToRecord(r, fields));
    } catch (err) {
      auditLog.error('monitoring', 'Failed to list all meetings', err);
      return [];
    }
  }

  async getById(id: string): Promise<MonitoringMeetingRecord | null> {
    const fields = await this.ensureResolved();
    try {
      const rows = await this.provider.listItems<SpMonitoringMeetingRow>(this.listTitle, {
        select: ['Id', 'Title', ...Object.values(fields)],
        filter: `${fields.recordId} eq '${escapeODataString(id)}'`,
        top: 1,
      });
      return rows[0] ? this.mapSpRowToRecord(rows[0], fields) : null;
    } catch (err) {
      auditLog.error('monitoring', `Failed to get meeting by id: ${id}`, err);
      return null;
    }
  }

  async listByUser(userId: string): Promise<MonitoringMeetingRecord[]> {
    const fields = await this.ensureResolved();
    try {
      const rows = await this.provider.listItems<SpMonitoringMeetingRow>(this.listTitle, {
        select: ['Id', 'Title', ...Object.values(fields)],
        filter: `${fields.userId} eq '${escapeODataString(userId)}'`,
        orderby: `${fields.meetingDate} desc`,
      });
      return rows.map(r => this.mapSpRowToRecord(r, fields));
    } catch (err) {
      auditLog.error('monitoring', `Failed to list meetings for user: ${userId}`, err);
      return [];
    }
  }

  async listByIsp(ispId: string): Promise<MonitoringMeetingRecord[]> {
    const fields = await this.ensureResolved();
    try {
      const rows = await this.provider.listItems<SpMonitoringMeetingRow>(this.listTitle, {
        select: ['Id', 'Title', ...Object.values(fields)],
        filter: `${fields.ispId} eq '${escapeODataString(ispId)}'`,
        orderby: `${fields.meetingDate} desc`,
      });
      return rows.map(r => this.mapSpRowToRecord(r, fields));
    } catch (err) {
      auditLog.error('monitoring', `Failed to list meetings for isp: ${ispId}`, err);
      return [];
    }
  }

  async save(record: MonitoringMeetingRecord): Promise<MonitoringMeetingRecord> {
    const fields = await this.ensureResolved();
    const body = this.buildPatchBody(record, fields);
    
    try {
      const spId = await this.findSpItemIdByRecordId(record.id, fields);

      if (spId !== null) {
        await this.provider.updateItem(this.listTitle, spId, body, { etag: '*' });
      } else {
        await this.provider.createItem<Record<string, unknown>>(this.listTitle, body);
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
    const fields = await this.ensureResolved();
    try {
      const spId = await this.findSpItemIdByRecordId(id, fields);
      if (spId !== null) {
        await this.provider.deleteItem(this.listTitle, spId);
      }
    } catch (err) {
      auditLog.error('monitoring', `Failed to delete meeting: ${id}`, err);
      throw err;
    }
  }

  private async findSpItemIdByRecordId(recordId: string, fields: Record<string, string>): Promise<number | null> {
    const rows = await this.provider.listItems<SpMonitoringMeetingRow>(this.listTitle, {
      select: ['Id'],
      filter: `${fields.recordId} eq '${escapeODataString(recordId)}'`,
      top: 1,
    });
    const spId = rows[0]?.Id;
    return typeof spId === 'number' && spId > 0 ? spId : null;
  }

  private mapSpRowToRecord(row: SpMonitoringMeetingRow, fields: Record<string, string>): MonitoringMeetingRecord {
    return {
      id: String(row[fields.recordId] ?? ''),
      userId: String(row[fields.userId] ?? ''),
      ispId: String(row[fields.ispId] ?? ''),
      planningSheetId: row[fields.planningSheetId] as string || undefined,
      meetingType: (row[fields.meetingType] as string || 'regular') as MeetingType,
      meetingDate: row[fields.meetingDate] as string || '',
      venue: row[fields.venue] as string || '',
      attendees: safeJsonParse<MeetingAttendee[]>(row[fields.attendeesJson], []),
      goalEvaluations: safeJsonParse<GoalEvaluation[]>(row[fields.goalEvaluationsJson], []),
      overallAssessment: row[fields.overallAssessment] as string || '',
      userFeedback: row[fields.userFeedback] as string || '',
      familyFeedback: row[fields.familyFeedback] as string || '',
      planChangeDecision: (row[fields.planChangeDecision] as string || 'no_change') as PlanChangeDecision,
      changeReason: row[fields.changeReason] as string || '',
      decisions: safeJsonParse<string[]>(row[fields.decisionsJson], []),
      nextMonitoringDate: row[fields.nextMonitoringDate] as string || '',
      recordedBy: row[fields.recordedBy] as string || '',
      recordedAt: row[fields.recordedAt] as string || '',
    };
  }

  private buildPatchBody(record: MonitoringMeetingRecord, fields: Record<string, string>): Record<string, unknown> {
    const meetingDate = record.meetingDate?.slice(0, 10) ?? '';
    const nextMonitoringDate = record.nextMonitoringDate?.slice(0, 10) ?? '';

    return {
      Title: `${record.userId}_${meetingDate}`,
      [fields.recordId]: record.id,
      [fields.userId]: record.userId,
      [fields.ispId]: record.ispId,
      [fields.planningSheetId]: record.planningSheetId ?? '',
      [fields.meetingType]: record.meetingType,
      [fields.meetingDate]: meetingDate,
      [fields.venue]: record.venue,
      [fields.attendeesJson]: JSON.stringify(record.attendees),
      [fields.goalEvaluationsJson]: JSON.stringify(record.goalEvaluations),
      [fields.overallAssessment]: record.overallAssessment,
      [fields.userFeedback]: record.userFeedback,
      [fields.familyFeedback]: record.familyFeedback ?? '',
      [fields.planChangeDecision]: record.planChangeDecision,
      [fields.changeReason]: record.changeReason ?? '',
      [fields.decisionsJson]: JSON.stringify(record.decisions ?? []),
      [fields.nextMonitoringDate]: nextMonitoringDate,
      [fields.recordedBy]: record.recordedBy,
      [fields.recordedAt]: record.recordedAt,
    };
  }
}
