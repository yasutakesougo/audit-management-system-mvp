/**
 * MonitoringMeeting DataAccess — GenericDataAccess 利用版
 *
 * ドメイン固有の row→record マッピングのみ担当。
 * SP REST クエリ構築と fetch は GenericDataAccess に委譲。
 */
import type { SpFetchFn } from '@/lib/sp/spLists';
import {
    MonitoringMeetingRecord,
    MeetingType,
    PlanChangeDecision,
    MeetingAttendee,
    GoalEvaluation,
} from '@/domain/isp/monitoringMeeting';
import {
    safeJsonParse,
} from '@/sharepoint/fields/monitoringMeetingFields';
import { MonitoringMeetingSchemaResolver } from './SchemaResolver';
import { buildEq } from '@/sharepoint/query/builders';
import {
    buildSelectFromResolved,
    spFetchItems,
    spFindIdByField,
} from '@/lib/sp/GenericDataAccess';

export class MonitoringMeetingDataAccess {
    constructor(
        private readonly spFetch: SpFetchFn,
        private readonly schema: MonitoringMeetingSchemaResolver
    ) {}

    public async load(userId: string, listPath: string): Promise<MonitoringMeetingRecord[]> {
        const fields = await this.schema.getResolvedCanonicalNames();
        const userIdField = fields.userId;
        if (!userIdField) return [];

        const select = buildSelectFromResolved(fields, false);
        const rows = await spFetchItems(this.spFetch, listPath, {
            filter: buildEq(userIdField, userId),
            orderby: `${fields.meetingDate || 'Title'} desc`,
            top: 500,
            select,
        }, 'MonitoringMeetings');

        return rows.map((r) => this.mapSpRowToRecord(r, fields));
    }

    public async loadByIsp(ispId: string, listPath: string): Promise<MonitoringMeetingRecord[]> {
        const fields = await this.schema.getResolvedCanonicalNames();
        const ispIdField = fields.ispId;
        if (!ispIdField) return [];

        const select = buildSelectFromResolved(fields, false);
        const rows = await spFetchItems(this.spFetch, listPath, {
            filter: buildEq(ispIdField, ispId),
            orderby: `${fields.meetingDate || 'Title'} desc`,
            select,
        }, 'MonitoringMeetings');

        return rows.map((r) => this.mapSpRowToRecord(r, fields));
    }

    public async findSpIdByRecordId(recordId: string, listPath: string): Promise<number | null> {
        const fields = await this.schema.getResolvedCanonicalNames();
        const recordIdField = fields.recordId;
        if (!recordIdField) return null;

        return spFindIdByField(
            this.spFetch, listPath,
            recordIdField, recordId,
            'MonitoringMeetings',
        );
    }

    public mapSpRowToRecord(
        row: unknown,
        fields: Record<string, string | undefined>,
    ): MonitoringMeetingRecord {
        const r = row as Record<string, unknown>;
        return {
            id: String(r[fields.recordId!] ?? ''),
            userId: String(r[fields.userId!] ?? ''),
            ispId: String(r[fields.ispId!] ?? ''),
            planningSheetId: r[fields.planningSheetId!] as string | undefined,
            meetingType: (r[fields.meetingType!] as string || 'regular') as MeetingType,
            meetingDate: r[fields.meetingDate!] as string || '',
            venue: r[fields.venue!] as string || '',
            attendees: safeJsonParse<MeetingAttendee[]>(r[fields.attendeesJson!], []),
            goalEvaluations: safeJsonParse<GoalEvaluation[]>(r[fields.goalEvaluationsJson!], []),
            overallAssessment: r[fields.overallAssessment!] as string || '',
            userFeedback: r[fields.userFeedback!] as string || '',
            familyFeedback: r[fields.familyFeedback!] as string || '',
            planChangeDecision: (r[fields.planChangeDecision!] as string || 'no_change') as PlanChangeDecision,
            changeReason: r[fields.changeReason!] as string || '',
            decisions: safeJsonParse<string[]>(r[fields.decisionsJson!], []),
            nextMonitoringDate: r[fields.nextMonitoringDate!] as string || '',
            recordedBy: r[fields.recordedBy!] as string || '',
            recordedAt: r[fields.recordedAt!] as string || '',
        };
    }
}
