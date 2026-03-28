import { describe, it, expect } from 'vitest';
import { 
  normalizeDailyRecord, 
  toTableRowViewModel, 
  mapToTableViewModel,
  RawDailyRecord,
  UserMasterData
} from '../mapToTableViewModel';

describe('mapToTableViewModel', () => {

  describe('normalizeDailyRecord', () => {
    it('欠損フィールドを安全なデフォルト値で補完する', () => {
      const raw: Partial<RawDailyRecord> = {};
      const normalized = normalizeDailyRecord(raw);
      
      expect(normalized.UserIdId).toBeNull();
      expect(normalized.TargetDate).toBeNull();
      expect(normalized.ServiceType).toBe('通常');
      expect(normalized.Status).toBe('draft');
      expect(normalized.Notes).toBe('');
    });

    it('不要な空白をトリムする', () => {
      const raw = {
        TargetDate: ' 2026-04-01 ',
        Notes: '  テストメモ   '
      };
      const normalized = normalizeDailyRecord(raw);
      expect(normalized.TargetDate).toBe('2026-04-01');
      expect(normalized.Notes).toBe('テストメモ');
    });
  });

  describe('toTableRowViewModel', () => {
    it('ユーザー情報と結合し ViewModel を生成する', () => {
      const record: RawDailyRecord = {
        Id: 1,
        UserIdId: 100,
        TargetDate: '2026-04-01',
        Status: '完了', // 日本語ステータス
        Notes: '良好'
      };
      const user: UserMasterData = { Id: 100, FullName: '田中太郎' };

      const vm = toTableRowViewModel(normalizeDailyRecord(record), user);
      
      expect(vm.recordId).toBe(1);
      expect(vm.userId).toBe(100);
      expect(vm.userName).toBe('田中太郎');
      expect(vm.status).toBe('completed');
    });

    it('マスターにユーザーが存在しない場合フォールバックする', () => {
      const record: RawDailyRecord = { Id: 2, UserIdId: 999 };
      const vm = toTableRowViewModel(normalizeDailyRecord(record), undefined);
      
      expect(vm.userId).toBe(999);
      expect(vm.userName).toBe('不明なユーザー');
    });
  });

  describe('mapToTableViewModel (一括処理)', () => {
    it('リスト全体を変換し、日付降順・名前昇順でソートする', () => {
      const users: UserMasterData[] = [
        { Id: 10, FullName: '山田一郎' },
        { Id: 20, FullName: '佐藤花子' }, // ローマ字順などでなく、Jaロケールとして扱う
      ];

      const records: RawDailyRecord[] = [
        { Id: 1, UserIdId: 10, TargetDate: '2026-04-01' },
        { Id: 2, UserIdId: 20, TargetDate: '2026-04-02' }, // 最新なので一番上になるはず
        { Id: 3, UserIdId: 20, TargetDate: '2026-04-01' }, // 日付が同じなら名前順。山田と佐藤
      ];

      const result = mapToTableViewModel(records, users);

      expect(result).toHaveLength(3);
      
      // 1番目: 4-02 の佐藤
      expect(result[0].recordId).toBe(2);
      expect(result[0].targetDate).toBe('2026-04-02');
      
      // 2番目以降は 4-01 の山田と佐藤（名前の昇順。さとう < やまだ なので佐藤が先に来るはず）
      expect(result[1].targetDate).toBe('2026-04-01');
      expect(result[1].userName).toBe('佐藤花子');
      
      expect(result[2].targetDate).toBe('2026-04-01');
      expect(result[2].userName).toBe('山田一郎');
    });
  });
});
