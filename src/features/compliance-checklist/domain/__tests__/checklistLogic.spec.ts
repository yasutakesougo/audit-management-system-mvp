import { describe, expect, it } from 'vitest';
import type { ChecklistInsertDTO, ChecklistItem, ChecklistItemDTO } from '../../types';
import {
  filterChecklistItems,
  isValidChecklistInsert,
  mapToChecklistItem,
  sortChecklistItems,
} from '../checklistLogic';

describe('checklistLogic', () => {
  // ─── filterChecklistItems ─────────────────────────────────
  describe('filterChecklistItems', () => {
    const items: ChecklistItem[] = [
      { id: 'R001', label: 'ルール1', value: 'eval1' },
      { id: 'R002', label: 'ルール2', value: 'eval2' },
    ];

    it('ruleIdFilter が空の場合は全件返すこと', () => {
      expect(filterChecklistItems(items)).toHaveLength(2);
      expect(filterChecklistItems(items, '')).toHaveLength(2);
      expect(filterChecklistItems(items, '   ')).toHaveLength(2);
      expect(filterChecklistItems(items, null)).toHaveLength(2);
    });

    it('ruleIdFilter (id) が一致するものだけを返すこと (既存 value 比較のバグ修正)', () => {
      // 以前は items[0].value と 'R001' を比較するバグがあった
      const result = filterChecklistItems(items, 'R001');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('R001');
    });

    it('一致する ruleId がない場合は空配列を返すこと', () => {
      const result = filterChecklistItems(items, 'R999');
      expect(result).toHaveLength(0);
    });
  });

  // ─── isValidChecklistInsert ───────────────────────────────
  describe('isValidChecklistInsert', () => {
    it('必須項目がすべて埋まっていれば true となること', () => {
      const form: ChecklistInsertDTO = {
        Title: 'タイトル',
        RuleID: 'R001',
        RuleName: 'テストルール',
        SeverityLevel: 'INFO',
      };
      expect(isValidChecklistInsert(form)).toBe(true);
    });

    it('必須項目のいずれかが欠損している場合は false となること', () => {
      expect(isValidChecklistInsert({ RuleID: 'R001', RuleName: '名前' })).toBe(false); // Title missing
      expect(isValidChecklistInsert({ Title: 'T', RuleName: 'N' })).toBe(false); // RuleID missing
      expect(isValidChecklistInsert({ Title: 'T', RuleID: 'R' })).toBe(false); // RuleName missing
    });

    it('空白スペースのみの入力は欠損扱い (false) となること', () => {
      const form: ChecklistInsertDTO = {
        Title: '   ',
        RuleID: 'R001',
        RuleName: '　', // 全角スペース
        SeverityLevel: 'INFO',
      };
      expect(isValidChecklistInsert(form)).toBe(false);
    });
  });

  // ─── mapToChecklistItem ───────────────────────────────────
  describe('mapToChecklistItem', () => {
    it('すべての必須フィールドが正確にマッピングされること', () => {
      const dto: ChecklistItemDTO = {
        Id: 1,
        Title: 'タイトル',
        RuleID: 'R100',
        RuleName: '名前100',
        EvaluationLogic: 'Logic',
        ValidFrom: '2026-03-01',
        ValidTo: '2026-03-31',
        SeverityLevel: 'WARN',
      };
      const result = mapToChecklistItem(dto);
      expect(result.id).toBe('R100');
      expect(result.label).toBe('名前100');
      expect(result.value).toBe('Logic');
      expect(result.severityLevel).toBe('WARN');
      expect(result.validFrom).toBe('2026-03-01');
      expect(result.validTo).toBe('2026-03-31');
    });

    it('nullableな値が undefined/null でも安全に null としてフォールバックされること', () => {
      const dto: ChecklistItemDTO = {
        Id: 2,
        Title: 'タイトル',
        RuleID: 'R200',
        RuleName: '名前200',
      };
      const result = mapToChecklistItem(dto);
      expect(result.value).toBeNull();
      expect(result.validFrom).toBeNull();
      expect(result.validTo).toBeNull();
      expect(result.note).toBeNull();
      expect(result.severityLevel).toBeUndefined();
    });
  });

  // ─── sortChecklistItems ───────────────────────────────────
  describe('sortChecklistItems', () => {
    it('既存の配列の順序をそのまま維持（観測固定）すること', () => {
      const items: ChecklistItem[] = [
        { id: '1', label: '1' },
        { id: '2', label: '2' },
      ];
      const result = sortChecklistItems(items);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(result).not.toBe(items); // 参照は別
    });
  });
});
