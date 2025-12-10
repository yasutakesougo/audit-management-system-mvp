/**
 * IntegratedResourceCalendar Business Logic Unit Tests
 *
 * Issue 8-10の中核ロジックの品質を保証するunit tests。
 * モック・スタブを使用してFullCalendar依存を分離。
 */
import type { TestableEvent } from '@/utils/integrated-resource-calendar.utils';
import {
    calculateTotalsByResource,
    checkEventDropAllowed,
    checkSelectAllowed,
    generateWarningEvents,
    type EventDropInfo,
    type ResourceWarning,
} from '@/utils/integrated-resource-calendar.utils';
import { describe, expect, it } from 'vitest';

/**
 * テスト用のTestableEventモックヘルパー
 */
function mockTestableEvent(
  id: string,
  start: string,
  end: string,
  resourceId: string,
  options: {
    actualStart?: string;
    display?: string;
  } = {},
): TestableEvent {
  return {
    id,
    start: new Date(start),
    end: new Date(end),
    display: options.display,
    extendedProps: {
      actualStart: options.actualStart,
      resourceId,
    },
    getResources: () => [{ id: resourceId }],
  };
}

/**
 * テスト用EventDropInfoモックヘルパー
 */
function mockDropInfo(
  start: string,
  end: string,
  resourceId?: string,
): EventDropInfo {
  return {
    start: new Date(start),
    end: new Date(end),
    resourceId,
  };
}

