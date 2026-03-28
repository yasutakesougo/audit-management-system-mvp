import { describe, it, expect } from 'vitest';
import { createDailyRecordSnapshot } from '../createDailyRecordSnapshot';
import type { PersonDaily } from '../../../../../domain/daily/types';

describe('createDailyRecordSnapshot', () => {
  const baseRecord: PersonDaily = {
    id: 999,
    userId: 'U001',
    userName: 'テスト 太郎',
    date: '2026-04-01',
    status: '完了',
    reporter: { name: '担当者' },
    draft: { isDraft: true, savedAt: '2026-04-01T10:00:00Z' },
    createdAt: '2026-04-01T09:00:00Z',
    updatedAt: '2026-04-01T10:00:00Z',
    kind: 'A',
    data: {
      amActivities: ['作業', '朝礼'],
      pmActivities: [],
      specialNotes: '特になし',
    },
  };

  it('比較に不要な一時値(id, mockDate, draft, updatedAt)を落としたプレーンオブジェクトを返す', () => {
    const snapshot = createDailyRecordSnapshot(baseRecord);

    // 一時キーが排除されていること
    expect(snapshot).not.toHaveProperty('id');
    expect(snapshot).not.toHaveProperty('draft');
    expect(snapshot).not.toHaveProperty('createdAt');
    expect(snapshot).not.toHaveProperty('updatedAt');

    // 業務キーは保持されていること
    expect(snapshot.userId).toBe('U001');
    expect(snapshot.date).toBe('2026-04-01');
  });

  it('配列の要素が安定化(ソート済み・一意・空白除外)される', () => {
    const record: PersonDaily = {
      ...baseRecord,
      data: {
        amActivities: ['作業', ' 朝礼 ', '作業', ' '],
        pmActivities: [],
      },
    };

    const snapshot = createDailyRecordSnapshot(record);
    // '朝礼' < '作業' 等の辞書順ソート、重複排除、空要素排除
    expect(snapshot.data.amActivities).toEqual(['作業', '朝礼'].sort());
  });

  it('空文字と undefined が同値として扱われる(正規化)', () => {
    // パターン1: undefined
    const recordUndefined: PersonDaily = {
      ...baseRecord,
      data: {
        amActivities: [],
        pmActivities: [],
        specialNotes: undefined, // undefined
      },
    };

    // パターン2: 複数の空白を含む実質空文字
    const recordWhitespace: PersonDaily = {
      ...baseRecord,
      data: {
        amActivities: [],
        pmActivities: [],
        specialNotes: '   ', // 空白文字列
      },
    };

    const snap1 = createDailyRecordSnapshot(recordUndefined);
    const snap2 = createDailyRecordSnapshot(recordWhitespace);

    expect(snap1.data.specialNotes).toBe('');
    expect(snap2.data.specialNotes).toBe('');

    // 全オブジェクト比較でも完全一致（Deep Compare 前提）
    expect(snap1).toEqual(snap2);
  });

  it('ネストされたオブジェクト(problemBehavior, seizureRecord)の欠損も安定したshapeになる', () => {
    const recordEmpty: PersonDaily = {
      ...baseRecord,
      data: {
        amActivities: [],
        pmActivities: [],
        problemBehavior: undefined,
        seizureRecord: undefined,
      },
    };

    const snapshot = createDailyRecordSnapshot(recordEmpty);

    // プロパティが存在して全てデフォルト(false/空文字)になる
    expect(snapshot.data.problemBehavior).toEqual({
      selfHarm: false,
      otherInjury: false,
      loudVoice: false,
      pica: false,
      other: false,
      otherDetail: '',
    });

    expect(snapshot.data.seizureRecord).toEqual({
      occurred: false,
      time: '',
      duration: '',
      severity: '',
      notes: '',
    });
  });
});
