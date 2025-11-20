import { describe, expect, it } from 'vitest';
import { PersonDaily } from '../../domain/daily/types';
import {
    addDailyRecord,
    calculateDailyRecordStats,
    deleteDailyRecord,
    filterRecordsByDate,
    filterRecordsByStatus,
    generateNewRecordId,
    saveDailyRecord,
    searchRecordsByName,
    updateDailyRecord,
    validateDailyRecord
} from '../dailyRecordLogic';

// テスト用のモックデータ
const createMockRecord = (overrides: Partial<PersonDaily> = {}): PersonDaily => ({
  id: 1,
  personId: '001',
  personName: '田中太郎',
  date: '2024-11-16',
  status: '完了',
  reporter: { name: '職員A' },
  draft: { isDraft: false },
  kind: 'A',
  data: {
    amActivities: ['散歩', '体操'],
    pmActivities: ['読書', 'テレビ鑑賞'],
    amNotes: '今日は調子が良く、積極的に活動に参加していました。',
    pmNotes: '午後は少し疲れた様子でしたが、落ち着いて過ごしていました。',
    mealAmount: '完食',
    problemBehavior: {
      selfHarm: false,
      violence: false,
      loudVoice: false,
      pica: false,
      other: false,
      otherDetail: ''
    },
    seizureRecord: {
      occurred: false,
      time: '',
      duration: '',
      severity: undefined,
      notes: ''
    },
    specialNotes: '特に問題なく過ごせました。'
  },
  ...overrides
});

const createRecordWithoutId = (overrides: Partial<Omit<PersonDaily, 'id'>> = {}): Omit<PersonDaily, 'id'> => {
  const record = createMockRecord(overrides);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...recordWithoutId } = record;
  return recordWithoutId;
};

