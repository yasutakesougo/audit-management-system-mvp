import { describe, it, expect } from 'vitest';
import { validateTimeOverlap, TimeRange } from '../validateTimeOverlap';

describe('validateTimeOverlap', () => {
  const existing: TimeRange[] = [
    { id: 1, startTime: '10:00', endTime: '11:00' },
    { id: 2, startTime: '13:00', endTime: '15:00' }
  ];

  describe('重複の基本パターン', () => {
    it('重複がない場合は hasOverlap = false を返す（隙間時間）', () => {
      const target = { startTime: '11:30', endTime: '12:30' };
      const res = validateTimeOverlap(target, existing);
      expect(res.hasOverlap).toBe(false);
      expect(res.overlappingRecords).toHaveLength(0);
    });

    it('端点が一致するケースは重複とみなさない', () => {
      const targetBefore = { startTime: '09:00', endTime: '10:00' }; // 10:00 接点
      const targetAfter = { startTime: '11:00', endTime: '12:00' };  // 11:00 接点

      expect(validateTimeOverlap(targetBefore, existing).hasOverlap).toBe(false);
      expect(validateTimeOverlap(targetAfter, existing).hasOverlap).toBe(false);
    });

    it('一部が重複するケース（ターゲットの後半が既存と被る）', () => {
      const target = { startTime: '09:30', endTime: '10:30' };
      const res = validateTimeOverlap(target, existing);
      expect(res.hasOverlap).toBe(true);
      expect(res.overlappingRecords).toHaveLength(1);
      expect(res.overlappingRecords[0].id).toBe(1);
    });

    it('完全に包含されるケース（既存の中にすっぽり）', () => {
      const target = { startTime: '13:30', endTime: '14:30' };
      const res = validateTimeOverlap(target, existing);
      expect(res.hasOverlap).toBe(true);
      expect(res.overlappingRecords[0].id).toBe(2);
    });

    it('完全に包含するケース（ターゲットが既存を包む）', () => {
      const target = { startTime: '09:00', endTime: '12:00' };
      const res = validateTimeOverlap(target, existing);
      expect(res.hasOverlap).toBe(true);
      expect(res.overlappingRecords[0].id).toBe(1);
    });
  });

  describe('オプショナルな機能・エッジケース', () => {
    it('自分自身のIDを excludeSelfId に指定した場合は無視する（更新時）', () => {
      const target = { id: 1, startTime: '10:00', endTime: '11:00' };
      const res = validateTimeOverlap(target, existing, { excludeSelfId: 1 });
      expect(res.hasOverlap).toBe(false);
    });

    it('入力がnullや空文字の場合は重複なしとする（検証不能）', () => {
      expect(validateTimeOverlap({ startTime: null, endTime: '10:00' }, existing).hasOverlap).toBe(false);
      expect(validateTimeOverlap({ startTime: '10:00', endTime: '' }, existing).hasOverlap).toBe(false);
    });

    it('開始>=終了の場合は不正データなので重複判定をしない', () => {
      // 10:00 - 10:00 (0分)
      const target = { startTime: '10:00', endTime: '10:00' };
      expect(validateTimeOverlap(target, existing).hasOverlap).toBe(false);
    });

    it('既存データが不正（開始>=終了・値がないなど）な場合、そのレコードとの重複判定はスキップする', () => {
      const badExisting: TimeRange[] = [
        { id: 3, startTime: '14:00', endTime: '14:00' },
        { id: 4, startTime: '15:00', endTime: null as any },
      ];
      const target = { startTime: '13:00', endTime: '16:00' };
      
      expect(validateTimeOverlap(target, badExisting).hasOverlap).toBe(false);
    });
  });
});
