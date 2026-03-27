/**
 * monitoringEvidence — ユニットテスト
 *
 * D→C 逆流集計ロジックの網羅テスト。
 */
import { describe, it, expect } from 'vitest';
import {
  summarizeProcedureExecution,
  generateDateRange,
  generateMonitoringNarrative,
  type SummarizeInput,
} from '../monitoringEvidence';
import type { ProcedureStep } from '@/features/daily/domain/legacy/ProcedureRepository';
import type { ExecutionRecord } from '@/features/daily/domain/legacy/executionRecordTypes';

// ─────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────

function makeProc(overrides: Partial<ProcedureStep> = {}): ProcedureStep {
  return {
    time: '09:00',
    activity: '朝の受け入れ',
    instruction: '声かけと体調確認',
    isKey: true,
    source: 'planning_sheet',
    planningSheetId: 'ps-1',
    sourceStepOrder: 1,
    ...overrides,
  };
}

function makeExec(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: 'rec-1',
    date: '2026-03-01',
    userId: 'U-001',
    scheduleItemId: '09:00|朝の受け入れ',
    status: 'completed',
    triggeredBipIds: [],
    memo: '',
    recordedBy: 'staff-1',
    recordedAt: '2026-03-01T09:30:00Z',
    ...overrides,
  };
}

