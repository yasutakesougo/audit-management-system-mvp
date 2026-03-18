/**
 * spMonitoringMeetingRepository — SharePoint 実装
 *
 * MonitoringMeetings リストへの CRUD を Port 準拠で実装する。
 *
 * パターン:
 *   - Query: OData filter → listItems → mapSpRowToMonitoringMeeting
 *   - Create: record → buildBody → addListItemByTitle
 *   - Update: recordId 逆引き → SP Id 取得 → updateItem
 *   - Delete: recordId 逆引き → SP Id 取得 → deleteItem
 *
 * @see monitoring-meetings-sp-schema.md (設計書)
 * @see src/domain/isp/monitoringMeetingRepository.ts (Port)
 * @see src/sharepoint/fields/monitoringMeetingFields.ts (Field Map)
 */

import { isWriteEnabled } from '@/env';
import type { UseSP } from '@/lib/spClient';
import { escapeODataString } from '@/lib/odata';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import type {
  MonitoringMeetingRecord,
  MeetingType,
  PlanChangeDecision,
  GoalEvaluation,
  MeetingAttendee,
} from '@/domain/isp/monitoringMeeting';
import {
  MONITORING_MEETING_FIELDS as F,
  MONITORING_MEETING_SELECT,
  safeJsonParse,
  type SpMonitoringMeetingRow,
} from '@/sharepoint/fields/monitoringMeetingFields';
import { LIST_CONFIG, ListKeys } from '@/sharepoint/fields/listRegistry';

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const LIST_TITLE = LIST_CONFIG[ListKeys.MonitoringMeetings].title;
const SELECT = [...MONITORING_MEETING_SELECT] as string[];

// ────────────────────────────────────────────────────────────────
// Write Gate
// ────────────────────────────────────────────────────────────────

class WriteDisabledError extends Error {
  readonly code = 'WRITE_DISABLED' as const;
  constructor(op: string) {
    super(`Write operation "${op}" is disabled. Set VITE_WRITE_ENABLED=1 to enable.`);
    this.name = 'WriteDisabledError';
  }
}

function assertWriteEnabled(op: string): void {
  if (!isWriteEnabled) throw new WriteDisabledError(op);
}

// ────────────────────────────────────────────────────────────────
// OData Filter Builders
// ────────────────────────────────────────────────────────────────

function buildRecordIdFilter(recordId: string): string {
  return `${F.recordId} eq '${escapeODataString(recordId)}'`;
}

function buildUserIdFilter(userId: string): string {
  return `${F.userId} eq '${escapeODataString(userId)}'`;
}

function buildIspIdFilter(ispId: string): string {
  return `${F.ispId} eq '${escapeODataString(ispId)}'`;
}

const ORDER_BY_DATE_DESC = `${F.meetingDate} desc`;

// ────────────────────────────────────────────────────────────────
// Date Normalization (zero-padded YYYY-MM-DD)
// ────────────────────────────────────────────────────────────────

/**
 * `YYYY-M-D` 形式を `YYYY-MM-DD` に正規化する。
 * 既にゼロパディング済みの場合はそのまま返す。
 */
function normalizeDate(dateStr: string): string {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateStr);
  if (!match) return dateStr;
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────────────
// SP Row → Domain Mapper
// ────────────────────────────────────────────────────────────────

/**
 * SharePoint REST API の行データを Domain 型に変換する。
 *
 * 任意項目の正規化:
 *   - familyFeedback: '' (空文字)
 *   - changeReason: '' (空文字)
 *   - decisions: [] (空配列)
 *   - planningSheetId: undefined
 */
export function mapSpRowToMonitoringMeeting(
  row: SpMonitoringMeetingRow,
): MonitoringMeetingRecord {
  return {
    id: row.cr014_recordId ?? '',
    userId: row.cr014_userId ?? '',
    ispId: row.cr014_ispId ?? '',
    planningSheetId: row.cr014_planningSheetId || undefined,

    meetingType: (row.cr014_meetingType ?? 'regular') as MeetingType,
    meetingDate: row.cr014_meetingDate ?? '',
    venue: row.cr014_venue ?? '',

    attendees: safeJsonParse<MeetingAttendee[]>(row.cr014_attendeesJson, []),

    goalEvaluations: safeJsonParse<GoalEvaluation[]>(row.cr014_goalEvaluationsJson, []),
    overallAssessment: row.cr014_overallAssessment ?? '',
    userFeedback: row.cr014_userFeedback ?? '',
    familyFeedback: row.cr014_familyFeedback ?? '',

    planChangeDecision: (row.cr014_planChangeDecision ?? 'no_change') as PlanChangeDecision,
    changeReason: row.cr014_changeReason ?? '',
    decisions: safeJsonParse<string[]>(row.cr014_decisionsJson, []),
    nextMonitoringDate: row.cr014_nextMonitoringDate ?? '',

    recordedBy: row.cr014_recordedBy ?? '',
    recordedAt: row.cr014_recordedAt ?? '',
  };
}

// ────────────────────────────────────────────────────────────────
// Domain → SP Body Builder
// ────────────────────────────────────────────────────────────────

/**
 * Domain の MonitoringMeetingRecord を SharePoint の create/update body に変換する。
 * Title は `{userId}_{meetingDate}` で自動生成。
 */
