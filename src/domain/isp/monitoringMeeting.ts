// ---------------------------------------------------------------------------
// MonitoringMeeting — モニタリング会議記録のドメイン型・ヘルパー
//
// P3: 個別支援計画のモニタリング会議を独立ドメインとして定義。
// P2 の planningSheetVersionId を参照可能にし、
// 版管理とモニタリングの連携を実現する。
//
// 制度根拠:
//   - 障害者総合支援法 指定基準 第58条
//   - 「少なくとも6月に1回以上」のモニタリング実施義務
//   - サービス管理責任者による目標達成状況の確認
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enum Values
// ---------------------------------------------------------------------------

/** 会議種別 */
export const meetingTypeValues = [
  'regular',        // 定期モニタリング
  'interim',        // 中間確認
  'emergency',      // 緊急（状態変化等）
  'plan_change',    // 計画変更に伴う会議
] as const;

export type MeetingType = (typeof meetingTypeValues)[number];

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  regular: '定期モニタリング',
  interim: '中間確認',
  emergency: '緊急モニタリング',
  plan_change: '計画変更会議',
} as const;

/** 目標達成度 */
export const achievementLevelValues = [
  'achieved',          // 達成
  'mostly_achieved',   // 概ね達成
  'partial',           // 一部達成
  'not_achieved',      // 未達成
  'not_evaluable',     // 評価不能
] as const;

export type AchievementLevel = (typeof achievementLevelValues)[number];

export const ACHIEVEMENT_LEVEL_LABELS: Record<AchievementLevel, string> = {
  achieved: '達成',
  mostly_achieved: '概ね達成',
  partial: '一部達成',
  not_achieved: '未達成',
  not_evaluable: '評価不能',
} as const;

/** 計画変更要否 */
export const planChangeDecisionValues = [
  'no_change',         // 変更なし（継続）
  'minor_revision',    // 軽微な修正
  'major_revision',    // 大幅な改訂
  'urgent_revision',   // 緊急改訂
  'reassessment',      // 再アセスメント実施
] as const;

export type PlanChangeDecision = (typeof planChangeDecisionValues)[number];

export const PLAN_CHANGE_LABELS: Record<PlanChangeDecision, string> = {
  no_change: '変更なし（継続）',
  minor_revision: '軽微な修正',
  major_revision: '大幅な改訂',
  urgent_revision: '緊急改訂',
  reassessment: '再アセスメント実施',
} as const;

/** 記録ステータス */
export const meetingStatusValues = [
  'draft',     // 下書き
  'finalized', // 確定済み（編集不可）
] as const;

export type MeetingStatus = (typeof meetingStatusValues)[number];

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  draft: '下書き',
  finalized: '確定',
} as const;

// ---------------------------------------------------------------------------
// Domain Types
// ---------------------------------------------------------------------------

/** 目標別達成評価 */
export interface GoalEvaluation {
  /** 目標テキスト（短期 or 長期） */
  goalText: string;
  /** 達成度 */
  achievementLevel: AchievementLevel;
  /** 評価コメント */
  comment: string;
}

/** 参加者情報 */
export interface MeetingAttendee {
  /** 参加者氏名 */
  name: string;
  /** 役職 */
  role: string;
  /** 出席したか */
  present: boolean;
  /** スタッフ ID */
  staffId?: string;
  /** 研修レベル */
  trainingLevel?: 'none' | 'basic' | 'practical';
  /** 基礎研修修了か */
  hasBasicTraining?: boolean;
  /** 実践研修修了か */
  hasPracticalTraining?: boolean;
}

/** モニタリング会議記録 */
export interface MonitoringMeetingRecord {
  /** レコード ID */
  id: string;
  /** 対象利用者 ID */
  userId: string;
  /** 対象利用者名 */
  userName?: string;
  /** 紐づく ISP ID */
  ispId: string;
  /** 紐づく支援計画シート ID（P2版管理との連携） */
  planningSheetId?: string;
  /** 紐づく支援計画シート タイトル */
  planningSheetTitle?: string;

  // ── 会議情報 ──

  /** 会議種別 */
  meetingType: MeetingType;
  /** 開催日 (ISO 8601 date) */
  meetingDate: string;
  /** 開催場所 */
  venue: string;

  // ── 参加者 ──

  /** 参加者リスト */
  attendees: MeetingAttendee[];

  // ── 評価内容 ──

  /** 目標別達成評価 */
  goalEvaluations: GoalEvaluation[];
  /** 総合所見 */
  overallAssessment: string;
  /** 利用者の意向・希望 */
  userFeedback: string;
  /** 家族の意向・希望 */
  familyFeedback: string;

  // ── 決定事項 ──

  /** 計画変更の判定 */
  planChangeDecision: PlanChangeDecision;
  /** 変更理由（no_change 以外で必須） */
  changeReason: string;
  /** 決定事項リスト */
  decisions: string[];
  /** 次回モニタリング予定日 (ISO 8601 date) */
  nextMonitoringDate: string;

  // ── 強度行動障害支援・監査強化 ──

