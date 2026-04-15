import { describe, expect, it } from 'vitest';
import {
  inferTodayStatusSummary,
  type StatusSummaryInput,
} from '../inferTodayStatusSummary';

// ─── Helper ──────────────────────────────────────────────────

function makeInput(overrides: Partial<StatusSummaryInput> = {}): StatusSummaryInput {
  return {
    records: { completed: 10, total: 12 },
    caseRecords: { completed: 8, total: 10 },
    attendance: { present: 10, scheduled: 10 },
    contactCount: 0,
    criticalExceptionCount: 0,
    highExceptionCount: 0,
    feverCount: 0,
    sameDayAbsenceCount: 0,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────

describe('inferTodayStatusSummary', () => {
  // ── Good ──

  it('returns good when everything is progressing well', () => {
    const result = inferTodayStatusSummary(makeInput());
    expect(result.level).toBe('good');
    expect(result.emoji).toBe('✅');
    expect(result.message).toContain('順調');
    expect(result.message).toContain('あと4件'); // 2 records + 2 case = 4 remaining
  });

  it('returns good with completion message when all records done', () => {
    const result = inferTodayStatusSummary(makeInput({
      records: { completed: 12, total: 12 },
      caseRecords: { completed: 10, total: 10 },
    }));
    expect(result.level).toBe('good');
    expect(result.emoji).toBe('✨');
    expect(result.message).toContain('本日の入力はすべて完了しています');
  });

  it('includes attendance in good message', () => {
    const result = inferTodayStatusSummary(makeInput({
      attendance: { present: 8, scheduled: 10 },
    }));
    expect(result.message).toContain('出席8/10');
  });

  // ── Warning ──

  it('returns warning when record completion < 50%', () => {
    const result = inferTodayStatusSummary(makeInput({
      records: { completed: 2, total: 12 },
    }));
    expect(result.level).toBe('warning');
    expect(result.emoji).toBe('⚠️');
    expect(result.message).toContain('手順 残10件');
  });

  it('returns warning when case record completion < 50%', () => {
    const result = inferTodayStatusSummary(makeInput({
      caseRecords: { completed: 1, total: 10 },
    }));
    expect(result.level).toBe('warning');
    expect(result.message).toContain('ケース 残9件');
  });

  it('returns warning when same-day absence exists', () => {
    const result = inferTodayStatusSummary(makeInput({
      sameDayAbsenceCount: 2,
    }));
    expect(result.level).toBe('warning');
    expect(result.message).toContain('当日欠席2名');
  });

  it('returns warning when high exceptions exist', () => {
    const result = inferTodayStatusSummary(makeInput({
      highExceptionCount: 3,
    }));
    expect(result.level).toBe('warning');
    expect(result.message).toContain('未対応3件');
  });

  it('returns warning with hint for remaining records', () => {
    const result = inferTodayStatusSummary(makeInput({
      records: { completed: 2, total: 12 },
      caseRecords: { completed: 1, total: 10 },
    }));
    expect(result.level).toBe('warning');
    expect(result.hint).toContain('あと');
  });

  it('returns warning when fever count is 1', () => {
    const result = inferTodayStatusSummary(makeInput({
      feverCount: 1,
    }));
    expect(result.level).toBe('warning');
    expect(result.message).toContain('発熱1名');
  });

  it('returns warning when contact count > 2', () => {
    const result = inferTodayStatusSummary(makeInput({
      contactCount: 5,
    }));
    expect(result.level).toBe('warning');
    expect(result.message).toContain('未対応連絡5件');
  });

  it('combines multiple warning reasons', () => {
    const result = inferTodayStatusSummary(makeInput({
      sameDayAbsenceCount: 1,
      highExceptionCount: 2,
      contactCount: 3,
    }));
    expect(result.level).toBe('warning');
    expect(result.message).toContain('当日欠席1名');
    expect(result.message).toContain('未対応2件');
    expect(result.message).toContain('未対応連絡3件');
  });

  // ── Critical ──

  it('returns critical when critical exceptions exist', () => {
    const result = inferTodayStatusSummary(makeInput({
      criticalExceptionCount: 1,
    }));
    expect(result.level).toBe('critical');
    expect(result.emoji).toBe('🔴');
    expect(result.message).toContain('要注意');
    expect(result.message).toContain('緊急対応1件');
    expect(result.hint).toBe('先に確認：申し送り');
  });

  it('returns critical with fever info when both critical exception and fever', () => {
    const result = inferTodayStatusSummary(makeInput({
      criticalExceptionCount: 1,
      feverCount: 2,
    }));
    expect(result.level).toBe('critical');
    expect(result.message).toContain('緊急対応1件');
    expect(result.message).toContain('発熱2名');
  });

  it('returns critical when fever count >= 2', () => {
    const result = inferTodayStatusSummary(makeInput({
      feverCount: 2,
    }));
    expect(result.level).toBe('critical');
    expect(result.message).toContain('発熱2名');
    expect(result.hint).toBe('看護師に確認してください');
  });

  // ── Priority order ──

  it('critical takes precedence over warning', () => {
    const result = inferTodayStatusSummary(makeInput({
      criticalExceptionCount: 1,
      sameDayAbsenceCount: 3,
      records: { completed: 0, total: 12 },
    }));
    // critical が優先される
    expect(result.level).toBe('critical');
  });

  // ── Edge cases ──

  it('handles zero totals gracefully', () => {
    const result = inferTodayStatusSummary(makeInput({
      records: { completed: 0, total: 0 },
      caseRecords: { completed: 0, total: 0 },
      attendance: { present: 0, scheduled: 0 },
    }));
    expect(result.level).toBe('good');
    expect(result.message).toContain('本日の入力はすべて完了しています');
  });

  it('handles negative computed values gracefully', () => {
    // completed > total (data inconsistency)
    const result = inferTodayStatusSummary(makeInput({
      records: { completed: 15, total: 12 },
    }));
    expect(result.level).toBe('good');
    // remaining should be clamped to 0
    expect(result.message).not.toContain('あと-3件');
  });

  // ── Delta integration ──

  it('returns undefined deltaText when delta is not provided', () => {
    const result = inferTodayStatusSummary(makeInput());
    expect(result.deltaText).toBeUndefined();
  });

  it('returns undefined deltaText when delta is null', () => {
    const result = inferTodayStatusSummary(makeInput({ delta: null }));
    expect(result.deltaText).toBeUndefined();
  });

  it('returns undefined deltaText when delta is all zeros', () => {
    const result = inferTodayStatusSummary(makeInput({
      delta: { pendingDelta: 0, absenceDelta: 0, feverDelta: 0, urgentDelta: 0 },
    }));
    expect(result.deltaText).toBeUndefined();
  });

  it('returns deltaText for good level when delta has changes', () => {
    const result = inferTodayStatusSummary(makeInput({
      delta: { pendingDelta: -3, absenceDelta: 0, feverDelta: 0, urgentDelta: 0 },
    }));
    expect(result.level).toBe('good');
    expect(result.deltaText).toBe('前日比 記録-3');
  });

  it('returns deltaText for warning level when delta has changes', () => {
    const result = inferTodayStatusSummary(makeInput({
      sameDayAbsenceCount: 2,
      delta: { pendingDelta: 4, absenceDelta: 2, feverDelta: 0, urgentDelta: 0 },
    }));
    expect(result.level).toBe('warning');
    expect(result.deltaText).toBe('前日比 記録+4');
  });

  it('returns deltaText for critical level when delta has changes', () => {
    const result = inferTodayStatusSummary(makeInput({
      criticalExceptionCount: 1,
      delta: { pendingDelta: 0, absenceDelta: 0, feverDelta: 2, urgentDelta: 0 },
    }));
    expect(result.level).toBe('critical');
    expect(result.deltaText).toBe('前日比 発熱+2');
  });

  it('does not break existing level/message when delta is provided', () => {
    const result = inferTodayStatusSummary(makeInput({
      delta: { pendingDelta: 5, absenceDelta: 0, feverDelta: 0, urgentDelta: 0 },
    }));
    // Level and message should remain the same as without delta
    expect(result.level).toBe('good');
    expect(result.message).toContain('順調');
    expect(result.deltaText).toBe('前日比 記録+5');
  });
});
