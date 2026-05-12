import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { SharePointAbcRecordRepository } from '../SharePointAbcRecordRepository';
import type { AbcRecordCreateInput } from '@/domain/abc/abcRecord';

describe('SharePointAbcRecordRepository', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDataProvider: Record<string, any>;
  let repository: SharePointAbcRecordRepository;

  beforeEach(() => {
    mockDataProvider = {
      listItems: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
    };
    repository = new SharePointAbcRecordRepository(mockDataProvider as unknown as IDataProvider);
  });

  describe('save', () => {
    it('ABC記録をSharePoint平坦ペイロードに変換して新規作成できること', async () => {
      const input: AbcRecordCreateInput = {
        userId: 'user-01',
        userName: '山田 太郎',
        occurredAt: '2026-05-12T10:00:00Z',
        setting: 'リビング',
        antecedent: '他者が大声を出した',
        behavior: '耳をふさいで叫ぶ',
        consequence: '静かな部屋に移動させた',
        intensity: 'medium',
        durationMinutes: 10,
        riskFlag: false,
        recorderName: '支援員A',
        tags: ['聴覚過敏', 'パニック'],
        notes: '特になし',
        createdBy: 'staff-01',
        sourceContext: {
          source: 'daily-support',
          date: '2026-05-12',
          slotId: 'slot-abc',
          slotLabel: '午前活動',
          returnUrl: '/daily-record',
        },
      };

      // Mock createItem response
      mockDataProvider.createItem.mockResolvedValue({ Id: 101 });

      // Mock listItems (fetch created item)
      mockDataProvider.listItems.mockResolvedValue([
        {
          Id: 101,
          Title: 'user-01_2026-05-12T10:00:00Z',
          AbcRecordId: 'uuid-1234',
          UserId: 'user-01',
          RecordDate: '2026-05-12',
          OccurredAt: '2026-05-12T10:00:00Z',
          Setting: 'リビング',
          Antecedent: '他者が大声を出した',
          Behavior: '耳をふさいで叫ぶ',
          Consequence: '静かな部屋に移動させた',
          Intensity: 'medium',
          DurationMinutes: 10,
          RiskFlag: false,
          TagsJson: JSON.stringify(['聴覚過敏', 'パニック']),
          Notes: '特になし',
          SourcePage: 'daily-support',
          SourceDate: '2026-05-12',
          SourceSlotId: 'slot-abc',
          SourceSlotLabel: '午前活動',
          ReturnUrl: '/daily-record',
          RecorderName: '支援員A',
          CreatedByCode: 'staff-01',
          CreatedAt: '2026-05-12T10:05:00Z',
          IsDeleted: false,
        },
      ]);

      const result = await repository.save(input);

      // Verify createItem payload
      expect(mockDataProvider.createItem).toHaveBeenCalledWith(
        'AbcBehaviorRecords',
        expect.objectContaining({
          UserId: 'user-01',
          RecordDate: '2026-05-12',
          Intensity: 'medium',
          CreatedByCode: 'staff-01',
          IsDeleted: false,
        })
      );

      // Ensure stable UUID was generated or assigned
      const payload = mockDataProvider.createItem.mock.calls[0][1];
      expect(payload.AbcRecordId).toBeDefined();
      expect(typeof payload.AbcRecordId).toBe('string');

      // Verify return mapped model
      expect(result.id).toBe('101');
      expect(result.userId).toBe('user-01');
      expect(result.abcRecordId).toBe('uuid-1234');
      expect(result.tags).toEqual(['聴覚過敏', 'パニック']);
      expect(result.sourceContext).toEqual({
        source: 'daily-support',
        date: '2026-05-12',
        slotId: 'slot-abc',
        slotLabel: '午前活動',
        returnUrl: '/daily-record',
      });
    });
  });

  describe('update', () => {
    it('不変フィールドの上書きを禁止し、更新日時と安全な項目のみをPATCH送信すること', async () => {
      const inputUpdate: Partial<AbcRecordCreateInput> = {
        setting: '食堂',
        behavior: '大声で泣く',
        // 不変フィールド (これらは送信されないはず)
        abcRecordId: 'hacker-uuid',
        createdAt: '2020-01-01T00:00:00Z',
        createdBy: 'hacker-user',
        recorderName: '不審な上書き者',
        // 更新監査
        updatedBy: 'staff-02',
      };

      mockDataProvider.listItems.mockResolvedValue([
        {
          Id: 202,
          AbcRecordId: 'original-uuid',
          UserId: 'user-01',
          Setting: '食堂',
          Behavior: '大声で泣く',
          RecorderName: '支援員A', // 変更されないはず
          CreatedByCode: 'staff-01', // 変更されないはず
          CreatedAt: '2026-05-12T10:00:00Z', // 変更されないはず
          UpdatedAt: '2026-05-12T11:00:00Z',
          UpdatedByCode: 'staff-02',
          IsDeleted: false,
        },
      ]);

      const result = await repository.update('202', inputUpdate);

      // Verify updateItem payload
      expect(mockDataProvider.updateItem).toHaveBeenCalledWith(
        'AbcBehaviorRecords',
        202,
        expect.objectContaining({
          Setting: '食堂',
          Behavior: '大声で泣く',
          UpdatedByCode: 'staff-02',
        })
      );

      // Verify that immutable fields were NOT sent to update payload
      const payload = mockDataProvider.updateItem.mock.calls[0][2];
      expect(payload.AbcRecordId).toBeUndefined();
      expect(payload.CreatedAt).toBeUndefined();
      expect(payload.CreatedByCode).toBeUndefined();
      expect(payload.RecorderName).toBeUndefined();

      // Verify returned result preserves immutability on domain model
      expect(result?.abcRecordId).toBe('original-uuid');
      expect(result?.setting).toBe('食堂');
      expect(result?.behavior).toBe('大声で泣く');
      expect(result?.updatedBy).toBe('staff-02');
    });
  });

  describe('delete', () => {
    it('物理削除（DELETE）を呼び出さず、ソフトデリート用のPATCH送信を行うこと', async () => {
      await repository.delete('303');

      // Ensure DELETE was never called
      expect(mockDataProvider.deleteItem).not.toHaveBeenCalled();

      // Ensure UPDATE was called with soft-delete payloads
      expect(mockDataProvider.updateItem).toHaveBeenCalledWith(
        'AbcBehaviorRecords',
        303,
        expect.objectContaining({
          IsDeleted: true,
          DeletedByCode: 'system',
        })
      );

      const payload = mockDataProvider.updateItem.mock.calls[0][2];
      expect(payload.DeletedAt).toBeDefined();
    });
  });

  describe('getAll / query functions', () => {
    it('論理削除（IsDeleted=true）データを除外して結果を返すこと', async () => {
      mockDataProvider.listItems.mockResolvedValue([
        {
          Id: 401,
          UserId: 'user-01',
          IsDeleted: false,
        },
        {
          Id: 402,
          UserId: 'user-02',
          IsDeleted: true, // 論理削除されている
        },
        {
          Id: 403,
          UserId: 'user-03',
          IsDeleted: null, // null/未定義データ互換
        },
      ]);

      const records = await repository.getAll();

      // Ensure OData query contains filter to exclude deleted ones
      const listOptions = mockDataProvider.listItems.mock.calls[0][1];
      expect(listOptions.filter).toContain('IsDeleted ne true');

      // Verify final TypeScript safety filters out isDeleted === true
      expect(records).toHaveLength(2);
      expect(records[0].id).toBe('401');
      expect(records[1].id).toBe('403');
    });

    it('getById で論理削除済みのIDが渡された場合は null を返すこと', async () => {
      mockDataProvider.listItems.mockResolvedValue([
        {
          Id: 505,
          UserId: 'user-01',
          IsDeleted: true,
        },
      ]);

      const record = await repository.getById('505');
      expect(record).toBeNull();
    });
  });
});
