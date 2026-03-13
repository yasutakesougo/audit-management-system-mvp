// ---------------------------------------------------------------------------
// TrainingRecord — 研修記録のドメイン型
//
// 身体拘束等適正化のための職員研修の実施記録。
// 運営基準では年2回以上の研修実施が義務付けられている。
//
// 法的根拠:
//   - 障害者総合支援法 指定基準省令
//   - 身体拘束等適正化のための対策を検討する委員会 通知
//   - 職員研修の定期実施義務 (年2回以上)
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum Values
// ---------------------------------------------------------------------------

/** 研修の種別 */
export const trainingTypeValues = [
  '身体拘束等適正化研修',
  '虐待防止研修',
  '権利擁護研修',
  'リスクマネジメント研修',
  '新人職員研修',
  'フォローアップ研修',
  'その他',
] as const;
export type TrainingType = (typeof trainingTypeValues)[number];

/** 研修の実施形式 */
export const trainingFormatValues = [
  '集合研修',
  'オンライン研修',
  'OJT（実地研修）',
  '外部研修（講師派遣）',
  '外部研修（参加型）',
  'eラーニング',
] as const;
export type TrainingFormat = (typeof trainingFormatValues)[number];

/** 研修記録のステータス */
export const trainingStatusValues = ['planned', 'completed', 'cancelled'] as const;
export type TrainingStatus = (typeof trainingStatusValues)[number];

// ---------------------------------------------------------------------------
// TrainingRecord
// ---------------------------------------------------------------------------

export type TrainingParticipant = {
  staffId: string;
  staffName: string;
  attended: boolean;
  /** 研修の理解度 (1-5) */
  comprehensionLevel?: number;
  /** フィードバック・感想 */
  feedback?: string;
};

export type TrainingRecord = {
  id: string;

  // ── 基本情報 ──
  /** 研修名 */
  title: string;
  /** 研修の種別 */
  trainingType: TrainingType;
  /** 実施形式 */
  format: TrainingFormat;

  // ── 日時 ──
  /** 研修実施日 (ISO 8601 date) */
  trainingDate: string;
  /** 研修時間（分） */
  durationMinutes: number;

  // ── 内容 ──
  /** 研修内容の概要 */
  description: string;
  /** 使用した資料・教材 */
  materials: string;
  /** 講師名 */
  instructor: string;

  // ── 参加者 ──
  participants: TrainingParticipant[];

  // ── 評価 ──
  /** 研修の目標達成度メモ */
  achievementNotes: string;
  /** 次回への改善点 */
  improvementNotes: string;

  // ── メタ ──
  /** 記録者 */
  recordedBy: string;
  /** 記録日時 (ISO 8601) */
  recordedAt: string;
  /** ステータス */
  status: TrainingStatus;

  // ── 関連 ──
  /** 関連する委員会記録ID */
  relatedCommitteeId?: string;
};

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const participantSchema = z.object({
  staffId: z.string().default(''),
  staffName: z.string().default(''),
  attended: z.boolean().default(false),
  comprehensionLevel: z.number().min(1).max(5).optional(),
  feedback: z.string().optional(),
});

export const trainingRecordDraftSchema = z.object({
  title: z.string().default(''),
  trainingType: z.enum(trainingTypeValues).default('身体拘束等適正化研修'),
  format: z.enum(trainingFormatValues).default('集合研修'),
  trainingDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
  durationMinutes: z.number().min(0).default(60),
  description: z.string().default(''),
  materials: z.string().default(''),
  instructor: z.string().default(''),
  participants: z.array(participantSchema).default([]),
  achievementNotes: z.string().default(''),
  improvementNotes: z.string().default(''),
  recordedBy: z.string().default(''),
  relatedCommitteeId: z.string().optional(),
});

export type TrainingRecordDraft = z.infer<typeof trainingRecordDraftSchema>;

// ---------------------------------------------------------------------------
// Domain Helpers
// ---------------------------------------------------------------------------

