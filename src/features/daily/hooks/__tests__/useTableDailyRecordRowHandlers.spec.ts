/**
 * @fileoverview useTableDailyRecordRowHandlers の振る舞いテスト
 *
 * Phase 1 Issue #4 — Layer 2: hook テスト
 *
 * ビジネスルール（createEmptyRow, syncRows, applyHandoff）は
 * domain/__tests__/rowInitialization.spec.ts で検証済み。
 *
 * このテストでは「effect → state 接続」と「handler → state 更新」のみ検証する。
 *
 * 設計上の注意:
 * - hook 内の行同期 useEffect は selectedUsers/selectedUserIds に基づいて
 *   userRows を再構成する。テストで初期行を保持するには、
 *   selectedUsers と selectedUserIds に対応する値を渡す必要がある。
 */

import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { StoreUser } from '@/features/users/store';
import type { TableDailyRecordData, UserRowData } from '../view-models/useTableDailyRecordForm';
import type { UseTableDailyRecordRowHandlersParams } from '../orchestrators/useTableDailyRecordRowHandlers';
import { useTableDailyRecordRowHandlers } from '../orchestrators/useTableDailyRecordRowHandlers';

// ── Mock: getLastActivitiesForUser ─────────────────────

vi.mock('../legacy/useLastActivities', () => ({
  getLastActivitiesForUser: vi.fn(() => null),
  saveLastActivities: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────

const createUser = (id: string, name: string): StoreUser => ({
  Id: Number.parseInt(id.replace(/\D/g, ''), 10) || 0,
  UserID: id,
  FullName: name,
  AttendanceDays: [],
  TransportToDays: [],
  TransportFromDays: [],
  lifecycleStatus: 'active',
});

const USERS: StoreUser[] = [
  createUser('u1', '田中太郎'),
  createUser('u2', '佐藤花子'),
  createUser('u3', '山田一郎'),
];

const makeRow = (overrides: Partial<UserRowData> = {}): UserRowData => ({
  userId: 'u1',
  userName: '田中太郎',
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
  ...overrides,
});

const makeInitialFormData = (userRows: UserRowData[] = []): TableDailyRecordData => ({
  date: '2026-03-15',
  reporter: { name: '記録者A', role: '生活支援員' },
  userRows,
  userCount: userRows.length,
});

/**
 * useRef + useState でパラメータを安定化しつつ、
 * formData は実際の state として持つラッパーフック。
 *
 * 注意: 行同期 useEffect が selectedUsers/selectedUserIds で userRows を
 * 再構成するため、initialRows を保持したい場合は必ず対応する
 * selectedUsers + selectedUserIds を渡すこと。
 */
function useRowHandlersTestWrapper(
  initialFormData: TableDailyRecordData,
  overrides: Partial<Omit<UseTableDailyRecordRowHandlersParams, 'setFormData' | 'formData'>> = {},
) {
  const [formData, setFormData] = useState<TableDailyRecordData>(initialFormData);

  const paramsRef = useRef({
    selectedUsers: overrides.selectedUsers ?? [],
    selectedUserIds: overrides.selectedUserIds ?? [],
    showUnsentOnly: overrides.showUnsentOnly ?? false,
    handoffNotesByUser: overrides.handoffNotesByUser,
  });

  const result = useTableDailyRecordRowHandlers({
    setFormData,
    formData,
    selectedUsers: paramsRef.current.selectedUsers,
    selectedUserIds: paramsRef.current.selectedUserIds,
    showUnsentOnly: paramsRef.current.showUnsentOnly,
    handoffNotesByUser: paramsRef.current.handoffNotesByUser,
  });

  return { ...result, formData, setFormData };
}

// ── Tests ───────────────────────────────────────────────

describe('useTableDailyRecordRowHandlers', () => {
  describe('行の同期 (useEffect → setFormData)', () => {
    it('selectedUsers 指定時に formData.userRows が生成される', () => {
      const { result } = renderHook(() =>
        useRowHandlersTestWrapper(
          makeInitialFormData(),
          {
            selectedUsers: [USERS[0], USERS[1]],
            selectedUserIds: ['u1', 'u2'],
          },
        ),
      );

      expect(result.current.formData.userRows).toHaveLength(2);
      expect(result.current.formData.userRows[0].userId).toBe('u1');
      expect(result.current.formData.userRows[1].userId).toBe('u2');
    });

    it('handoffNotesByUser ありで空 specialNotes が埋まる', () => {
      const handoffNotes = new Map([['u1', '要注意：水分']]);

      const { result } = renderHook(() =>
        useRowHandlersTestWrapper(
          makeInitialFormData(),
          {
            selectedUsers: [USERS[0]],
            selectedUserIds: ['u1'],
            handoffNotesByUser: handoffNotes,
          },
        ),
      );

      expect(result.current.formData.userRows).toHaveLength(1);
      expect(result.current.formData.userRows[0].specialNotes).toBe('要注意：水分');
    });
  });

  describe('handleRowDataChange', () => {
    it('指定 userId の field を正しく書き換える', () => {
      // 行同期 useEffect が行を保持するように selectedUsers を渡す
      const initialRows = [makeRow({ userId: 'u1' }), makeRow({ userId: 'u2', userName: '佐藤花子' })];

      const { result } = renderHook(() =>
        useRowHandlersTestWrapper(
          makeInitialFormData(initialRows),
          {
            selectedUsers: [USERS[0], USERS[1]],
            selectedUserIds: ['u1', 'u2'],
          },
        ),
      );

      act(() => {
        result.current.handleRowDataChange('u1', 'amActivity', '出勤');
      });

      expect(result.current.formData.userRows[0].amActivity).toBe('出勤');
      // 他の行は影響しない
      expect(result.current.formData.userRows[1].amActivity).toBe('');
    });
  });

  describe('handleProblemBehaviorChange', () => {
    it('指定行の behaviorType を更新する', () => {
      const initialRows = [makeRow({ userId: 'u1' })];

      const { result } = renderHook(() =>
        useRowHandlersTestWrapper(
          makeInitialFormData(initialRows),
          {
            selectedUsers: [USERS[0]],
            selectedUserIds: ['u1'],
          },
        ),
      );

      act(() => {
        result.current.handleProblemBehaviorChange('u1', 'selfHarm', true);
      });

      expect(result.current.formData.userRows[0].problemBehavior.selfHarm).toBe(true);
      expect(result.current.formData.userRows[0].problemBehavior.loudVoice).toBe(false);
    });
  });

  describe('handleBehaviorTagToggle', () => {
    it('タグが追加/削除される (toggle 動作)', () => {
      const initialRows = [makeRow({ userId: 'u1' })];

      const { result } = renderHook(() =>
        useRowHandlersTestWrapper(
          makeInitialFormData(initialRows),
          {
            selectedUsers: [USERS[0]],
            selectedUserIds: ['u1'],
          },
        ),
      );

      // 追加
      act(() => {
        result.current.handleBehaviorTagToggle('u1', 'tag-a');
      });
      expect(result.current.formData.userRows[0].behaviorTags).toEqual(['tag-a']);

      // もう一度で削除
      act(() => {
        result.current.handleBehaviorTagToggle('u1', 'tag-a');
      });
      expect(result.current.formData.userRows[0].behaviorTags).toEqual([]);
    });
  });

  describe('handleClearRow', () => {
    it('全フィールドがリセットされる', () => {
      const initialRows = [
        makeRow({
          userId: 'u1',
          amActivity: '作業A',
          pmActivity: '作業B',
          lunchAmount: 'full',
          specialNotes: 'メモ',
          behaviorTags: ['tag1'],
          problemBehavior: {
            selfHarm: true,
            otherInjury: false,
            loudVoice: true,
            pica: false,
            other: false,
          },
        }),
      ];

      const { result } = renderHook(() =>
        useRowHandlersTestWrapper(
          makeInitialFormData(initialRows),
          {
            selectedUsers: [USERS[0]],
            selectedUserIds: ['u1'],
          },
        ),
      );

      act(() => {
        result.current.handleClearRow('u1');
      });

      const row = result.current.formData.userRows[0];
      expect(row.amActivity).toBe('');
      expect(row.pmActivity).toBe('');
      expect(row.lunchAmount).toBe('');
      expect(row.specialNotes).toBe('');
      expect(row.behaviorTags).toEqual([]);
      expect(Object.values(row.problemBehavior).every((v) => v === false)).toBe(true);
    });
  });

  describe('visibleRows', () => {
    it('showUnsentOnly=false で全行を返す', () => {
      const initialRows = [
        makeRow({ userId: 'u1' }),
        makeRow({ userId: 'u2', userName: '佐藤花子', amActivity: '作業' }),
      ];

      const { result } = renderHook(() =>
        useRowHandlersTestWrapper(
          makeInitialFormData(initialRows),
          {
            showUnsentOnly: false,
            selectedUsers: [USERS[0], USERS[1]],
            selectedUserIds: ['u1', 'u2'],
          },
        ),
      );

      expect(result.current.visibleRows).toHaveLength(2);
    });

    it('showUnsentOnly=true で内容あり行のみ返す', () => {
      const initialRows = [
        makeRow({ userId: 'u1' }), // 空行
        makeRow({ userId: 'u2', userName: '佐藤花子', amActivity: '作業' }), // 入力あり
      ];

      const { result } = renderHook(() =>
        useRowHandlersTestWrapper(
          makeInitialFormData(initialRows),
          {
            showUnsentOnly: true,
            selectedUsers: [USERS[0], USERS[1]],
            selectedUserIds: ['u1', 'u2'],
          },
        ),
      );

      expect(result.current.visibleRows).toHaveLength(1);
      expect(result.current.visibleRows[0].userId).toBe('u2');
    });
  });

  describe('unsentRowCount', () => {
    it('内容ありの行数を返す', () => {
      const initialRows = [
        makeRow({ userId: 'u1', amActivity: '作業A' }),
        makeRow({ userId: 'u2', userName: '佐藤花子' }), // 空
        makeRow({ userId: 'u3', userName: '山田一郎', specialNotes: 'メモ' }),
      ];

      const { result } = renderHook(() =>
        useRowHandlersTestWrapper(
          makeInitialFormData(initialRows),
          {
            selectedUsers: USERS,
            selectedUserIds: ['u1', 'u2', 'u3'],
          },
        ),
      );

      expect(result.current.unsentRowCount).toBe(2);
    });

    it('全行が空なら selectedUserIds の件数を返す', () => {
      const initialRows = [
        makeRow({ userId: 'u1' }),
        makeRow({ userId: 'u2', userName: '佐藤花子' }),
      ];

      const { result } = renderHook(() =>
        useRowHandlersTestWrapper(
          makeInitialFormData(initialRows),
          {
            selectedUsers: [USERS[0], USERS[1]],
            selectedUserIds: ['u1', 'u2'],
          },
        ),
      );

      expect(result.current.unsentRowCount).toBe(2);
    });
  });
});
