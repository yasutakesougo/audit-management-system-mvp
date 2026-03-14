/**
 * observationToReassessment — ユニットテスト
 *
 * Check → Act ブリッジの純関数をテスト。
 */
import { describe, it, expect } from 'vitest';
import {
  buildReassessmentDraft,
  draftToReassessment,
} from '../observationToReassessment';
import type { PlanningSheetContext } from '../observationToReassessment';
import type { WeeklyObservationRecord } from '@/domain/regulatory/weeklyObservation';
import type { SupportProcedureRecord } from '@/domain/isp/schema';

// ─────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────

const REF_DATE = '2026-03-14';

function makeContext(overrides: Partial<PlanningSheetContext> = {}): PlanningSheetContext {
  return {
    planningSheetId: 'ps-1',
    userId: 'u-1',
    targetScene: '食事場面',
    hypothesisText: '食事拒否の原因は環境刺激過多と推定',
    lastReassessmentAt: null,
    reassessmentCycleDays: 90,
    ...overrides,
  };
}

function makeObservation(overrides: Partial<WeeklyObservationRecord> = {}): WeeklyObservationRecord {
  return {
    id: `obs-${Math.random().toString(36).slice(2)}`,
    observerId: 'staff-core',
    observerName: '中核 太郎',
    targetStaffId: 'staff-1',
    targetStaffName: '支援 花子',
    userId: 'u-1',
    observationDate: '2026-03-01',
    observationContent: '食事場面で落ち着いて座れていた',
    adviceContent: '環境調整を継続',
    followUpActions: '来週も観察継続',
    recordedBy: 'staff-core',
    recordedAt: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

function makeProcedure(overrides: Partial<SupportProcedureRecord> = {}): SupportProcedureRecord {
  return {
    id: `proc-${Math.random().toString(36).slice(2)}`,
    userId: 'u-1',
    ispId: 'isp-1',
    planningSheetId: 'ps-1',
    recordDate: '2026-03-01',
    timeSlot: '昼食',
    activity: '食事',
    procedureText: '環境刺激を減らしてから食事を提供する',
    executionStatus: 'done',
    userResponse: '落ち着いて食事できた',
    specialNotes: '',
    handoffNotes: '',
    performedBy: 'staff-1',
    performedAt: '2026-03-01',
    createdAt: '2026-03-01T12:00:00Z',
    updatedAt: '2026-03-01T12:00:00Z',
    ...overrides,
  } as SupportProcedureRecord;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('buildReassessmentDraft', () => {
  it('should return a draft with correct planningSheetId', () => {
    const draft = buildReassessmentDraft({
      context: makeContext(),
      observations: [],
      procedureRecords: [],
      referenceDate: REF_DATE,
    });

    expect(draft.planningSheetId).toBe('ps-1');
  });

  it('should handle empty inputs gracefully', () => {
    const draft = buildReassessmentDraft({
      context: makeContext(),
      observations: [],
      procedureRecords: [],
      referenceDate: REF_DATE,
    });

    expect(draft.observationCount).toBe(0);
    expect(draft.procedureRecordCount).toBe(0);
    expect(draft.procedureCompletionRate).toBe(1); // 0件の場合は率1
    expect(draft.procedureGapScore).toBe(0);
  });

  it('should compute procedure completion rate', () => {
    const procedures = [
      makeProcedure({ executionStatus: 'done' }),
      makeProcedure({ executionStatus: 'done' }),
      makeProcedure({ executionStatus: 'skipped' }),
      makeProcedure({ executionStatus: 'partially_done' }),
    ];

    const draft = buildReassessmentDraft({
      context: makeContext(),
      observations: [],
      procedureRecords: procedures,
      referenceDate: REF_DATE,
    });

    expect(draft.procedureCompletionRate).toBe(0.5); // 2/4
    expect(draft.procedureGapScore).toBe(0.5); // 2/4
    expect(draft.procedureRecordCount).toBe(4);
  });

  it('should suggest scheduled trigger when reassessment is overdue', () => {
    const draft = buildReassessmentDraft({
      context: makeContext({
        lastReassessmentAt: '2025-12-01', // 103日前
      }),
      observations: [makeObservation()],
      procedureRecords: [],
      referenceDate: REF_DATE,
    });

    expect(draft.suggestedTrigger).toBe('scheduled');
    expect(draft.suggestedDecision).not.toBe('no_change');
    expect(draft.suggestedReason).toContain('定期見直し');
  });

  it('should suggest incident trigger when risk-related observations are high', () => {
    const riskObs = Array.from({ length: 5 }, (_, i) =>
      makeObservation({
        observationDate: `2026-03-0${i + 1}`,
        observationContent: `自傷行為の危険が増加。離席も頻繁。リスク行動として他害の兆候もあり。`,
        adviceContent: 'リスク管理の見直しが必要です。',
      }),
    );

    const draft = buildReassessmentDraft({
      context: makeContext({ lastReassessmentAt: '2026-02-01' }), // 超過していない
      observations: riskObs,
      procedureRecords: [],
      referenceDate: REF_DATE,
    });

    expect(draft.suggestedTrigger).toBe('incident');
    expect(draft.suggestedReason).toContain('リスク行動');
  });

  it('should suggest monitoring trigger when procedure gap is high', () => {
    const procedures = Array.from({ length: 10 }, (_, i) =>
      makeProcedure({
        recordDate: `2026-03-0${(i % 9) + 1}`,
        executionStatus: i < 4 ? 'done' : 'skipped', // 40% done
      }),
    );

    const draft = buildReassessmentDraft({
      context: makeContext({ lastReassessmentAt: '2026-02-01' }),
      observations: [],
      procedureRecords: procedures,
      referenceDate: REF_DATE,
    });

    expect(draft.suggestedTrigger).toBe('monitoring');
    expect(draft.suggestedReason).toContain('手順実施率');
  });

  it('should extract observation themes', () => {
    const obs = [
      makeObservation({ observationContent: '食事場面で落ち着いて座れた。改善が見られる。' }),
      makeObservation({ observationContent: '笑顔で活動に参加。安定している。' }),
      makeObservation({ observationContent: '自発的に要求を伝えることができた。' }),
    ];

    const draft = buildReassessmentDraft({
      context: makeContext({ lastReassessmentAt: '2026-02-01' }),
      observations: obs,
      procedureRecords: [],
      referenceDate: REF_DATE,
    });

    expect(draft.observationThemes.length).toBeGreaterThan(0);
    // 「肯定的変化」テーマが検出されるはず
    const positiveTheme = draft.observationThemes.find((t) => t.theme === '肯定的変化');
    expect(positiveTheme).toBeDefined();
  });

  it('should filter observations by userId', () => {
    const obs = [
      makeObservation({ userId: 'u-1' }),
      makeObservation({ userId: 'u-2' }),  // 別ユーザー → 除外
      makeObservation({ userId: 'u-1' }),
    ];

    const draft = buildReassessmentDraft({
      context: makeContext({ userId: 'u-1' }),
      observations: obs,
      procedureRecords: [],
      referenceDate: REF_DATE,
    });

    expect(draft.observationCount).toBe(2);
  });

  it('should filter procedures by planningSheetId', () => {
    const procs = [
      makeProcedure({ planningSheetId: 'ps-1' }),
      makeProcedure({ planningSheetId: 'ps-2' }),  // 別シート → 除外
      makeProcedure({ planningSheetId: 'ps-1' }),
    ];

    const draft = buildReassessmentDraft({
      context: makeContext({ planningSheetId: 'ps-1' }),
      observations: [],
      procedureRecords: procs,
      referenceDate: REF_DATE,
    });

    expect(draft.procedureRecordCount).toBe(2);
  });

  it('should suggest initial review when no reassessment exists', () => {
    const draft = buildReassessmentDraft({
      context: makeContext({ lastReassessmentAt: null }),
      observations: [makeObservation()],
      procedureRecords: [],
      referenceDate: REF_DATE,
    });

    expect(draft.suggestedTrigger).toBe('scheduled');
    expect(draft.suggestedReason).toContain('初回');
  });

  it('should include hypothesis text in review', () => {
    const draft = buildReassessmentDraft({
      context: makeContext({ hypothesisText: '環境刺激が主因' }),
      observations: [makeObservation()],
      procedureRecords: [],
      referenceDate: REF_DATE,
    });

    expect(draft.hypothesisReview).toContain('環境刺激が主因');
  });
});

describe('draftToReassessment', () => {
  it('should convert draft to PlanningSheetReassessment', () => {
    const draft = buildReassessmentDraft({
      context: makeContext(),
      observations: [makeObservation()],
      procedureRecords: [makeProcedure()],
      referenceDate: REF_DATE,
    });

    const reassessment = draftToReassessment(draft, {
      id: 'reassess-1',
      reassessedAt: REF_DATE,
      reassessedBy: 'staff-1',
    });

    expect(reassessment.id).toBe('reassess-1');
    expect(reassessment.planningSheetId).toBe('ps-1');
    expect(reassessment.reassessedAt).toBe(REF_DATE);
    expect(reassessment.reassessedBy).toBe('staff-1');
    expect(reassessment.triggerType).toBeDefined();
    expect(reassessment.planChangeDecision).toBeDefined();
    expect(reassessment.nextReassessmentAt).toBeTruthy();
  });

  it('should compute next reassessment date automatically', () => {
    const draft = buildReassessmentDraft({
      context: makeContext(),
      observations: [],
      procedureRecords: [],
      referenceDate: REF_DATE,
    });

    const reassessment = draftToReassessment(draft, {
      id: 'r-1',
      reassessedAt: '2026-03-14',
      reassessedBy: 'staff-1',
    });

    // 90日後 = 2026-06-12
    expect(reassessment.nextReassessmentAt).toBe('2026-06-12');
  });

  it('should allow override of next reassessment date', () => {
    const draft = buildReassessmentDraft({
      context: makeContext(),
      observations: [],
      procedureRecords: [],
    });

    const reassessment = draftToReassessment(draft, {
      id: 'r-2',
      reassessedAt: '2026-03-14',
      reassessedBy: 'staff-1',
      nextReassessmentAt: '2026-04-30',
    });

    expect(reassessment.nextReassessmentAt).toBe('2026-04-30');
  });
});
