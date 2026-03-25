import { renderHook } from '@testing-library/react';
import { useChecklistApi } from '@/features/compliance-checklist/api';
import { mapToChecklistItem, ChecklistItemDTO, ChecklistInsertDTO } from '@/features/compliance-checklist/types';
import { useSP } from '@/lib/spClient';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// モック化
vi.mock('@/lib/spClient');

describe('ComplianceChecklist: types & api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- 1. pure functions (mapToChecklistItem) ---
  describe('mapToChecklistItem()', () => {
    it('🟢 正常系: 外部からのDTOが全フィールドを持つ場合、内部の ChecklistItem モデルへ欠損なく変換されること', () => {
      const dto: ChecklistItemDTO = {
        Id: 1,
        Title: 'System Title',
        RuleID: 'RULE-001',
        RuleName: 'テストルール',
        EvaluationLogic: 'A + B > 0',
        ValidFrom: '2026-01-01',
        ValidTo: '2026-12-31',
        SeverityLevel: 'ERROR',
      };

      const result = mapToChecklistItem(dto);
      
      expect(result.id).toBe('RULE-001');
      expect(result.label).toBe('テストルール');
      // マッピングの正常性
      expect(result.value).toBe('A + B > 0');
      expect(result.validFrom).toBe('2026-01-01');
      expect(result.validTo).toBe('2026-12-31');
      expect(result.severityLevel).toBe('ERROR');
    });

    it('🛡️ フォールバック/境界条件: DTO にオプションフィールドが undefined または無い場合、既存実装のルール通り (null等) に固定化されること', () => {
      // 既存の mapToChecklistItem の振る舞いを「理想化せず」観測してそのまま固定する
      const partialDto: ChecklistItemDTO = {
        Id: 2,
        Title: 'System Title 2',
        RuleID: 'RULE-002',
        RuleName: '部分ルール',
        // Optional fields are omitted
      };

      const result = mapToChecklistItem(partialDto);

      expect(result.id).toBe('RULE-002');
      // ValidTo, ValidFrom, EvaluationLogic は undefined ではなく `?? null` で `null` に落ちる（既存仕様）
      expect(result.value).toBeNull();
      expect(result.validFrom).toBeNull();
      expect(result.validTo).toBeNull();
      expect(result.note).toBeNull(); // 常に null になる仕様
      expect(result.required).toBeUndefined(); // 常に undefined になる仕様
      
      // SeverityLevel は `?? null` がなく、そのまま undefined が渡る仕様
      expect(result.severityLevel).toBeUndefined();
    });
  });

  // --- 2. hook (useChecklistApi) ---
  describe('useChecklistApi()', () => {
    it('⚪ 空データ: SharePoint 側の返却が [] (0件) だった場合、例外を起こさずに空配列を返すこと', async () => {
      const getListItemsByTitle = vi.fn().mockResolvedValue([]);
      const addListItemByTitle = vi.fn();
      vi.mocked(useSP).mockReturnValue({ getListItemsByTitle, addListItemByTitle } as any);

      const { result } = renderHook(() => useChecklistApi());

      const data = await result.current.list();
      // パースエラー等にならず空の配列が返る
      expect(data).toEqual([]);
      expect(getListItemsByTitle).toHaveBeenCalledTimes(1);
    });

    it('🟢 正常系: APIから取得したDTO配列が mapToChecklistItem を通って正しく返却されること', async () => {
      const mockDtos: ChecklistItemDTO[] = [
        {
          Id: 1,
          Title: 'Row1',
          RuleID: 'RULE-A',
          RuleName: 'ルールA',
        }
      ];
      const getListItemsByTitle = vi.fn().mockResolvedValue(mockDtos);
      vi.mocked(useSP).mockReturnValue({ getListItemsByTitle } as any);

      const { result } = renderHook(() => useChecklistApi());

      const data = await result.current.list();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('RULE-A');
      // オプショナル部分は純関数のテストで見た通り null にフォールバックされる
      expect(data[0].value).toBeNull();
    });

    it('🟢 正常系: add() を呼んだ際、追加されたDTO結果が内部モデルとして返却されること', async () => {
      const mockResultDto: ChecklistItemDTO = {
        Id: 2,
        Title: 'Added',
        RuleID: 'RULE-NEW',
        RuleName: '新規ルール',
        SeverityLevel: 'INFO',
      };
      
      const addListItemByTitle = vi.fn().mockResolvedValue(mockResultDto);
      vi.mocked(useSP).mockReturnValue({ addListItemByTitle } as any);

      const { result } = renderHook(() => useChecklistApi());

      const insertBody: ChecklistInsertDTO = {
        Title: 'Added',
        RuleID: 'RULE-NEW',
        RuleName: '新規ルール',
      };

      const added = await result.current.add(insertBody);
      expect(addListItemByTitle).toHaveBeenCalledWith(expect.any(String), insertBody);
      expect(added.id).toBe('RULE-NEW');
      expect(added.severityLevel).toBe('INFO');
      expect(added.value).toBeNull();
    });
  });
});