/** Draft から TrainingRecord に変換する */
export function fromDraftToTrainingRecord(
  id: string,
  draft: TrainingRecordDraft,
): TrainingRecord {
  return {
    id,
    title: draft.title,
    trainingType: draft.trainingType,
    format: draft.format,
    trainingDate: draft.trainingDate,
    durationMinutes: draft.durationMinutes,
    description: draft.description,
    materials: draft.materials,
    instructor: draft.instructor,
    participants: [...draft.participants],
    achievementNotes: draft.achievementNotes,
    improvementNotes: draft.improvementNotes,
    recordedBy: draft.recordedBy,
    recordedAt: new Date().toISOString(),
    status: 'completed',
    relatedCommitteeId: draft.relatedCommitteeId,
  };
}

/** 空の Draft を生成する */
export function createEmptyTrainingDraft(
  recordedBy?: string,
): TrainingRecordDraft {
  return trainingRecordDraftSchema.parse({
    recordedBy: recordedBy ?? '',
  });
}

/** 参加率を算出する */
export function computeAttendanceRate(participants: TrainingParticipant[]): number {
  if (participants.length === 0) return 0;
  const attended = participants.filter((p) => p.attended).length;
  return Math.round((attended / participants.length) * 100);
}

/** 平均理解度を算出する */
export function computeAverageComprehension(participants: TrainingParticipant[]): number {
  const withLevel = participants.filter(
    (p) => p.attended && p.comprehensionLevel != null,
  );
  if (withLevel.length === 0) return 0;
  const sum = withLevel.reduce((acc, p) => acc + (p.comprehensionLevel ?? 0), 0);
  return Math.round((sum / withLevel.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Summary Types (for dashboard aggregation)
// ---------------------------------------------------------------------------

export type TrainingSummary = {
  /** 総研修回数 */
  totalTrainings: number;
  /** 今年度の研修回数 */
  currentFiscalYearTrainings: number;
  /** 種別ごとの研修回数 */
  byType: Partial<Record<TrainingType, number>>;
  /** 直近の研修日 */
  lastTrainingDate: string | null;
  /** 次回推奨研修日 (直近研修日 + 6ヶ月) */
  nextRecommendedDate: string | null;
  /** 年2回基準を満たしているか */
  meetsBiannualRequirement: boolean;
  /** 平均参加率 (%) */
  averageAttendanceRate: number;
  /** 総参加延べ人数 */
  totalParticipantCount: number;
};

/**
 * 日本の会計年度（4月始まり）の開始日を返す。
 */
function fiscalYearStart(date: Date): Date {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(year, 3, 1);
}

/** TrainingRecord[] からサマリーを算出する */
export function computeTrainingSummary(
  records: TrainingRecord[],
): TrainingSummary {
  const now = new Date();
  const fyStart = fiscalYearStart(now);

  const completed = records.filter((r) => r.status === 'completed');

  const byType: Partial<Record<TrainingType, number>> = {};
  let currentFiscalYearTrainings = 0;
  let totalAttendanceRate = 0;
  let totalParticipantCount = 0;

  const sorted = [...completed].sort(
    (a, b) => new Date(b.trainingDate).getTime() - new Date(a.trainingDate).getTime(),
  );

  for (const r of sorted) {
    byType[r.trainingType] = (byType[r.trainingType] ?? 0) + 1;

    if (new Date(r.trainingDate) >= fyStart) {
      currentFiscalYearTrainings++;
    }

    const attendedCount = r.participants.filter((p) => p.attended).length;
    totalParticipantCount += attendedCount;

    if (r.participants.length > 0) {
      totalAttendanceRate += computeAttendanceRate(r.participants);
    }
  }

  let lastTrainingDate: string | null = null;
  if (sorted.length > 0) {
    lastTrainingDate = sorted[0].trainingDate;
  }

  // 次回推奨日: 直近研修日 + 6ヶ月
  let nextRecommendedDate: string | null = null;
  if (lastTrainingDate) {
    const last = new Date(lastTrainingDate);
    last.setMonth(last.getMonth() + 6);
    nextRecommendedDate = last.toISOString().slice(0, 10);
  }

  return {
    totalTrainings: completed.length,
    currentFiscalYearTrainings,
    byType,
    lastTrainingDate,
    nextRecommendedDate,
    meetsBiannualRequirement: currentFiscalYearTrainings >= 2,
    averageAttendanceRate:
      sorted.length > 0 ? Math.round(totalAttendanceRate / sorted.length) : 0,
    totalParticipantCount,
  };
}