export function buildMonitoringMeetingBody(
  record: MonitoringMeetingRecord,
): Record<string, unknown> {
  const meetingDate = normalizeDate(record.meetingDate);
  const nextMonitoringDate = normalizeDate(record.nextMonitoringDate);

  return {
    Title: `${record.userId}_${meetingDate}`,

    [F.recordId]: record.id,
    [F.userId]: record.userId,
    [F.ispId]: record.ispId,
    [F.planningSheetId]: record.planningSheetId ?? '',

    [F.meetingType]: record.meetingType,
    [F.meetingDate]: meetingDate,
    [F.venue]: record.venue,

    [F.attendeesJson]: JSON.stringify(record.attendees),

    [F.goalEvaluationsJson]: JSON.stringify(record.goalEvaluations),
    [F.overallAssessment]: record.overallAssessment,
    [F.userFeedback]: record.userFeedback,
    [F.familyFeedback]: record.familyFeedback ?? '',

    [F.planChangeDecision]: record.planChangeDecision,
    [F.changeReason]: record.changeReason ?? '',
    [F.decisionsJson]: JSON.stringify(record.decisions ?? []),
    [F.nextMonitoringDate]: nextMonitoringDate,

    [F.recordedBy]: record.recordedBy,
    [F.recordedAt]: record.recordedAt,
  };
}

// ────────────────────────────────────────────────────────────────
// SP Item ID Lookup (recordId → SP numeric Id)
// ────────────────────────────────────────────────────────────────

/**
 * domain の recordId から SP の numeric Id を逆引きする。
 * 見つからない場合は null を返す。
 */
async function findSpItemIdByRecordId(
  client: UseSP,
  recordId: string,
): Promise<number | null> {
  const rows = await client.listItems<SpMonitoringMeetingRow>(LIST_TITLE, {
    select: ['Id'],
    filter: buildRecordIdFilter(recordId),
    top: 1,
  });
  const spId = rows[0]?.Id;
  return typeof spId === 'number' && spId > 0 ? spId : null;
}

// ────────────────────────────────────────────────────────────────
// Repository Factory
// ────────────────────────────────────────────────────────────────

/**
 * SharePoint MonitoringMeetings リストに対する Repository 実装を返す。
 *
 * @param client - useSP() の戻り値
 */
export function createSpMonitoringMeetingRepository(
  client: UseSP,
): MonitoringMeetingRepository {
  return {
    // ── Read ──────────────────────────────────────────────────

    async getAll(): Promise<MonitoringMeetingRecord[]> {
      const rows = await client.listItems<SpMonitoringMeetingRow>(LIST_TITLE, {
        select: SELECT,
        orderby: ORDER_BY_DATE_DESC,
        top: 500,
      });
      return rows.map(mapSpRowToMonitoringMeeting);
    },

    async getById(id: string): Promise<MonitoringMeetingRecord | null> {
      // NOTE: `id` は domain recordId。SP item Id ではない。
      const rows = await client.listItems<SpMonitoringMeetingRow>(LIST_TITLE, {
        select: SELECT,
        filter: buildRecordIdFilter(id),
        top: 1,
      });
      return rows[0] ? mapSpRowToMonitoringMeeting(rows[0]) : null;
    },

    async listByUser(userId: string): Promise<MonitoringMeetingRecord[]> {
      const rows = await client.listItems<SpMonitoringMeetingRow>(LIST_TITLE, {
        select: SELECT,
        filter: buildUserIdFilter(userId),
        orderby: ORDER_BY_DATE_DESC,
      });
      return rows.map(mapSpRowToMonitoringMeeting);
    },

    async listByIsp(ispId: string): Promise<MonitoringMeetingRecord[]> {
      const rows = await client.listItems<SpMonitoringMeetingRow>(LIST_TITLE, {
        select: SELECT,
        filter: buildIspIdFilter(ispId),
        orderby: ORDER_BY_DATE_DESC,
      });
      return rows.map(mapSpRowToMonitoringMeeting);
    },

    // ── Write ─────────────────────────────────────────────────

    async save(record: MonitoringMeetingRecord): Promise<MonitoringMeetingRecord> {
      assertWriteEnabled('monitoringMeeting.save');

      const body = buildMonitoringMeetingBody(record);

      // Upsert: recordId で既存確認
      const existingSpId = await findSpItemIdByRecordId(client, record.id);

      if (existingSpId !== null) {
        // ── Update (last-write-wins) ──
        await client.updateItem(LIST_TITLE, existingSpId, body);
      } else {
        // ── Create ──
        await client.addListItemByTitle(LIST_TITLE, body);
      }

      // 保存後に再取得して返す
      const rows = await client.listItems<SpMonitoringMeetingRow>(LIST_TITLE, {
        select: SELECT,
        filter: buildRecordIdFilter(record.id),
        top: 1,
      });

      if (!rows[0]) {
        throw new Error(
          `[spMonitoringMeetingRepository] Failed to re-fetch after save. recordId=${record.id}`,
        );
      }

      return mapSpRowToMonitoringMeeting(rows[0]);
    },

    async delete(id: string): Promise<void> {
      assertWriteEnabled('monitoringMeeting.delete');

      // NOTE: `id` は domain recordId。SP item Id への逆引きが必要。
      const spId = await findSpItemIdByRecordId(client, id);
      if (spId === null) {
        // 既に存在しない場合は成功扱い（冪等性）
        return;
      }

      await client.deleteItem(LIST_TITLE, spId);
    },
  };
}