  /** 計画どおり実施できた支援・実施状況サマリ */
  implementationSummary?: string;
  /** 行動面の変化 */
  behaviorChangeSummary?: string;
  /** 有効だった支援サマリ */
  effectiveSupportSummary?: string;
  /** 課題サマリ */
  issueSummary?: string;
  /** 会議での検討内容（監査証跡） */
  discussionSummary: string;
  /** 支援計画シートの修正要否 */
  requiresPlanSheetUpdate?: boolean;
  /** 個別支援計画の修正要否 */
  requiresIspUpdate?: boolean;
  /** 次回のアクション */
  nextActions?: string[];

  /** 基礎研修修了者の参加有無 */
  hasBasicTrainedMember?: boolean;
  /** 実践研修修了者の参加有無 */
  hasPracticalTrainedMember?: boolean;
  /** 資格チェックステータス */
  qualificationCheckStatus?: 'ok' | 'warning' | 'invalid';

  // ── メタ ──

  /** 記録者氏名 */
  recordedBy: string;
  /** 記録日時 (ISO 8601) */
  recordedAt: string;

  // ── ステータス & 確定証跡 ──

  /** ステータス */
  status: MeetingStatus;
  /** 確定日時 (ISO 8601) */
  finalizedAt?: string;
  /** 確定者氏名 */
  finalizedBy?: string;
  /** 前回会議 ID（PDCAの連続性維持用） */
  previousMeetingId?: string;
}

// ---------------------------------------------------------------------------
// Draft schema (入力フォーム用)
// ---------------------------------------------------------------------------

/** 入力フォーム用スタブ（バリデーション前） */
export type MonitoringMeetingDraft = Omit<MonitoringMeetingRecord, 'id' | 'recordedAt'>;

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/** モニタリング実施サマリ（ダッシュボード用） */
export interface MonitoringSummary {
  /** 総会議数 */
  totalMeetings: number;
  /** 年度内の会議数 */
  meetingsThisFiscalYear: number;
  /** 年度内の必要回数（6月に1回 → 年2回以上） */
  requiredPerYear: number;
  /** 充足率 (0.0 - 1.0+) */
  fulfillmentRate: number;
  /** 充足しているか */
  isFulfilled: boolean;
  /** 直近の会議日 */
  lastMeetingDate: string | null;
  /** 次回予定日 */
  nextScheduledDate: string | null;
  /** 次回まであと何日（負は超過） */
  daysUntilNextMonitoring: number | null;
  /** 計画変更が必要な件数 */
  pendingPlanChanges: number;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * 日本の福祉年度（4月開始）を取得する。
 */
export function getFiscalYear(dateStr: string): number {
  const d = new Date(dateStr);
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  return month < 3 ? year - 1 : year; // 1-3月は前年度
}

/**
 * 指定年度のモニタリング会議をフィルタする。
 */
export function filterByFiscalYear(
  records: MonitoringMeetingRecord[],
  fiscalYear: number,
): MonitoringMeetingRecord[] {
  return records.filter((r) => getFiscalYear(r.meetingDate) === fiscalYear);
}

/**
 * 次回モニタリングまでの日数を計算する。
 */
export function computeDaysUntilNextMonitoring(
  nextDate: string | null,
  today?: string,
): number | null {
  if (!nextDate) return null;
  const next = new Date(nextDate);
  if (Number.isNaN(next.getTime())) return null;
  const now = today ? new Date(today) : new Date();
  const nextUtc = Date.UTC(next.getFullYear(), next.getMonth(), next.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((nextUtc - nowUtc) / (1000 * 60 * 60 * 24));
}

/**
 * モニタリング会議のサマリを算出する。
 *
 * @param records - 対象利用者の全モニタリング会議記録
 * @param today - 判定基準日（テスト用）
 */
export function computeMonitoringSummary(
  records: MonitoringMeetingRecord[],
  today?: string,
): MonitoringSummary {
  const now = today ?? new Date().toISOString().slice(0, 10);
  const currentFY = getFiscalYear(now);
  const fyRecords = filterByFiscalYear(records, currentFY);
  const requiredPerYear = 2; // 6月に1回 → 年度内最低2回

  // 直近の会議・次回予定
  const sorted = [...records].sort(
    (a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime(),
  );
  const lastMeeting = sorted[0] ?? null;
  const nextDate = lastMeeting?.nextMonitoringDate ?? null;

  // 計画変更待ち
  const pendingChanges = records.filter(
    (r) => r.planChangeDecision !== 'no_change',
  ).length;

  const daysUntil = computeDaysUntilNextMonitoring(nextDate, today);

  return {
    totalMeetings: records.length,
    meetingsThisFiscalYear: fyRecords.length,
    requiredPerYear,
    fulfillmentRate: fyRecords.length / requiredPerYear,
    isFulfilled: fyRecords.length >= requiredPerYear,
    lastMeetingDate: lastMeeting?.meetingDate ?? null,
    nextScheduledDate: nextDate,
    daysUntilNextMonitoring: daysUntil,
    pendingPlanChanges: pendingChanges,
  };
}

/**
 * 目標達成度の分布を集計する。
 */
export function computeAchievementDistribution(
  records: MonitoringMeetingRecord[],
): Record<AchievementLevel, number> {
  const dist: Record<AchievementLevel, number> = {
    achieved: 0,
    mostly_achieved: 0,
    partial: 0,
    not_achieved: 0,
    not_evaluable: 0,
  };

  for (const r of records) {
    for (const g of r.goalEvaluations) {
      if (g.achievementLevel in dist) {
        dist[g.achievementLevel]++;
      }
    }
  }

  return dist;
}