function makeInput(overrides: Partial<SummarizeInput> = {}): SummarizeInput {
  return {
    userId: 'U-001',
    from: '2026-03-01',
    to: '2026-03-05',
    procedures: [
      makeProc({ time: '09:00', activity: '朝の受け入れ' }),
      makeProc({ time: '10:00', activity: '作業活動', sourceStepOrder: 2 }),
    ],
    executionRecords: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// generateDateRange
// ─────────────────────────────────────────────

describe('generateDateRange', () => {
  it('should generate correct date range', () => {
    const result = generateDateRange('2026-03-01', '2026-03-05');
    expect(result).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
    ]);
  });

  it('should return single date when from === to', () => {
    const result = generateDateRange('2026-03-01', '2026-03-01');
    expect(result).toEqual(['2026-03-01']);
  });

  it('should return empty for invalid dates', () => {
    const result = generateDateRange('invalid', '2026-03-01');
    expect(result).toEqual([]);
  });

  it('should return empty when from > to', () => {
    const result = generateDateRange('2026-03-05', '2026-03-01');
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// summarizeProcedureExecution
// ─────────────────────────────────────────────

describe('summarizeProcedureExecution', () => {
  it('should return all-zero summary when no records exist', () => {
    const result = summarizeProcedureExecution(makeInput());

    expect(result.userId).toBe('U-001');
    expect(result.totalDays).toBe(5);
    expect(result.totalProcedures).toBe(2);
    expect(result.overallCompletionRate).toBe(0);
    expect(result.procedureSummaries).toHaveLength(2);
    expect(result.procedureSummaries[0].recordedCount).toBe(0);
    expect(result.procedureSummaries[0].completionRate).toBe(0);
  });

  it('should calculate completion rate correctly', () => {
    const input = makeInput({
      executionRecords: [
        makeExec({ date: '2026-03-01', scheduleItemId: '09:00|朝の受け入れ', status: 'completed' }),
        makeExec({ date: '2026-03-02', scheduleItemId: '09:00|朝の受け入れ', status: 'completed', id: 'r2' }),
        makeExec({ date: '2026-03-03', scheduleItemId: '09:00|朝の受け入れ', status: 'completed', id: 'r3' }),
        // 3/5 days for 朝の受け入れ
        makeExec({ date: '2026-03-01', scheduleItemId: '10:00|作業活動', status: 'completed', id: 'r4' }),
        // 1/5 days for 作業活動
      ],
    });

    const result = summarizeProcedureExecution(input);

    const morningProc = result.procedureSummaries.find((s) => s.activity === '朝の受け入れ');
    expect(morningProc!.recordedCount).toBe(3);
    expect(morningProc!.completedCount).toBe(3);
    expect(morningProc!.completionRate).toBe(0.6); // 3/5

    const workProc = result.procedureSummaries.find((s) => s.activity === '作業活動');
    expect(workProc!.recordedCount).toBe(1);
    expect(workProc!.completionRate).toBe(0.2); // 1/5
  });

  it('should count skipped and triggered correctly', () => {
    const input = makeInput({
      procedures: [makeProc({ time: '09:00', activity: '朝の受け入れ' })],
      executionRecords: [
        makeExec({ date: '2026-03-01', status: 'completed' }),
        makeExec({ date: '2026-03-02', status: 'skipped', id: 'r2' }),
        makeExec({ date: '2026-03-03', status: 'triggered', id: 'r3', triggeredBipIds: ['bip-1'] }),
      ],
    });

    const result = summarizeProcedureExecution(input);
    const proc = result.procedureSummaries[0];

    expect(proc.completedCount).toBe(1);
    expect(proc.skippedCount).toBe(1);
    expect(proc.triggeredCount).toBe(1);
    expect(proc.recordedCount).toBe(3); // completed + skipped + triggered
    expect(proc.completionRate).toBe(0.6); // 3/5
  });

  it('should count notes (memos)', () => {
    const input = makeInput({
      procedures: [makeProc({ time: '09:00', activity: '朝の受け入れ' })],
      executionRecords: [
        makeExec({ date: '2026-03-01', memo: '体調やや不安定' }),
        makeExec({ date: '2026-03-02', memo: '', id: 'r2' }),
        makeExec({ date: '2026-03-03', memo: '笑顔で参加できた', id: 'r3' }),
      ],
    });

    const result = summarizeProcedureExecution(input);
    expect(result.procedureSummaries[0].noteCount).toBe(2);
  });

  it('should identify low execution procedures', () => {
    const input = makeInput({
      executionRecords: [
        // 朝の受け入れ: 1/5 = 20%
        makeExec({ date: '2026-03-01', scheduleItemId: '09:00|朝の受け入れ', status: 'completed' }),
        // 作業活動: 4/5 = 80%
        makeExec({ date: '2026-03-01', scheduleItemId: '10:00|作業活動', status: 'completed', id: 'r2' }),
        makeExec({ date: '2026-03-02', scheduleItemId: '10:00|作業活動', status: 'completed', id: 'r3' }),
        makeExec({ date: '2026-03-03', scheduleItemId: '10:00|作業活動', status: 'completed', id: 'r4' }),
        makeExec({ date: '2026-03-04', scheduleItemId: '10:00|作業活動', status: 'completed', id: 'r5' }),
      ],
    });

    const result = summarizeProcedureExecution(input);

    // 朝の受け入れ (20%) should be in low execution
    expect(result.lowExecutionProcedures).toHaveLength(1);
    expect(result.lowExecutionProcedures[0].activity).toBe('朝の受け入れ');
  });

  it('should filter by planningSheetId', () => {
    const input = makeInput({
      procedures: [
        makeProc({ time: '09:00', activity: '計画由来', planningSheetId: 'ps-1', source: 'planning_sheet' }),
        makeProc({ time: '10:00', activity: 'CSV由来', planningSheetId: undefined, source: 'csv_import' }),
      ],
      filterByPlanningSheetId: 'ps-1',
    });

    const result = summarizeProcedureExecution(input);
    expect(result.totalProcedures).toBe(1);
    expect(result.procedureSummaries[0].activity).toBe('計画由来');
  });

  it('should track lastRecordedAt', () => {
    const input = makeInput({
      procedures: [makeProc({ time: '09:00', activity: '朝の受け入れ' })],
      executionRecords: [
        makeExec({ date: '2026-03-01', status: 'completed' }),
        makeExec({ date: '2026-03-03', status: 'completed', id: 'r2' }),
      ],
    });

    const result = summarizeProcedureExecution(input);
    expect(result.procedureSummaries[0].lastRecordedAt).toBe('2026-03-03');
  });

  it('should detect unrecorded time slots', () => {
    const input = makeInput({
      from: '2026-03-01',
      to: '2026-03-10', // 10 days
      procedures: [
        makeProc({ time: '09:00', activity: '朝の受け入れ' }),
        makeProc({ time: '15:00', activity: '午後活動', sourceStepOrder: 3 }),
      ],
      executionRecords: [
        // 09:00 has 8/10 = 80% recorded → not flagged
        ...Array.from({ length: 8 }, (_, i) =>
          makeExec({
            date: `2026-03-${String(i + 1).padStart(2, '0')}`,
            scheduleItemId: '09:00|朝の受け入れ',
            status: 'completed',
            id: `morning-${i}`,
          }),
        ),
        // 15:00 has 2/10 = 20% recorded → flagged (unrecordedRate = 80%)
        makeExec({ date: '2026-03-01', scheduleItemId: '15:00|午後活動', status: 'completed', id: 'pm-1' }),
        makeExec({ date: '2026-03-02', scheduleItemId: '15:00|午後活動', status: 'completed', id: 'pm-2' }),
      ],
    });

    const result = summarizeProcedureExecution(input);

    // 15:00 should be flagged (80% unrecorded > 30% threshold)
    expect(result.unrecordedTimeSlots.length).toBeGreaterThanOrEqual(1);
    const pmSlot = result.unrecordedTimeSlots.find((s) => s.time === '15:00');
    expect(pmSlot).toBeDefined();
    expect(pmSlot!.unrecordedRate).toBe(0.8);
  });

  it('should calculate overall completion rate', () => {
    const input = makeInput({
      executionRecords: [
        // 朝: 2/5, 作業: 3/5 → total: 5/10 = 50%
        makeExec({ date: '2026-03-01', scheduleItemId: '09:00|朝の受け入れ', status: 'completed', id: 'r1' }),
        makeExec({ date: '2026-03-02', scheduleItemId: '09:00|朝の受け入れ', status: 'completed', id: 'r2' }),
        makeExec({ date: '2026-03-01', scheduleItemId: '10:00|作業活動', status: 'completed', id: 'r3' }),
        makeExec({ date: '2026-03-02', scheduleItemId: '10:00|作業活動', status: 'completed', id: 'r4' }),
        makeExec({ date: '2026-03-03', scheduleItemId: '10:00|作業活動', status: 'completed', id: 'r5' }),
      ],
    });

    const result = summarizeProcedureExecution(input);
    expect(result.overallCompletionRate).toBe(0.5); // 5 / 10
  });

  it('should ignore records outside the date range', () => {
    const input = makeInput({
      procedures: [makeProc({ time: '09:00', activity: '朝の受け入れ' })],
      executionRecords: [
        makeExec({ date: '2026-02-28', status: 'completed' }), // before range
        makeExec({ date: '2026-03-01', status: 'completed', id: 'r2' }), // in range
        makeExec({ date: '2026-03-06', status: 'completed', id: 'r3' }), // after range
      ],
    });

    const result = summarizeProcedureExecution(input);
    expect(result.procedureSummaries[0].recordedCount).toBe(1);
  });
});

// ─────────────────────────────────────────────
// generateMonitoringNarrative
// ─────────────────────────────────────────────

describe('generateMonitoringNarrative', () => {
  it('should generate narrative text', () => {
    const input = makeInput({
      executionRecords: [
        makeExec({ date: '2026-03-01', scheduleItemId: '09:00|朝の受け入れ', status: 'completed', memo: '良好' }),
        makeExec({ date: '2026-03-01', scheduleItemId: '10:00|作業活動', status: 'triggered', id: 'r2', triggeredBipIds: ['bip-1'] }),
      ],
    });

    const summary = summarizeProcedureExecution(input);
    const narrative = generateMonitoringNarrative(summary);

    expect(narrative).toContain('モニタリング集計');
    expect(narrative).toContain('2026-03-01');
    expect(narrative).toContain('5日間');
    expect(narrative).toContain('2件');
  });

  it('should include low execution section', () => {
    const input = makeInput(); // no records → 0% completion
    const summary = summarizeProcedureExecution(input);
    const narrative = generateMonitoringNarrative(summary);

    expect(narrative).toContain('実施率が低い手順');
    expect(narrative).toContain('0%');
  });
});