describe('IntegratedResourceCalendar Utils', () => {
  describe('checkEventDropAllowed - Issue 8: ダブルブッキング防止', () => {
    it('実績(actualStart)付きイベントのドラッグを禁止する', () => {
      const draggedEvent = mockTestableEvent(
        'e1',
        '2025-11-20T09:00:00',
        '2025-11-20T10:00:00',
        'staff-1',
        { actualStart: '2025-11-20T09:05:00' },
      );

      const dropInfo = mockDropInfo(
        '2025-11-20T10:00:00',
        '2025-11-20T11:00:00',
        'staff-1',
      );

      const result = checkEventDropAllowed(draggedEvent, dropInfo, []);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('実績が登録されている予定は編集できません。');
    });

    it('同一リソースで時間が重なるドラッグを禁止する', () => {
      const existingEvent = mockTestableEvent(
        'base',
        '2025-11-20T09:00:00',
        '2025-11-20T10:00:00',
        'staff-1',
      );

      const draggedEvent = mockTestableEvent(
        'new',
        '2025-11-20T08:00:00',
        '2025-11-20T09:00:00',
        'staff-2',
      );

      const dropInfo = mockDropInfo(
        '2025-11-20T09:30:00', // 既存イベントと重複
        '2025-11-20T10:30:00',
        'staff-1',
      );

      const result = checkEventDropAllowed(draggedEvent, dropInfo, [
        existingEvent,
      ]);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe(
        '同じスタッフの同じ時間帯に重複する予定は登録できません。',
      );
    });

    it('別リソースなら同じ時間帯でも許可する', () => {
      const existingEvent = mockTestableEvent(
        'base',
        '2025-11-20T09:00:00',
        '2025-11-20T10:00:00',
        'staff-1',
      );

      const draggedEvent = mockTestableEvent(
        'new',
        '2025-11-20T08:00:00',
        '2025-11-20T09:00:00',
        'staff-2',
      );

      const dropInfo = mockDropInfo(
        '2025-11-20T09:30:00', // 同じ時間帯だが
        '2025-11-20T10:30:00',
        'staff-2', // 別リソース
      );

      const result = checkEventDropAllowed(draggedEvent, dropInfo, [
        existingEvent,
      ]);

      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('背景イベント（警告用）は重複チェックから除外する', () => {
      const warningEvent = mockTestableEvent(
        'warning',
        '2025-11-20T09:00:00',
        '2025-11-20T18:00:00',
        'staff-1',
        { display: 'background' },
      );

      const draggedEvent = mockTestableEvent(
        'new',
        '2025-11-20T08:00:00',
        '2025-11-20T09:00:00',
        'staff-2',
      );

      const dropInfo = mockDropInfo(
        '2025-11-20T09:30:00', // 背景イベントと重複するが
        '2025-11-20T10:30:00',
        'staff-1',
      );

      const result = checkEventDropAllowed(draggedEvent, dropInfo, [
        warningEvent,
      ]);

      expect(result.allowed).toBe(true); // 背景イベントは無視される
    });

    it('リソースIDが特定できない場合はエラー', () => {
      const draggedEvent = mockTestableEvent(
        'e1',
        '2025-11-20T09:00:00',
        '2025-11-20T10:00:00',
        'staff-1',
      );

      const dropInfo = mockDropInfo(
        '2025-11-20T10:00:00',
        '2025-11-20T11:00:00',
        // resourceId なし
      );

      // getResources() が空を返すケースをモック
      draggedEvent.getResources = () => [];
      draggedEvent.extendedProps.resourceId = undefined;

      const result = checkEventDropAllowed(draggedEvent, dropInfo, []);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe(
        'リソースが特定できない場所には予定を移動できません。',
      );
    });
  });

  describe('checkSelectAllowed - Issue 8: 新規選択範囲検証', () => {
    it('既存イベントと重複する時間範囲の選択を禁止', () => {
      const existingEvent = mockTestableEvent(
        'existing',
        '2025-11-20T09:00:00',
        '2025-11-20T10:00:00',
        'staff-1',
      );

      const selectInfo = mockDropInfo(
        '2025-11-20T09:30:00', // 重複
        '2025-11-20T10:30:00',
        'staff-1',
      );

      const result = checkSelectAllowed(selectInfo, [existingEvent]);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe(
        'すでに予定が入っている時間帯には新しい予定を作成できません。',
      );
    });

    it('リソースIDがない選択範囲を禁止', () => {
      const selectInfo = mockDropInfo(
        '2025-11-20T09:00:00',
        '2025-11-20T10:00:00',
        // resourceId なし
      );

      const result = checkSelectAllowed(selectInfo, []);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('リソース行上でのみ予定を作成できます。');
    });

    it('重複のない時間範囲は許可', () => {
      const existingEvent = mockTestableEvent(
        'existing',
        '2025-11-20T09:00:00',
        '2025-11-20T10:00:00',
        'staff-1',
      );

      const selectInfo = mockDropInfo(
        '2025-11-20T11:00:00', // 重複なし
        '2025-11-20T12:00:00',
        'staff-1',
      );

      const result = checkSelectAllowed(selectInfo, [existingEvent]);

      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });

  describe('calculateTotalsByResource - Issue 10: リソース集計', () => {
    it('リソース毎に総時間を集計し、8時間超過にフラグを立てる', () => {
      const events = [
        // staff-1: 4h + 5h = 9h (over)
        mockTestableEvent(
          'e1',
          '2025-11-20T09:00:00',
          '2025-11-20T13:00:00',
          'staff-1',
        ), // 4h
        mockTestableEvent(
          'e2',
          '2025-11-20T14:00:00',
          '2025-11-20T19:00:00',
          'staff-1',
        ), // 5h
        // staff-2: 2h (not over)
        mockTestableEvent(
          'e3',
          '2025-11-20T09:00:00',
          '2025-11-20T11:00:00',
          'staff-2',
        ), // 2h
      ];

      const result = calculateTotalsByResource(events);

      expect(result['staff-1']).toEqual({
        totalHours: 9.0, // 4 + 5
        isOver: true, // > 8
      });
      expect(result['staff-2']).toEqual({
        totalHours: 2.0,
        isOver: false, // <= 8
      });
    });

    it('backgroundイベントは集計対象から除外する', () => {
      const events = [
        mockTestableEvent(
          'warn1',
          '2025-11-20T09:00:00',
          '2025-11-20T18:00:00',
          'staff-1',
          { display: 'background' },
        ), // 9h だが背景なので除外
        mockTestableEvent(
          'normal',
          '2025-11-20T10:00:00',
          '2025-11-20T11:00:00',
          'staff-1',
        ), // 1h
      ];

      const result = calculateTotalsByResource(events);

      expect(result['staff-1']).toEqual({
        totalHours: 1.0, // 背景イベントは除外
        isOver: false,
      });
    });

    it('労働時間上限をカスタマイズ可能', () => {
      const events = [
        mockTestableEvent(
          'e1',
          '2025-11-20T09:00:00',
          '2025-11-20T15:00:00',
          'staff-1',
        ), // 6h
      ];

      // 4時間上限で設定
      const result = calculateTotalsByResource(events, 4);

      expect(result['staff-1']).toEqual({
        totalHours: 6.0,
        isOver: true, // > 4
      });
    });

    it('start/endがnullのイベントは無視する', () => {
      const validEvent = mockTestableEvent(
        'valid',
        '2025-11-20T09:00:00',
        '2025-11-20T10:00:00',
        'staff-1',
      );

      const invalidEvent: TestableEvent = {
        id: 'invalid',
        start: null, // null
        end: null,   // null
        extendedProps: { resourceId: 'staff-1' },
        getResources: () => [{ id: 'staff-1' }],
      };

      const result = calculateTotalsByResource([validEvent, invalidEvent]);

      expect(result['staff-1']).toEqual({
        totalHours: 1.0, // 有効なイベント1hのみ
        isOver: false,
      });
    });
  });

  describe('generateWarningEvents - Issue 9: 背景警告生成', () => {
    it('過負荷リソースの警告イベントを生成する', () => {
      const warnings: Record<string, ResourceWarning> = {
        'staff-1': { totalHours: 9.5, isOver: true },
        'staff-2': { totalHours: 6.0, isOver: false }, // 警告なし
        'staff-3': { totalHours: 12.0, isOver: true },
      };

      const startDate = new Date('2025-11-20T00:00:00');
      const endDate = new Date('2025-11-20T23:59:59');

      const result = generateWarningEvents(warnings, startDate, endDate);

      expect(result).toHaveLength(2); // staff-1, staff-3のみ

      const staff1Warning = result.find((e) => e.resourceId === 'staff-1');
      expect(staff1Warning).toBeDefined();
      expect(staff1Warning?.title).toBe('⚠️ 過負荷警告 (9.5h)');
      expect(staff1Warning?.display).toBe('background');
      expect(staff1Warning?.backgroundColor).toBe('rgba(255, 0, 0, 0.15)');

      const staff3Warning = result.find((e) => e.resourceId === 'staff-3');
      expect(staff3Warning).toBeDefined();
      expect(staff3Warning?.title).toBe('⚠️ 過負荷警告 (12h)');
    });

    it('警告対象がない場合は空配列を返す', () => {
      const warnings: Record<string, ResourceWarning> = {
        'staff-1': { totalHours: 6.0, isOver: false },
        'staff-2': { totalHours: 7.5, isOver: false },
      };

      const startDate = new Date('2025-11-20T00:00:00');
      const endDate = new Date('2025-11-20T23:59:59');

      const result = generateWarningEvents(warnings, startDate, endDate);

      expect(result).toHaveLength(0);
    });
  });
});