/**
 * buildSceneNextAction — unit tests
 */
import { describe, expect, it } from 'vitest';
import { buildSceneNextAction, type SceneNextActionInput } from './buildSceneNextAction';

function makeInput(overrides: Partial<SceneNextActionInput> = {}): SceneNextActionInput {
  return {
    scene: 'am-activity',
    pendingBriefings: 0,
    pendingAttendance: 0,
    pendingDailyRecords: 0,
    alertUsers: [],
    ...overrides,
  };
}

describe('buildSceneNextAction', () => {
  // ── P1: 申し送り最優先 ──

  it('returns attendance-alert action when pendingBriefings > 0 (critical)', () => {
    const result = buildSceneNextAction(makeInput({ pendingBriefings: 2 }));
    expect(result.priority).toBe('critical');
    expect(result.ctaTarget).toBe('attendance-alert');
    expect(result.reasons).toContain('注意アラート 2件');
  });

  it('briefing priority overrides scene-specific checks', () => {
    const result = buildSceneNextAction(
      makeInput({
        scene: 'arrival-intake',
        pendingBriefings: 1,
        pendingAttendance: 5,
      }),
    );
    expect(result.ctaTarget).toBe('attendance-alert');
    expect(result.priority).toBe('critical');
  });

  // ── P2: 通所受け入れ + 出欠 ──

  it('returns attendance action during arrival-intake with pending attendance', () => {
    const result = buildSceneNextAction(
      makeInput({
        scene: 'arrival-intake',
        pendingAttendance: 3,
      }),
    );
    expect(result.priority).toBe('high');
    expect(result.ctaTarget).toBe('attendance');
    expect(result.reasons).toContain('出欠未入力 3件');
  });

  it('does NOT return attendance action in other scenes', () => {
    const result = buildSceneNextAction(
      makeInput({
        scene: 'am-activity',
        pendingAttendance: 3,
      }),
    );
    // Falls through to P4 (no pending records, no briefings)
    expect(result.ctaTarget).not.toBe('attendance');
  });

  // ── P3: 未記録の利用者 ──

  it('returns quick-record action when pendingDailyRecords > 0', () => {
    const result = buildSceneNextAction(
      makeInput({
        pendingDailyRecords: 5,
        alertUsers: [{ id: 'U001', name: '山田太郎' }],
      }),
    );
    expect(result.priority).toBe('high');
    expect(result.ctaTarget).toBe('quick-record');
    expect(result.userId).toBe('U001');
    expect(result.reasons).toContain('未記録 5件');
  });

  it('returns quick-record without userId when alertUsers is empty', () => {
    const result = buildSceneNextAction(
      makeInput({ pendingDailyRecords: 2, alertUsers: [] }),
    );
    expect(result.ctaTarget).toBe('quick-record');
    expect(result.userId).toBeUndefined();
  });

  // ── P4: すべて完了 ──

  it('returns low-priority user fallback when all clear', () => {
    const result = buildSceneNextAction(makeInput());
    expect(result.priority).toBe('low');
    expect(result.ctaTarget).toBe('user');
    expect(result.reasons).toHaveLength(0);
    expect(result.title).toBe('すべての対応が完了しています');
  });

  // ── P2.5: day-closing + 未記録 ──

  it('returns critical quick-record action during day-closing with pending records', () => {
    const result = buildSceneNextAction(
      makeInput({
        scene: 'day-closing',
        pendingDailyRecords: 3,
        alertUsers: [{ id: 'U001', name: '山田太郎' }],
      }),
    );
    expect(result.priority).toBe('critical');
    expect(result.ctaTarget).toBe('quick-record');
    expect(result.userId).toBe('U001');
    expect(result.title).toBe('本日の記録を完了してください');
    expect(result.ctaLabel).toContain('3名を記録する');
  });

  it('returns critical quick-record without userId when alertUsers is empty during day-closing', () => {
    const result = buildSceneNextAction(
      makeInput({
        scene: 'day-closing',
        pendingDailyRecords: 2,
        alertUsers: [],
      }),
    );
    expect(result.priority).toBe('critical');
    expect(result.ctaTarget).toBe('quick-record');
    expect(result.userId).toBeUndefined();
  });

  // ── P3.5: day-closing + 全完了 ──

  it('returns celebration message during day-closing when all complete', () => {
    const result = buildSceneNextAction(
      makeInput({ scene: 'day-closing' }),
    );
    expect(result.priority).toBe('low');
    expect(result.title).toContain('🎉');
    expect(result.title).toContain('完了しました');
    expect(result.ctaTarget).toBe('user');
  });

  // ── P1 still overrides day-closing ──

  it('briefing priority overrides day-closing specific checks', () => {
    const result = buildSceneNextAction(
      makeInput({
        scene: 'day-closing',
        pendingBriefings: 1,
        pendingDailyRecords: 5,
      }),
    );
    expect(result.ctaTarget).toBe('attendance-alert');
    expect(result.priority).toBe('critical');
  });

  // ── Scene propagation ──

  it('propagates scene to output', () => {
    const result = buildSceneNextAction(makeInput({ scene: 'before-departure' }));
    expect(result.scene).toBe('before-departure');
  });
});