describe('dailyRecordLogic', () => {
  describe('generateNewRecordId', () => {
    it('空の配列の場合は1を返す', () => {
      const result = generateNewRecordId([]);
      expect(result).toBe(1);
    });

    it('既存レコードの最大ID + 1を返す', () => {
      const records = [
        createMockRecord({ id: 3 }),
        createMockRecord({ id: 1 }),
        createMockRecord({ id: 5 })
      ];
      const result = generateNewRecordId(records);
      expect(result).toBe(6);
    });

    it('IDが連続していない場合も正しく最大値を取得', () => {
      const records = [
        createMockRecord({ id: 10 }),
        createMockRecord({ id: 2 }),
        createMockRecord({ id: 100 })
      ];
      const result = generateNewRecordId(records);
      expect(result).toBe(101);
    });
  });

  describe('addDailyRecord', () => {
    it('新しいレコードを追加し、IDを自動生成する', () => {
      const existingRecords = [
        createMockRecord({ id: 1 }),
        createMockRecord({ id: 2 })
      ];
      const newRecord = createRecordWithoutId({
        personName: '佐藤花子',
        personId: '002'
      });

      const result = addDailyRecord(existingRecords, newRecord);

      expect(result).toHaveLength(3);
      expect(result[2].id).toBe(3);
      expect(result[2].personName).toBe('佐藤花子');
      expect(result[2].personId).toBe('002');
    });

    it('元の配列は変更されない（immutable）', () => {
      const existingRecords = [createMockRecord({ id: 1 })];
      const originalLength = existingRecords.length;
      const newRecord = createRecordWithoutId();

      addDailyRecord(existingRecords, newRecord);

      expect(existingRecords).toHaveLength(originalLength);
    });
  });

  describe('updateDailyRecord', () => {
    it('指定されたIDのレコードを更新する', () => {
      const existingRecords = [
        createMockRecord({ id: 1, personName: '田中太郎' }),
        createMockRecord({ id: 2, personName: '佐藤花子' })
      ];
      const updatedRecord = createRecordWithoutId({
        personName: '田中次郎',
        status: '作成中'
      });

      const result = updateDailyRecord(existingRecords, 1, updatedRecord);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].personName).toBe('田中次郎');
      expect(result[0].status).toBe('作成中');
      expect(result[1].personName).toBe('佐藤花子'); // 他のレコードは変更されない
    });

    it('存在しないIDを指定した場合、元の配列をそのまま返す', () => {
      const existingRecords = [
        createMockRecord({ id: 1 }),
        createMockRecord({ id: 2 })
      ];
      const updatedRecord = createRecordWithoutId();

      const result = updateDailyRecord(existingRecords, 999, updatedRecord);

      expect(result).toEqual(existingRecords);
    });
  });

  describe('deleteDailyRecord', () => {
    it('指定されたIDのレコードを削除する', () => {
      const existingRecords = [
        createMockRecord({ id: 1, personName: '田中太郎' }),
        createMockRecord({ id: 2, personName: '佐藤花子' }),
        createMockRecord({ id: 3, personName: '鈴木次郎' })
      ];

      const result = deleteDailyRecord(existingRecords, 2);

      expect(result).toHaveLength(2);
      expect(result.map(r => r.personName)).toEqual(['田中太郎', '鈴木次郎']);
    });

    it('存在しないIDを指定した場合、元の配列をそのまま返す', () => {
      const existingRecords = [createMockRecord({ id: 1 })];

      const result = deleteDailyRecord(existingRecords, 999);

      expect(result).toEqual(existingRecords);
    });
  });

  describe('saveDailyRecord', () => {
    it('editingRecordIdが未定義の場合は新規追加', () => {
      const existingRecords = [createMockRecord({ id: 1 })];
      const newRecord = createRecordWithoutId({
        personName: '佐藤花子'
      });

      const result = saveDailyRecord(existingRecords, newRecord);

      expect(result).toHaveLength(2);
      expect(result[1].id).toBe(2);
      expect(result[1].personName).toBe('佐藤花子');
    });

    it('editingRecordIdが指定されている場合は更新', () => {
      const existingRecords = [
        createMockRecord({ id: 1, personName: '田中太郎' })
      ];
      const updatedRecord = createRecordWithoutId({
        personName: '田中次郎'
      });

      const result = saveDailyRecord(existingRecords, updatedRecord, 1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].personName).toBe('田中次郎');
    });
  });

  describe('validateDailyRecord', () => {
    it('有効なレコードの場合、エラーなしを返す', () => {
      const validRecord = createRecordWithoutId();

      const result = validateDailyRecord(validRecord);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('利用者名が空の場合、エラーを返す', () => {
      const invalidRecord = createRecordWithoutId({
        personName: ''
      });

      const result = validateDailyRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('利用者名は必須です');
    });

    it('利用者IDが空の場合、エラーを返す', () => {
      const invalidRecord = createRecordWithoutId({
        personId: ''
      });

      const result = validateDailyRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('利用者IDは必須です');
    });

    it('日付が空の場合、エラーを返す', () => {
      const invalidRecord = createRecordWithoutId({
        date: ''
      });

      const result = validateDailyRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('日付は必須です');
    });

    it('日付形式が不正な場合、エラーを返す', () => {
      const invalidRecord = createRecordWithoutId({
        date: '2024/11/16' // 正しい形式は 2024-11-16
      });

      const result = validateDailyRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('日付は YYYY-MM-DD 形式で入力してください');
    });

    it('ステータスが不正な場合、エラーを返す', () => {
      const invalidRecord = createRecordWithoutId({
        status: '不正なステータス' as '完了' // 型エラーを回避しつつ不正値をテスト
      });

      const result = validateDailyRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ステータスが不正です');
    });

    it('発作が発生したが時刻が空の場合、エラーを返す', () => {
      const invalidRecord = createRecordWithoutId({
        data: {
          ...createRecordWithoutId().data,
          seizureRecord: {
            occurred: true,
            time: '',
            duration: '5分',
            severity: '軽度',
            notes: ''
          }
        }
      });

      const result = validateDailyRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('発作が発生した場合は時刻を入力してください');
    });

    it('発作が発生したが持続時間が空の場合、エラーを返す', () => {
      const invalidRecord = createRecordWithoutId({
        data: {
          ...createRecordWithoutId().data,
          seizureRecord: {
            occurred: true,
            time: '14:30',
            duration: '',
            severity: '軽度',
            notes: ''
          }
        }
      });

      const result = validateDailyRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('発作が発生した場合は持続時間を入力してください');
    });

    it('その他の問題行動があるが詳細が空の場合、エラーを返す', () => {
      const invalidRecord = createRecordWithoutId({
        data: {
          ...createRecordWithoutId().data,
          problemBehavior: {
            selfHarm: false,
            violence: false,
            loudVoice: false,
            pica: false,
            other: true,
            otherDetail: ''
          }
        }
      });

      const result = validateDailyRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('その他の問題行動がある場合は詳細を入力してください');
    });

    it('複数のエラーがある場合、全てのエラーを返す', () => {
      const invalidRecord = createRecordWithoutId({
        personName: '',
        personId: '',
        date: ''
      });

      const result = validateDailyRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('利用者名は必須です');
      expect(result.errors).toContain('利用者IDは必須です');
      expect(result.errors).toContain('日付は必須です');
    });
  });

  describe('calculateDailyRecordStats', () => {
    it('今日の統計を正しく計算する', () => {
      const today = '2024-11-16';
      const records = [
        createMockRecord({ id: 1, date: today, status: '完了' }),
        createMockRecord({ id: 2, date: today, status: '完了' }),
        createMockRecord({ id: 3, date: today, status: '作成中' }),
        createMockRecord({ id: 4, date: today, status: '未作成' }),
        createMockRecord({ id: 5, date: '2024-11-15', status: '完了' }) // 他の日
      ];

      const result = calculateDailyRecordStats(records, today);

      expect(result.total).toBe(4);
      expect(result.completed).toBe(2);
      expect(result.inProgress).toBe(1);
      expect(result.notStarted).toBe(1);
      expect(result.completionRate).toBe(50); // 2/4 = 0.5 = 50%
    });

    it('レコードがない場合、0を返す', () => {
      const result = calculateDailyRecordStats([], '2024-11-16');

      expect(result.total).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.inProgress).toBe(0);
      expect(result.notStarted).toBe(0);
      expect(result.completionRate).toBe(0);
    });

    it('日付を指定しない場合、今日の日付を使用する', () => {
      const today = new Date().toISOString().split('T')[0];
      const records = [
        createMockRecord({ id: 1, date: today, status: '完了' })
      ];

      const result = calculateDailyRecordStats(records);

      expect(result.total).toBe(1);
      expect(result.completed).toBe(1);
    });
  });

  describe('searchRecordsByName', () => {
    const records = [
      createMockRecord({ id: 1, personName: '田中太郎', personId: '001' }),
      createMockRecord({ id: 2, personName: '佐藤花子', personId: '002' }),
      createMockRecord({ id: 3, personName: '田中二郎', personId: '003' })
    ];

    it('利用者名での部分一致検索', () => {
      const result = searchRecordsByName(records, '田中');

      expect(result).toHaveLength(2);
      expect(result.map(r => r.personName)).toEqual(['田中太郎', '田中二郎']);
    });

    it('利用者IDでの検索', () => {
      const result = searchRecordsByName(records, '002');

      expect(result).toHaveLength(1);
      expect(result[0].personName).toBe('佐藤花子');
    });

    it('大文字小文字を無視して検索', () => {
      const result = searchRecordsByName(records, 'TARO');

      expect(result).toHaveLength(0); // 日本語名なので該当なし
    });

    it('空の検索クエリの場合、全てのレコードを返す', () => {
      const result = searchRecordsByName(records, '');

      expect(result).toEqual(records);
    });

    it('スペースのみの検索クエリの場合、全てのレコードを返す', () => {
      const result = searchRecordsByName(records, '   ');

      expect(result).toEqual(records);
    });
  });

  describe('filterRecordsByStatus', () => {
    const records = [
      createMockRecord({ id: 1, status: '完了' }),
      createMockRecord({ id: 2, status: '作成中' }),
      createMockRecord({ id: 3, status: '未作成' }),
      createMockRecord({ id: 4, status: '完了' })
    ];

    it('完了ステータスでフィルタリング', () => {
      const result = filterRecordsByStatus(records, '完了');

      expect(result).toHaveLength(2);
      expect(result.every(r => r.status === '完了')).toBe(true);
    });

    it('作成中ステータスでフィルタリング', () => {
      const result = filterRecordsByStatus(records, '作成中');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('作成中');
    });

    it('allを指定した場合、全てのレコードを返す', () => {
      const result = filterRecordsByStatus(records, 'all');

      expect(result).toEqual(records);
    });
  });

  describe('filterRecordsByDate', () => {
    const records = [
      createMockRecord({ id: 1, date: '2024-11-16' }),
      createMockRecord({ id: 2, date: '2024-11-15' }),
      createMockRecord({ id: 3, date: '2024-11-16' }),
      createMockRecord({ id: 4, date: '2024-11-14' })
    ];

    it('指定した日付でフィルタリング', () => {
      const result = filterRecordsByDate(records, '2024-11-16');

      expect(result).toHaveLength(2);
      expect(result.every(r => r.date === '2024-11-16')).toBe(true);
    });

    it('空の日付を指定した場合、全てのレコードを返す', () => {
      const result = filterRecordsByDate(records, '');

      expect(result).toEqual(records);
    });
  });
});