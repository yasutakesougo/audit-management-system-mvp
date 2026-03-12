import { describe, expect, it } from 'vitest';
import { generateDailyProposals, type DailyProposalInput } from '../dailyProposalGenerator';

const makeInput = (overrides?: Partial<DailyProposalInput>): DailyProposalInput => ({
  date: '2026-03-12',
  recordId: 'rec-1',
  userRows: [],
  ...overrides,
});

const makeRow = (userId: string, specialNotes: string, userName = '') => ({
  userId,
  userName,
  amActivity: '',
  pmActivity: '',
  lunchAmount: '',
  problemBehavior: {
    selfHarm: false,
    otherInjury: false,
    loudVoice: false,
    pica: false,
    other: false,
  },
  specialNotes,
});

describe('generateDailyProposals', () => {
  it('キーワード「改善」を含む specialNotes から proposal を生成する', () => {
    const input = makeInput({
      userRows: [makeRow('U001', '活動内容の改善が必要', '山田太郎')],
    });
    const result = generateDailyProposals(input);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('daily');
    expect(result[0].userId).toBe('U001');
    expect(result[0].title).toContain('[Daily]');
    expect(result[0].title).toContain('改善');
    expect(result[0].status).toBe('proposed');
    expect(result[0].evidenceRef.type).toBe('daily-record');
  });

  it('キーワードを含まない specialNotes は除外される', () => {
    const input = makeInput({
      userRows: [makeRow('U001', '特に問題なし')],
    });
    expect(generateDailyProposals(input)).toEqual([]);
  });

  it('複数キーワードのいずれかに一致すれば生成される', () => {
    const keywords = ['改善', '変更', '提案', '検討', '見直し'];
    for (const kw of keywords) {
      const input = makeInput({
        userRows: [makeRow('U001', `今後の${kw}点`)],
      });
      const result = generateDailyProposals(input);
      expect(result).toHaveLength(1);
    }
  });

  it('specialNotes が空の行は除外される', () => {
    const input = makeInput({
      userRows: [makeRow('U001', '')],
    });
    expect(generateDailyProposals(input)).toEqual([]);
  });

  it('空配列なら空配列を返す', () => {
    expect(generateDailyProposals(makeInput())).toEqual([]);
  });

  it('複数の user row から複数の proposal を生成する', () => {
    const input = makeInput({
      userRows: [
        makeRow('U001', '支援方法の改善を検討'),
        makeRow('U002', '特に問題なし'),
        makeRow('U003', '活動の見直しが必要'),
      ],
    });
    const result = generateDailyProposals(input);
    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe('U001');
    expect(result[1].userId).toBe('U003');
  });

  it('evidenceRef に date と recordId が正しく設定される', () => {
    const input = makeInput({
      date: '2026-03-15',
      recordId: 'rec-42',
      userRows: [makeRow('U001', '対応方法の変更を検討')],
    });
    const result = generateDailyProposals(input);
    const ref = result[0].evidenceRef;
    expect(ref.type).toBe('daily-record');
    expect(ref.itemId).toBe('rec-42');
    if (ref.type === 'daily-record') {
      expect(ref.date).toBe('2026-03-15');
      expect(ref.userId).toBe('U001');
    }
  });

  it('recordId 未指定の場合は date が itemId に使われる', () => {
    const input = makeInput({
      date: '2026-03-15',
      recordId: undefined,
      userRows: [makeRow('U001', '活動の改善')],
    });
    const result = generateDailyProposals(input);
    expect(result[0].evidenceRef.itemId).toBe('2026-03-15');
  });

  it('title は50文字以内に切り詰められる', () => {
    const longNote = '改善' + 'あ'.repeat(100);
    const input = makeInput({
      userRows: [makeRow('U001', longNote)],
    });
    const result = generateDailyProposals(input);
    expect(result[0].title.length).toBeLessThanOrEqual(58); // '[Daily] ' (8) + 50
  });
});
