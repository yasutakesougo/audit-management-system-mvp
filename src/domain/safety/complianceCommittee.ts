// ---------------------------------------------------------------------------
// ComplianceCommittee — 適正化委員会記録のドメイン型
//
// 障害者総合支援法に基づく身体拘束等適正化委員会の開催記録。
// 運営基準では定期的な委員会開催が義務付けられている。
//
// 法的根拠:
//   - 障害者総合支援法 指定基準省令
//   - 身体拘束等適正化のための指針 (厚労省通知)
//   - 委員会の定期開催義務 (年4回以上推奨)
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum Values
// ---------------------------------------------------------------------------

/** 委員会の種別 */
export const committeeTypeValues = [
  '定期開催',
  '臨時開催',
  '研修報告',
  'ケース検討',
] as const;
export type CommitteeType = (typeof committeeTypeValues)[number];

/** 委員会記録のステータス */
export const committeeStatusValues = ['draft', 'finalized'] as const;
export type CommitteeStatus = (typeof committeeStatusValues)[number];

// ---------------------------------------------------------------------------
// CommitteeMeetingRecord
// ---------------------------------------------------------------------------

export type CommitteeAttendee = {
  staffId: string;
  staffName: string;
  role: string; // 例: 委員長, 委員, 書記, オブザーバー
};

export type CommitteeMeetingRecord = {
  id: string;

  // ── 基本情報 ──
  /** 開催日 (ISO 8601) */
  meetingDate: string;
  /** 委員会の種別 */
  committeeType: CommitteeType;
  /** 議題 */
  agenda: string;

  // ── 参加者 ──
  attendees: CommitteeAttendee[];

  // ── 議事内容 ──
  /** 議事概要 */
  summary: string;
  /** 決定事項 */
  decisions: string;
  /** 課題・改善事項 */
  issues: string;

  // ── 身体拘束関連 ──
  /** 身体拘束に関する検討の有無 */
  restraintDiscussed: boolean;
  /** 身体拘束に関する検討の詳細 */
  restraintDiscussionDetail: string;

  // ── メタ ──
  /** 記録者 */
  recordedBy: string;
  /** 記録日時 (ISO 8601) */
  recordedAt: string;
  /** ステータス */
  status: CommitteeStatus;
};

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const attendeeSchema = z.object({
  staffId: z.string().default(''),
  staffName: z.string().default(''),
  role: z.string().default(''),
});

export const committeeMeetingDraftSchema = z.object({
  meetingDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
  committeeType: z.enum(committeeTypeValues).default('定期開催'),
  agenda: z.string().default(''),
  attendees: z.array(attendeeSchema).default([]),
  summary: z.string().default(''),
  decisions: z.string().default(''),
  issues: z.string().default(''),
  restraintDiscussed: z.boolean().default(false),
  restraintDiscussionDetail: z.string().default(''),
  recordedBy: z.string().default(''),
});

export type CommitteeMeetingDraft = z.infer<typeof committeeMeetingDraftSchema>;

// ---------------------------------------------------------------------------
// Domain Helpers
// ---------------------------------------------------------------------------

/** Draft から Record に変換する */
export function fromDraftToCommitteeRecord(
  id: string,
  draft: CommitteeMeetingDraft,
): CommitteeMeetingRecord {
  return {
    id,
    meetingDate: draft.meetingDate,
    committeeType: draft.committeeType,
    agenda: draft.agenda,
    attendees: [...draft.attendees],
    summary: draft.summary,
    decisions: draft.decisions,
    issues: draft.issues,
    restraintDiscussed: draft.restraintDiscussed,
    restraintDiscussionDetail: draft.restraintDiscussionDetail,
    recordedBy: draft.recordedBy,
    recordedAt: new Date().toISOString(),
    status: 'draft',
  };
}

/** 空の Draft を生成する */
export function createEmptyCommitteeDraft(
  recordedBy?: string,
): CommitteeMeetingDraft {
  return committeeMeetingDraftSchema.parse({
    recordedBy: recordedBy ?? '',
  });
}

// ---------------------------------------------------------------------------
// Summary Types (for dashboard aggregation)
// ---------------------------------------------------------------------------

export type CommitteeSummary = {
  /** 総開催回数 */
  totalMeetings: number;
  /** 今年度の開催回数 */
  currentFiscalYearMeetings: number;
  /** 種別ごとの開催回数 */
  byType: Partial<Record<CommitteeType, number>>;
  /** 直近の開催日 */
  lastMeetingDate: string | null;
  /** 次回推奨開催日 (直近開催日 + 3ヶ月) */
  nextRecommendedDate: string | null;
  /** 年4回基準を満たしているか */
  meetsQuarterlyRequirement: boolean;
  /** 身体拘束検討があった会議の割合 */
  restraintDiscussionRate: number;
};

/**
 * 日本の会計年度（4月始まり）の開始日を返す。
 * @param date 基準日
 */
function fiscalYearStart(date: Date): Date {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(year, 3, 1); // 4月1日
}

/** CommitteeMeetingRecord[] からサマリーを算出する */
export function computeCommitteeSummary(
  records: CommitteeMeetingRecord[],
): CommitteeSummary {
  const now = new Date();
  const fyStart = fiscalYearStart(now);

  const byType: Partial<Record<CommitteeType, number>> = {};
  let currentFiscalYearMeetings = 0;
  let restraintDiscussedCount = 0;
  let lastMeetingDate: string | null = null;

  const sorted = [...records].sort(
    (a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime(),
  );

  for (const r of sorted) {
    byType[r.committeeType] = (byType[r.committeeType] ?? 0) + 1;

    if (new Date(r.meetingDate) >= fyStart) {
      currentFiscalYearMeetings++;
    }

    if (r.restraintDiscussed) {
      restraintDiscussedCount++;
    }
  }

  if (sorted.length > 0) {
    lastMeetingDate = sorted[0].meetingDate;
  }

  // 次回推奨日: 直近開催日 + 3ヶ月
  let nextRecommendedDate: string | null = null;
  if (lastMeetingDate) {
    const last = new Date(lastMeetingDate);
    last.setMonth(last.getMonth() + 3);
    nextRecommendedDate = last.toISOString().slice(0, 10);
  }

  return {
    totalMeetings: records.length,
    currentFiscalYearMeetings,
    byType,
    lastMeetingDate,
    nextRecommendedDate,
    meetsQuarterlyRequirement: currentFiscalYearMeetings >= 4,
    restraintDiscussionRate:
      records.length > 0 ? Math.round((restraintDiscussedCount / records.length) * 100) : 0,
  };
}
