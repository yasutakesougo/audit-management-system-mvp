import { describe, expect, it } from 'vitest';

import type { HighLoadWarning } from '@/features/schedules/domain/scheduleOpsLoadScore';
import { buildHighLoadTileViewModel } from '../buildHighLoadTileViewModel';

// ── Helper ────────────────────────────────────────────────────

function makeWarning(overrides?: Partial<HighLoadWarning>): HighLoadWarning {
  return {
    dateIso: '2026-03-24',
    score: 22,
    level: 'high',
    reasons: [{ key: 'over-capacity', label: '定員超過' }],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────

describe('buildHighLoadTileViewModel', () => {
  it('空配列 → visible: false', () => {
    const result = buildHighLoadTileViewModel([]);
    expect(result).toEqual({ visible: false });
  });

  it('1日 high → visible: true, dayCount: 1, hasCritical: false', () => {
    const result = buildHighLoadTileViewModel([
      makeWarning({ level: 'high', score: 22 }),
    ]);

    expect(result.visible).toBe(true);
    if (!result.visible) return; // type narrowing

    expect(result.dayCount).toBe(1);
    expect(result.hasCritical).toBe(false);
    expect(result.topWarning.level).toBe('high');
    expect(result.topWarning.score).toBe(22);
    expect(result.topWarning.topReasonLabel).toBe('定員超過');
    expect(result.topWarning.dateIso).toBe('2026-03-24');
    // dateLabel は locale 依存のため存在チェックのみ
    expect(result.topWarning.dateLabel).toBeTruthy();
  });

  it('2日 mixed (high + critical) → hasCritical: true, top は critical', () => {
    const result = buildHighLoadTileViewModel([
      makeWarning({ dateIso: '2026-03-24', level: 'high', score: 22 }),
      makeWarning({
        dateIso: '2026-03-25',
        level: 'critical',
        score: 35,
        reasons: [{ key: 'over-capacity', label: '定員超過' }, { key: 'absence-handling', label: '欠席対応 3件' }],
      }),
    ]);

    expect(result.visible).toBe(true);
    if (!result.visible) return;

    expect(result.dayCount).toBe(2);
    expect(result.hasCritical).toBe(true);
    // スコア降順で critical(35) が top
    expect(result.topWarning.level).toBe('critical');
    expect(result.topWarning.score).toBe(35);
    expect(result.topWarning.dateIso).toBe('2026-03-25');
    expect(result.topWarning.topReasonLabel).toBe('定員超過');
  });

  it('理由なし (reasons: []) → topReasonLabel: "高負荷" フォールバック', () => {
    const result = buildHighLoadTileViewModel([
      makeWarning({ reasons: [] }),
    ]);

    expect(result.visible).toBe(true);
    if (!result.visible) return;

    expect(result.topWarning.topReasonLabel).toBe('高負荷');
  });

  it('同スコアの high と critical → hasCritical: true', () => {
    const result = buildHighLoadTileViewModel([
      makeWarning({ dateIso: '2026-03-24', level: 'high', score: 22 }),
      makeWarning({
        dateIso: '2026-03-25',
        level: 'critical',
        score: 22,
        reasons: [{ key: 'no-slots', label: '空き枠なし' }],
      }),
    ]);

    expect(result.visible).toBe(true);
    if (!result.visible) return;

    expect(result.dayCount).toBe(2);
    expect(result.hasCritical).toBe(true);
    // 同スコアなのでどちらが top でもOK（安定ソートは保証しない）
    expect(result.topWarning.score).toBe(22);
  });

  it('3日以上 → dayCount が正しく反映', () => {
    const result = buildHighLoadTileViewModel([
      makeWarning({ dateIso: '2026-03-24', score: 22 }),
      makeWarning({ dateIso: '2026-03-25', score: 28 }),
      makeWarning({
        dateIso: '2026-03-26',
        score: 35,
        level: 'critical',
        reasons: [{ key: 'staff-on-leave', label: '既存有休 2件' }],
      }),
    ]);

    expect(result.visible).toBe(true);
    if (!result.visible) return;

    expect(result.dayCount).toBe(3);
    expect(result.topWarning.score).toBe(35);
    expect(result.topWarning.dateIso).toBe('2026-03-26');
    expect(result.topWarning.topReasonLabel).toBe('既存有休 2件');
    expect(result.hasCritical).toBe(true);
  });

  it('high のみ複数 → hasCritical: false', () => {
    const result = buildHighLoadTileViewModel([
      makeWarning({ dateIso: '2026-03-24', level: 'high', score: 22 }),
      makeWarning({ dateIso: '2026-03-25', level: 'high', score: 25 }),
    ]);

    expect(result.visible).toBe(true);
    if (!result.visible) return;

    expect(result.hasCritical).toBe(false);
    expect(result.topWarning.score).toBe(25);
  });
});
