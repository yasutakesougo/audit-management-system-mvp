/**
 * safety domain — 制度要件境界値テスト
 *
 * 対象:
 *   - computeCommitteeSummary.meetsQuarterlyRequirement
 *     実装: currentFiscalYearMeetings >= 4
 *     境界: 今年度 3件 / 4件 / 5件
 *     ※「日数」ではなく「会計年度（4月1日〜翌3月31日）内の回数」で判定
 *
 *   - computeTrainingSummary.meetsBiannualRequirement
 *     実装: currentFiscalYearTrainings >= 2（completed のみ）
 *     境界: 今年度 1件 / 2件 / 3件
 *
 *   - computeTrainingSummary.averageAttendanceRate
 *     0除算安全性 / 全員出席 / 全員欠席
 *
 *   - computeAttendanceRate
 *     空配列 / 全員出席 / 全員欠席 / 一部出席
 *
 * テスト設計書: docs/test-design/safety.md
 *
 * 法的根拠:
 *   障害者総合支援法 指定基準省令
 *   - 適正化委員会: 年4回以上開催義務
 *   - 職員研修: 年2回以上実施義務
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  computeCommitteeSummary,
  type CommitteeMeetingRecord,
} from '../complianceCommittee';

import {
  computeTrainingSummary,
  computeAttendanceRate,
  type TrainingRecord,
  type TrainingParticipant,
} from '../trainingRecord';

// ─── テスト固定日時 ───────────────────────────────────────────────────────────
//
// 会計年度テストは「現在時刻」に依存するため vi.useFakeTimers で固定する。
// 固定日: 2026-03-18（会計年度 2025/4/1〜2026/3/31 の末尾近く）
// 変更時は「fiscal year start = 2025-04-01」のまま成立するか確認すること。
//
const FIXED_NOW = new Date('2026-03-18T09:00:00+09:00');
// 現会計年度 (2025 年度)
const FISCAL_YEAR_2025_START = '2025-04-01'; // 境界: この日以降がカウント対象
const FISCAL_YEAR_PREV_END = '2025-03-31';   // 境界: この日以前は前年度

// ─── Factory ─────────────────────────────────────────────────────────────────

function makeCommitteeRecord(
  overrides: Partial<CommitteeMeetingRecord> = {},
): CommitteeMeetingRecord {
  return {
    id: 'c1',
    meetingDate: '2025-06-01',
    committeeType: '定期開催',
    agenda: '',
    attendees: [],
    summary: '',
    decisions: '',
    issues: '',
    restraintDiscussed: false,
    restraintDiscussionDetail: '',
    recordedBy: 'staff_1',
    recordedAt: '2025-06-01T10:00:00Z',
    status: 'finalized',
    ...overrides,
  };
}

function makeTrainingRecord(
  overrides: Partial<TrainingRecord> = {},
): TrainingRecord {
  return {
    id: 't1',
    title: '身体拘束等適正化研修',
    trainingType: '身体拘束等適正化研修',
    format: '集合研修',
    trainingDate: '2025-06-01',
    durationMinutes: 120,
    description: '',
    materials: '',
    instructor: '',
    participants: [],
    achievementNotes: '',
    improvementNotes: '',
    recordedBy: 'staff_1',
    recordedAt: '2025-06-01T10:00:00Z',
    status: 'completed',
    ...overrides,
  };
}

function makeParticipant(attended: boolean): TrainingParticipant {
  return { staffId: 'p1', staffName: 'テスト職員', attended };
}

// ─── setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── computeCommitteeSummary — meetsQuarterlyRequirement ─────────────────────

describe('computeCommitteeSummary — meetsQuarterlyRequirement', () => {
  // 制度要件: 現会計年度に 4回以上の委員会開催が必要

  it('should return false when fiscal-year meetings = 0', () => {
    const summary = computeCommitteeSummary([]);
    expect(summary.meetsQuarterlyRequirement).toBe(false);
  });

  it('should return false when fiscal-year meetings = 1', () => {
    const records = [
      makeCommitteeRecord({ id: 'c1', meetingDate: '2025-06-01' }),
    ];
    const summary = computeCommitteeSummary(records);
    expect(summary.currentFiscalYearMeetings).toBe(1);
    expect(summary.meetsQuarterlyRequirement).toBe(false);
  });

  it('should return false when fiscal-year meetings = 3 (boundary minus 1)', () => {
    const records = [
      makeCommitteeRecord({ id: 'c1', meetingDate: '2025-04-15' }),
      makeCommitteeRecord({ id: 'c2', meetingDate: '2025-07-15' }),
      makeCommitteeRecord({ id: 'c3', meetingDate: '2025-10-15' }),
    ];
    const summary = computeCommitteeSummary(records);
    expect(summary.currentFiscalYearMeetings).toBe(3);
    expect(summary.meetsQuarterlyRequirement).toBe(false);
  });

  it('should return true when fiscal-year meetings = 4 (boundary exact)', () => {
    const records = [
      makeCommitteeRecord({ id: 'c1', meetingDate: '2025-04-15' }),
      makeCommitteeRecord({ id: 'c2', meetingDate: '2025-07-15' }),
      makeCommitteeRecord({ id: 'c3', meetingDate: '2025-10-15' }),
      makeCommitteeRecord({ id: 'c4', meetingDate: '2026-01-15' }),
    ];
    const summary = computeCommitteeSummary(records);
    expect(summary.currentFiscalYearMeetings).toBe(4);
    expect(summary.meetsQuarterlyRequirement).toBe(true);
  });

  it('should return true when fiscal-year meetings = 5 (boundary plus 1)', () => {
    const records = [
      makeCommitteeRecord({ id: 'c1', meetingDate: '2025-04-15' }),
      makeCommitteeRecord({ id: 'c2', meetingDate: '2025-06-15' }),
      makeCommitteeRecord({ id: 'c3', meetingDate: '2025-09-15' }),
      makeCommitteeRecord({ id: 'c4', meetingDate: '2025-12-15' }),
      makeCommitteeRecord({ id: 'c5', meetingDate: '2026-02-15' }),
    ];
    const summary = computeCommitteeSummary(records);
    expect(summary.currentFiscalYearMeetings).toBe(5);
    expect(summary.meetsQuarterlyRequirement).toBe(true);
  });

  it('should NOT count meetings before fiscal year start (prev year boundary)', () => {
    // 前年度末（3/31）の記録は今年度にカウントされない
    const records = [
      makeCommitteeRecord({ id: 'prev', meetingDate: FISCAL_YEAR_PREV_END }),
      makeCommitteeRecord({ id: 'curr', meetingDate: FISCAL_YEAR_2025_START }),
    ];
    const summary = computeCommitteeSummary(records);
    // 4/1 のもののみが今年度扱い
    expect(summary.currentFiscalYearMeetings).toBe(1);
  });

  it('should count meetings on fiscal year start date (4/1 boundary)', () => {
    // 4/1 当日は今年度に含まれる
    const records = [
      makeCommitteeRecord({ id: 'c1', meetingDate: FISCAL_YEAR_2025_START }),
    ];
    const summary = computeCommitteeSummary(records);
    expect(summary.currentFiscalYearMeetings).toBe(1);
  });

  it('should only count current fiscal year meetings, not total', () => {
    // totalMeetings は全件、currentFiscalYearMeetings は今年度のみ
    const records = [
      makeCommitteeRecord({ id: 'old1', meetingDate: '2024-06-01' }),
      makeCommitteeRecord({ id: 'old2', meetingDate: '2024-10-01' }),
      makeCommitteeRecord({ id: 'curr', meetingDate: '2025-06-01' }),
    ];
    const summary = computeCommitteeSummary(records);
    expect(summary.totalMeetings).toBe(3);
    expect(summary.currentFiscalYearMeetings).toBe(1);
    expect(summary.meetsQuarterlyRequirement).toBe(false);
  });
});

// ─── computeTrainingSummary — meetsBiannualRequirement ───────────────────────

describe('computeTrainingSummary — meetsBiannualRequirement', () => {
  // 制度要件: 現会計年度に completed ステータスの研修を 2回以上実施

  it('should return false when fiscal-year completed trainings = 0', () => {
    const summary = computeTrainingSummary([]);
    expect(summary.meetsBiannualRequirement).toBe(false);
  });

  it('should return false when fiscal-year completed trainings = 1 (boundary minus 1)', () => {
    const records = [
      makeTrainingRecord({ id: 't1', trainingDate: '2025-06-01', status: 'completed' }),
    ];
    const summary = computeTrainingSummary(records);
    expect(summary.currentFiscalYearTrainings).toBe(1);
    expect(summary.meetsBiannualRequirement).toBe(false);
  });

  it('should return true when fiscal-year completed trainings = 2 (boundary exact)', () => {
    const records = [
      makeTrainingRecord({ id: 't1', trainingDate: '2025-06-01', status: 'completed' }),
      makeTrainingRecord({ id: 't2', trainingDate: '2025-11-01', status: 'completed' }),
    ];
    const summary = computeTrainingSummary(records);
    expect(summary.currentFiscalYearTrainings).toBe(2);
    expect(summary.meetsBiannualRequirement).toBe(true);
  });

  it('should return true when fiscal-year completed trainings = 3 (boundary plus 1)', () => {
    const records = [
      makeTrainingRecord({ id: 't1', trainingDate: '2025-05-01', status: 'completed' }),
      makeTrainingRecord({ id: 't2', trainingDate: '2025-09-01', status: 'completed' }),
      makeTrainingRecord({ id: 't3', trainingDate: '2026-01-01', status: 'completed' }),
    ];
    const summary = computeTrainingSummary(records);
    expect(summary.currentFiscalYearTrainings).toBe(3);
    expect(summary.meetsBiannualRequirement).toBe(true);
  });

  it('should NOT count cancelled trainings toward the requirement', () => {
    // completed が1件、cancelled が1件 → 要件未達
    const records = [
      makeTrainingRecord({ id: 't1', trainingDate: '2025-06-01', status: 'completed' }),
      makeTrainingRecord({ id: 't2', trainingDate: '2025-11-01', status: 'cancelled' }),
    ];
    const summary = computeTrainingSummary(records);
    expect(summary.totalTrainings).toBe(1); // cancelled は集計対象外
    expect(summary.meetsBiannualRequirement).toBe(false);
  });

  it('should NOT count planned trainings toward the requirement', () => {
    // planned が2件あっても未達のまま
    const records = [
      makeTrainingRecord({ id: 't1', trainingDate: '2025-06-01', status: 'planned' }),
      makeTrainingRecord({ id: 't2', trainingDate: '2025-11-01', status: 'planned' }),
    ];
    const summary = computeTrainingSummary(records);
    expect(summary.meetsBiannualRequirement).toBe(false);
  });

  it('should NOT count prev-year trainings toward fiscal-year requirement', () => {
    // 前年度の completed 2件 + 今年度 1件 → 今年度は1件なので未達
    const records = [
      makeTrainingRecord({ id: 'py1', trainingDate: '2024-06-01', status: 'completed' }),
      makeTrainingRecord({ id: 'py2', trainingDate: '2024-12-01', status: 'completed' }),
      makeTrainingRecord({ id: 'cy1', trainingDate: '2025-06-01', status: 'completed' }),
    ];
    const summary = computeTrainingSummary(records);
    expect(summary.currentFiscalYearTrainings).toBe(1);
    expect(summary.meetsBiannualRequirement).toBe(false);
  });
});

// ─── computeAttendanceRate — 0除算安全性と境界 ───────────────────────────────

describe('computeAttendanceRate', () => {
  it('should return 0 when participants array is empty (division-by-zero safety)', () => {
    expect(computeAttendanceRate([])).toBe(0);
  });

  it('should return 100 when all participants attended', () => {
    const participants = [
      makeParticipant(true),
      makeParticipant(true),
      makeParticipant(true),
    ];
    expect(computeAttendanceRate(participants)).toBe(100);
  });

  it('should return 0 when no participants attended', () => {
    const participants = [
      makeParticipant(false),
      makeParticipant(false),
    ];
    expect(computeAttendanceRate(participants)).toBe(0);
  });

  it('should return rounded percentage for partial attendance', () => {
    // 2/3 = 66.67% → Math.round → 67
    const participants = [
      makeParticipant(true),
      makeParticipant(true),
      makeParticipant(false),
    ];
    expect(computeAttendanceRate(participants)).toBe(67);
  });

  it('should return 50 for half attendance', () => {
    const participants = [
      makeParticipant(true),
      makeParticipant(false),
    ];
    expect(computeAttendanceRate(participants)).toBe(50);
  });
});

// ─── computeTrainingSummary — averageAttendanceRate 0除算安全 ────────────────

describe('computeTrainingSummary — averageAttendanceRate', () => {
  it('should return 0 when no completed training records exist', () => {
    const summary = computeTrainingSummary([]);
    expect(summary.averageAttendanceRate).toBe(0);
  });

  it('should return 0 when all completed trainings have no participants', () => {
    const records = [
      makeTrainingRecord({ id: 't1', trainingDate: '2025-06-01', participants: [] }),
    ];
    const summary = computeTrainingSummary(records);
    expect(summary.averageAttendanceRate).toBe(0);
  });

  it('should compute average attendance rate across multiple trainings', () => {
    // t1: 2/2 = 100%, t2: 1/2 = 50% → avg = 75%
    const records = [
      makeTrainingRecord({
        id: 't1',
        trainingDate: '2025-06-01',
        participants: [makeParticipant(true), makeParticipant(true)],
      }),
      makeTrainingRecord({
        id: 't2',
        trainingDate: '2025-11-01',
        participants: [makeParticipant(true), makeParticipant(false)],
      }),
    ];
    const summary = computeTrainingSummary(records);
    expect(summary.averageAttendanceRate).toBe(75);
  });
});
