import { describe, it, expect } from 'vitest';
import type { UserRowData } from '../../../hooks/view-models/useTableDailyRecordForm';
import { toTableDailyRecordRow, buildTableDailyRecordRows } from '../buildTableDailyRecordRows';

describe('buildTableDailyRecordRows', () => {
  const createBaseRow = (): UserRowData => ({
    userId: 'U001',
    userName: '山田 太郎',
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
    specialNotes: '',
    behaviorTags: [],
  });

  describe('toTableDailyRecordRow', () => {
    it('1. 問題行動が true の項目だけ variant="filled", color="warning" になる', () => {
      const row = createBaseRow();
      row.problemBehavior.selfHarm = true;
      row.problemBehavior.loudVoice = true;

      const result = toTableDailyRecordRow(row);

      // true の項目
      expect(result.problemBehaviorVariants.selfHarm).toBe('filled');
      expect(result.problemBehaviorColors.selfHarm).toBe('warning');
      expect(result.problemBehaviorVariants.loudVoice).toBe('filled');
      expect(result.problemBehaviorColors.loudVoice).toBe('warning');

      // false の項目
      expect(result.problemBehaviorVariants.otherInjury).toBe('outlined');
      expect(result.problemBehaviorColors.otherInjury).toBe('default');
    });

    it('2. behaviorTags が undefined/null 相当でも [] になる（null吸収）', () => {
      const row = createBaseRow();
      row.behaviorTags = undefined as unknown as string[];

      const result = toTableDailyRecordRow(row);
      expect(result.behaviorTags).toEqual([]);
    });

    it('3. hasRowContent が期待どおりになる', () => {
      const row = createBaseRow();
      // 初期状態は空
      expect(toTableDailyRecordRow(row).hasRowContent).toBe(false);

      // 入力あり
      row.amActivity = '作業';
      expect(toTableDailyRecordRow(row).hasRowContent).toBe(true);
    });

    it('4. searchText が userId / userName などから安定生成される', () => {
      const row = createBaseRow();
      row.userName = 'テスト 太郎';
      row.userId = 'U999';
      row.amActivity = '内職';

      const result = toTableDailyRecordRow(row);
      expect(result.searchText).toContain('テスト 太郎');
      expect(result.searchText).toContain('u999');
      expect(result.searchText).toContain('内職');
    });
  });

  describe('buildTableDailyRecordRows', () => {
    it('複数行を正しく変換できること', () => {
      const row1 = createBaseRow();
      const row2 = createBaseRow();
      row2.userId = 'U002';
      
      const results = buildTableDailyRecordRows([row1, row2]);
      expect(results).toHaveLength(2);
      expect(results[0].userId).toBe('U001');
      expect(results[1].userId).toBe('U002');
      expect(results[0].problemBehaviorVariants).toBeDefined();
    });
  });
});
