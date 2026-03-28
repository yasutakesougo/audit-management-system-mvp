/**
 * @fileoverview dailyTableMapper の単体テスト
 *
 * Phase 1 Issue #2: mapper のラウンドトリップおよび正規化テスト
 */

import { describe, it, expect } from 'vitest';
import type { UserRowData } from '../../hooks/useTableDailyRecordForm';
import type { DailyTableRecord } from '../../infra/dailyTableRepository';
import {
  toDailyTableRecord,
  fromDailyTableRecord,
  toLunchIntake,
  toProblemBehaviorTypes,
  fromProblemBehaviorTypes,
} from '../dailyTableMapper';
import type { SaveContext } from '../dailyTableMapper';

// ─── helpers ────────────────────────────────────────────

const makeRow = (overrides: Partial<UserRowData> = {}): UserRowData => ({
  userId: 'u1',
  userName: 'テスト太郎',
  amActivity: '午前作業',
  pmActivity: '午後作業',
  lunchAmount: 'full',
  problemBehavior: {
    selfHarm: false,
    otherInjury: false,
    loudVoice: true,
    pica: false,
    other: false,
  },
  specialNotes: '特記事項メモ',
  behaviorTags: ['tag1', 'tag2'],
  ...overrides,
});

const context: SaveContext = {
  date: '2026-03-15',
  reporter: { name: '記録者A', role: '生活支援員' },
  submittedAt: '2026-03-15T10:00:00.000Z',
};

// ─── toLunchIntake ──────────────────────────────────────

describe('toLunchIntake', () => {
  it('有効な値を返す', () => {
    expect(toLunchIntake('full')).toBe('full');
    expect(toLunchIntake('80')).toBe('80');
    expect(toLunchIntake('half')).toBe('half');
    expect(toLunchIntake('small')).toBe('small');
    expect(toLunchIntake('none')).toBe('none');
  });

  it('無効な値で undefined を返す', () => {
    expect(toLunchIntake('invalid')).toBeUndefined();
    expect(toLunchIntake('100')).toBeUndefined();
  });

  it('空文字で undefined を返す', () => {
    expect(toLunchIntake('')).toBeUndefined();
    expect(toLunchIntake('   ')).toBeUndefined();
  });
});

// ─── toProblemBehaviorTypes ─────────────────────────────

describe('toProblemBehaviorTypes', () => {
  it('複数フラグ on → 配列', () => {
    const types = toProblemBehaviorTypes({
      selfHarm: true,
      otherInjury: false,
      loudVoice: true,
      pica: false,
      other: true,
    });

    expect(types).toHaveLength(3);
    expect(types).toContain('selfHarm');
    expect(types).toContain('shouting'); // loudVoice → shouting
    expect(types).toContain('other');
  });

  it('全フラグ off → 空配列', () => {
    const types = toProblemBehaviorTypes({
      selfHarm: false,
      otherInjury: false,
      loudVoice: false,
      pica: false,
      other: false,
    });

    expect(types).toEqual([]);
  });
});

// ─── fromProblemBehaviorTypes ───────────────────────────

describe('fromProblemBehaviorTypes', () => {
  it('ラウンドトリップ: 変換 → 逆変換 で一致する', () => {
    const original: UserRowData['problemBehavior'] = {
      selfHarm: true,
      otherInjury: false,
      loudVoice: true,
      pica: false,
      other: false,
    };

    const types = toProblemBehaviorTypes(original);
    const restored = fromProblemBehaviorTypes(types);

    expect(restored).toEqual(original);
  });

  it('空配列 → 全 false', () => {
    const result = fromProblemBehaviorTypes([]);

    expect(result).toEqual({
      selfHarm: false,
      otherInjury: false,
      loudVoice: false,
      pica: false,
      other: false,
    });
  });
});

// ─── toDailyTableRecord ────────────────────────────────

describe('toDailyTableRecord', () => {
  it('全フィールドが正常に変換される', () => {
    const row = makeRow();
    const record = toDailyTableRecord(row, context);

    expect(record.userId).toBe('u1');
    expect(record.recordDate).toBe('2026-03-15');
    expect(record.activities.am).toBe('午前作業');
    expect(record.activities.pm).toBe('午後作業');
    expect(record.lunchIntake).toBe('full');
    expect(record.problemBehaviors).toContain('shouting');
    expect(record.behaviorTags).toEqual(['tag1', 'tag2']);
    expect(record.notes).toBe('特記事項メモ');
    expect(record.submittedAt).toBe('2026-03-15T10:00:00.000Z');
    expect(record.authorName).toBe('記録者A');
    expect(record.authorRole).toBe('生活支援員');
  });

  it('空値が undefined に正規化される', () => {
    const row = makeRow({
      amActivity: '',
      pmActivity: '  ',
      lunchAmount: '',
      specialNotes: '',
      behaviorTags: [],
      problemBehavior: {
        selfHarm: false,
        otherInjury: false,
        loudVoice: false,
        pica: false,
        other: false,
      },
    });
    const record = toDailyTableRecord(row, context);

    expect(record.activities.am).toBeUndefined();
    expect(record.activities.pm).toBeUndefined();
    expect(record.lunchIntake).toBeUndefined();
    expect(record.problemBehaviors).toBeUndefined();
    expect(record.behaviorTags).toBeUndefined();
    expect(record.notes).toBeUndefined();
  });
});

// ─── fromDailyTableRecord ──────────────────────────────

describe('fromDailyTableRecord', () => {
  it('ラウンドトリップ: 変換 → 逆変換 で主要フィールドが復元される', () => {
    const originalRow = makeRow();
    const record = toDailyTableRecord(originalRow, context);
    const restored = fromDailyTableRecord(record);

    // userId, activities, notes は完全一致
    expect(restored.userId).toBe(originalRow.userId);
    expect(restored.amActivity).toBe(originalRow.amActivity);
    expect(restored.pmActivity).toBe(originalRow.pmActivity);
    expect(restored.specialNotes).toBe(originalRow.specialNotes);

    // lunchAmount は LunchIntake として保持
    expect(restored.lunchAmount).toBe('full');

    // problemBehavior は loudVoice → shouting → loudVoice のラウンドトリップ
    expect(restored.problemBehavior.loudVoice).toBe(true);
    expect(restored.problemBehavior.selfHarm).toBe(false);

    // behaviorTags は配列として復元
    expect(restored.behaviorTags).toEqual(['tag1', 'tag2']);
  });

  it('optional フィールドが欠損した record も安全に変換される', () => {
    const record: DailyTableRecord = {
      userId: 'u1',
      recordDate: '2026-03-15',
      activities: {},
      submittedAt: '2026-03-15T10:00:00.000Z',
    };

    const restored = fromDailyTableRecord(record);

    expect(restored.amActivity).toBe('');
    expect(restored.pmActivity).toBe('');
    expect(restored.lunchAmount).toBe('');
    expect(restored.specialNotes).toBe('');
    expect(restored.behaviorTags).toEqual([]);
    expect(Object.values(restored.problemBehavior).every((v) => v === false)).toBe(true);
  });
});
