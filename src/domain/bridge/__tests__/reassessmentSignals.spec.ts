/**
 * reassessmentSignals — ユニットテスト
 *
 * C→A 橋渡しロジックの網羅テスト。
 */
import { describe, it, expect } from 'vitest';
import {
  deriveReassessmentSignals,
  signalsToReassessmentSections,
  type ReassessmentSignal,
} from '../reassessmentSignals';
import type { MonitoringEvidenceSummary, ProcedureMonitoringSummary } from '../monitoringEvidence';

// ─────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────

function makeProc(overrides: Partial<ProcedureMonitoringSummary> = {}): ProcedureMonitoringSummary {
  return {
    procedureId: '09:00|朝の受け入れ',
    activity: '朝の受け入れ',
    instruction: '声かけ',
    time: '09:00',
    source: 'planning_sheet',
    plannedCount: 20,
    recordedCount: 18,
    completedCount: 18,
    skippedCount: 0,
    triggeredCount: 0,
    completionRate: 0.9,
    noteCount: 1,
    lastRecordedAt: '2026-03-10',
    sourceStepOrder: 1,
    planningSheetId: 'ps-1',
    ...overrides,
  };
}

function makeSummary(overrides: Partial<MonitoringEvidenceSummary> = {}): MonitoringEvidenceSummary {
  return {
    userId: 'U-001',
    from: '2026-02-15',
    to: '2026-03-14',
    totalDays: 28,
    totalProcedures: 3,
    overallCompletionRate: 0.75,
    procedureSummaries: [
      makeProc({ activity: '朝の受け入れ', completionRate: 0.9, recordedCount: 18 }),
      makeProc({ activity: '作業活動', completionRate: 0.4, recordedCount: 8, procedureId: '10:00|作業活動', sourceStepOrder: 2 }),
      makeProc({ activity: '昼食支援', completionRate: 0.95, recordedCount: 19, procedureId: '12:00|昼食支援', sourceStepOrder: 3 }),
    ],
    lowExecutionProcedures: [],
    frequentNoteProcedures: [],
    frequentTriggeredProcedures: [],
    unrecordedTimeSlots: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// deriveReassessmentSignals
// ─────────────────────────────────────────────

describe('deriveReassessmentSignals', () => {
  it('should detect low execution signals', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({ activity: '低実施手順', completionRate: 0.3, recordedCount: 6 }),
      ],
    });

    const signals = deriveReassessmentSignals(summary);
    const lowExec = signals.filter((s) => s.kind === 'low_execution');

    expect(lowExec).toHaveLength(1);
    expect(lowExec[0].severity).toBe('medium');
    expect(lowExec[0].summary).toContain('30%');
    expect(lowExec[0].recommendation).toBeTruthy();
  });

  it('should detect high severity for very low execution', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({ activity: '極低実施', completionRate: 0.1, recordedCount: 2 }),
      ],
    });

    const signals = deriveReassessmentSignals(summary);
    const lowExec = signals.find((s) => s.kind === 'low_execution');

    expect(lowExec).toBeDefined();
    expect(lowExec!.severity).toBe('high');
  });

  it('should detect frequent note signals', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({ activity: 'メモ多発', noteCount: 5 }),
      ],
    });

    const signals = deriveReassessmentSignals(summary);
    const notes = signals.filter((s) => s.kind === 'frequent_note');

    expect(notes).toHaveLength(1);
    expect(notes[0].summary).toContain('5件');
    expect(notes[0].severity).toBe('medium');
  });

  it('should detect high trigger signals', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({ activity: 'BIP多発', triggeredCount: 4 }),
      ],
    });

    const signals = deriveReassessmentSignals(summary);
    const triggers = signals.filter((s) => s.kind === 'high_trigger');

    expect(triggers).toHaveLength(1);
    expect(triggers[0].summary).toContain('4回');
    expect(triggers[0].severity).toBe('medium');
  });

  it('should detect stable success signals', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({
          activity: '安定手順',
          completionRate: 0.95,
          recordedCount: 19,
          noteCount: 0,
          triggeredCount: 0,
        }),
      ],
    });

    const signals = deriveReassessmentSignals(summary);
    const stable = signals.filter((s) => s.kind === 'stable_success');

    expect(stable).toHaveLength(1);
    expect(stable[0].severity).toBe('low');
    expect(stable[0].summary).toContain('95%');
    expect(stable[0].recommendation).toContain('継続');
  });

  it('should NOT flag stable_success if noteCount is high', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({
          activity: '高実施だがメモ多発',
          completionRate: 0.95,
          noteCount: 5,
          triggeredCount: 0,
        }),
      ],
    });

    const signals = deriveReassessmentSignals(summary);
    const stable = signals.filter((s) => s.kind === 'stable_success');

    expect(stable).toHaveLength(0);
  });

  it('should detect unrecorded slot signals', () => {
    const summary = makeSummary({
      unrecordedTimeSlots: [
        { time: '15:00', unrecordedRate: 0.7 },
        { time: '16:00', unrecordedRate: 0.5 },
      ],
    });

    const signals = deriveReassessmentSignals(summary);
    const slots = signals.filter((s) => s.kind === 'unrecorded_slot');

    expect(slots).toHaveLength(2);
    expect(slots.find((s) => s.activity.includes('15:00'))!.severity).toBe('medium');
  });

  it('should sort signals by severity descending', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({ activity: 'low-sev', completionRate: 0.55, noteCount: 0, triggeredCount: 0 }), // low
        makeProc({ activity: 'high-sev', completionRate: 0.1, noteCount: 0, triggeredCount: 0, procedureId: 'high' }), // high
        makeProc({ activity: 'med-sev', completionRate: 0.35, noteCount: 0, triggeredCount: 0, procedureId: 'med' }), // medium
      ],
    });

    const signals = deriveReassessmentSignals(summary);

    // All should be low_execution
    expect(signals[0].severity).toBe('high');
    expect(signals[signals.length - 1].severity).toBe('low');
  });

  it('should produce multiple signal kinds for same procedure', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({
          activity: '問題手順',
          completionRate: 0.3,
          noteCount: 6,
          triggeredCount: 4,
        }),
      ],
    });

    const signals = deriveReassessmentSignals(summary);

    const kinds = new Set(signals.map((s) => s.kind));
    expect(kinds.has('low_execution')).toBe(true);
    expect(kinds.has('frequent_note')).toBe(true);
    expect(kinds.has('high_trigger')).toBe(true);
  });

  it('should return no signals for empty summaries', () => {
    const summary = makeSummary({ procedureSummaries: [], unrecordedTimeSlots: [] });
    const signals = deriveReassessmentSignals(summary);
    expect(signals).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// signalsToReassessmentSections
// ─────────────────────────────────────────────

describe('signalsToReassessmentSections', () => {
  it('should produce all four sections', () => {
    const summary = makeSummary();
    const signals = deriveReassessmentSignals(summary);
    const sections = signalsToReassessmentSections(signals, summary);

    expect(sections.currentStatus).toContain('28日間');
    expect(sections.currentStatus).toContain('75%');
    expect(typeof sections.issues).toBe('string');
    expect(typeof sections.stableSupport).toBe('string');
    expect(typeof sections.recommendations).toBe('string');
  });

  it('should show issues for low execution', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({ activity: '問題手順', completionRate: 0.2, recordedCount: 4 }),
      ],
    });
    const signals = deriveReassessmentSignals(summary);
    const sections = signalsToReassessmentSections(signals, summary);

    expect(sections.issues).toContain('問題手順');
    expect(sections.issues).toContain('HIGH');
  });

  it('should show stable_success in stableSupport section', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({ activity: '安定手順', completionRate: 0.95, noteCount: 0, triggeredCount: 0 }),
      ],
    });
    const signals = deriveReassessmentSignals(summary);
    const sections = signalsToReassessmentSections(signals, summary);

    expect(sections.stableSupport).toContain('安定手順');
    expect(sections.stableSupport).toContain('✅');
  });

  it('should show recommendations for problem procedures', () => {
    const summary = makeSummary({
      procedureSummaries: [
        makeProc({ activity: '改善必要', completionRate: 0.3, triggeredCount: 5 }),
      ],
    });
    const signals = deriveReassessmentSignals(summary);
    const sections = signalsToReassessmentSections(signals, summary);

    expect(sections.recommendations).toContain('改善必要');
  });

  it('should handle no signals gracefully', () => {
    const summary = makeSummary({ procedureSummaries: [], unrecordedTimeSlots: [] });
    const signals: ReassessmentSignal[] = [];
    const sections = signalsToReassessmentSections(signals, summary);

    expect(sections.issues).toContain('検出されていません');
    expect(sections.stableSupport).toContain('特定されませんでした');
    expect(sections.recommendations).toContain('ありません');
  });
});
