import {
  filterExceptions,
  buildExceptionDisplayRows,
  sortExceptionDisplayRows,
  getExceptionSortDate,
} from '@/features/exceptions/logic/tableLogic';
import { ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';

describe('ExceptionTable Logic (displayRows)', () => {
  const mockItems = [
    {
      id: '1',
      category: 'corrective-action',
      severity: 'high',
      title: 'Action 1',
      description: '',
      targetUserId: '101',
      targetUser: 'User A',
      status: 'pending',
      targetDate: '2026-03-01T10:00:00Z',
    } as unknown as ExceptionItem,
    {
      id: '2',
      category: 'operation-alert',
      severity: 'critical',
      title: 'Alert 1',
      description: '',
      targetUserId: '101',
      targetUser: 'User A',
      status: 'pending',
      updatedAt: '2026-03-02T10:00:00Z',
    } as unknown as ExceptionItem,
    {
      id: '3',
      category: 'compliance-violation',
      severity: 'medium',
      title: 'Violation 1',
      description: '',
      targetUserId: '102',
      targetUser: 'User B',
      status: 'pending',
      targetDate: '2026-05-01T10:00:00Z',
    } as unknown as ExceptionItem,
    // Invalid Date Fallback test data
    {
      id: '4',
      category: 'system-error',
      severity: 'low',
      title: 'System Error',
      description: '',
      status: 'pending',
      targetDate: 'invalid-date-string',
      updatedAt: undefined,
    } as unknown as ExceptionItem,
];

  describe('1. filterExceptions', () => {
    it('categoryFilter と severityFilter が all の場合は全件返すこと', () => {
      const result = filterExceptions(mockItems as ExceptionItem[], 'all', 'all');
      expect(result).toHaveLength(4);
    });

    it('指定したカテゴリと重大度で適切にフィルタされること', () => {
      const catResult = filterExceptions(mockItems as ExceptionItem[], 'corrective-action', 'all');
      expect(catResult).toHaveLength(1);
      expect(catResult[0].id).toBe('1');

      const sevResult = filterExceptions(mockItems as ExceptionItem[], 'all', 'critical');
      expect(sevResult).toHaveLength(1);
      expect(sevResult[0].id).toBe('2');
    });
  });

  describe('2. buildExceptionDisplayRows (モード分岐・代表行選択)', () => {
    it('flat モードの場合、1アイテム1行になり階層化されないこと', () => {
      const result = buildExceptionDisplayRows(mockItems as ExceptionItem[], 'flat');
      expect(result).toHaveLength(4);
      expect(result.every((r) => r.kind === 'item')).toBe(true);
    });

    it('grouped モードの場合、ユーザーごとにグループ化され、代表行の選択ルールが守られていること', () => {
      // User A (101) は id:1 と id:2 を持つ。
      // id:2 (critical, 3/2) と id:1 (high, 3/1) 
      const result = buildExceptionDisplayRows(mockItems as ExceptionItem[], 'grouped');
      
      const userAGroup = result.find((r) => r.kind === 'corrective-group' && r.group.userId === '101');
      expect(userAGroup).toBeDefined();
      if (userAGroup?.kind === 'corrective-group') {
        expect(userAGroup.group.items).toHaveLength(2);
        // 代表行は severity が最も高いものになるはず（ここでは id:2 の critical）
        expect(userAGroup.representative.severity).toBe('critical');
        expect(userAGroup.representative.id).toBe('2');
        // highestSeverity も親グループに伝搬している
        expect(userAGroup.sortSeverity).toBe('critical');
      }

      const userBGroup = result.find((r) => r.kind === 'corrective-group' && r.group.userId === '102');
      expect(userBGroup).toBeDefined();

      const unknownGroup = result.find((r) => r.kind === 'corrective-group' && r.group.userId === '__unknown__');
      expect(unknownGroup).toBeDefined();
    });
  });

  describe('3. sortExceptionDisplayRows (多段ソート連携)', () => {
    it('sortOrder: severity - 重要度順（同レベルなら日付降順）に並ぶこと', () => {
      const rows = buildExceptionDisplayRows(mockItems as ExceptionItem[], 'flat');
      const sorted = sortExceptionDisplayRows(rows, 'severity');

      expect(sorted[0].sortSeverity).toBe('critical'); // id: 2
      expect(sorted[1].sortSeverity).toBe('high');     // id: 1
      expect(sorted[2].sortSeverity).toBe('medium');   // id: 3
    });

    it('sortOrder: newest - 日付降順（同日なら重要度順）に並ぶこと', () => {
      const rows = buildExceptionDisplayRows(mockItems as ExceptionItem[], 'flat');
      const sorted = sortExceptionDisplayRows(rows, 'newest');

      // Date of id:3 is 2026-05-01 (latest)
      // Date of id:2 is 2026-03-02
      // Date of id:1 is 2026-03-01
      // Date of id:4 is invalid (epoch 0)

      expect(sorted[0].sortSeverity).toBe('medium'); // id 3
      expect(sorted[1].sortSeverity).toBe('critical'); // id 2
      expect(sorted[2].sortSeverity).toBe('high'); // id 1
      expect(sorted[3].sortSeverity).toBe('low'); // id 4
    });
  });

  describe('4. getExceptionSortDate (境界条件・エラー耐性)', () => {
    it('不正な日付や未定義の場合、クラッシュせずに要素が 0 扱いとしてフォールバックされること', () => {
      const invalidDateItem = mockItems.find((i) => i.id === '4')! as ExceptionItem;
      const dateVal = getExceptionSortDate(invalidDateItem);
      expect(dateVal).toBe(0); // NaN ではなく 0 に倒れる既存仕様の観測
    });
  });
});
