/**
 * @fileoverview rowInitialization domain 関数の単体テスト
 *
 * Phase 1 Issue #1 + #3: pure function テスト
 * - createEmptyRow (5ケース)
 * - shouldPrefillSpecialNotes (4ケース)
 * - applyHandoffNotesToRows (4ケース)
 * - syncRowsWithSelectedUsers (4ケース)
 * - hasRowContent (4ケース)
 */

import { describe, it, expect } from 'vitest';
import type { UserRowData } from '../../hooks/useTableDailyRecordForm';
import {
  createEmptyRow,
  hasRowContent,
  shouldPrefillSpecialNotes,
  applyHandoffNotesToRows,
  syncRowsWithSelectedUsers,
} from '../rowInitialization';

// ─── helpers ────────────────────────────────────────────

const makeRow = (overrides: Partial<UserRowData> = {}): UserRowData => ({
  userId: 'u1',
  userName: 'テスト太郎',
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

// ─── createEmptyRow ─────────────────────────────────────

describe('createEmptyRow', () => {
  it('オプションなしで全フィールドが空/false', () => {
    const row = createEmptyRow('u1', '太郎');

    expect(row.userId).toBe('u1');
    expect(row.userName).toBe('太郎');
    expect(row.amActivity).toBe('');
    expect(row.pmActivity).toBe('');
    expect(row.lunchAmount).toBe('');
    expect(row.specialNotes).toBe('');
    expect(row.behaviorTags).toEqual([]);
    expect(Object.values(row.problemBehavior).every((v) => v === false)).toBe(true);
  });

  it('lastActivities ありで am/pm がプリフィルされる', () => {
    const row = createEmptyRow('u1', '太郎', {
      lastActivities: { amActivity: '作業A', pmActivity: '作業B' },
    });

    expect(row.amActivity).toBe('作業A');
    expect(row.pmActivity).toBe('作業B');
  });

  it('handoffNote ありで specialNotes に反映される', () => {
    const row = createEmptyRow('u1', '太郎', {
      handoffNote: '要注意：水分補給',
    });

    expect(row.specialNotes).toBe('要注意：水分補給');
  });

  it('lastActivities + handoffNote 両方ありで全て反映される', () => {
    const row = createEmptyRow('u1', '太郎', {
      lastActivities: { amActivity: '作業A', pmActivity: '' },
      handoffNote: '要観察',
    });

    expect(row.amActivity).toBe('作業A');
    expect(row.pmActivity).toBe('');
    expect(row.specialNotes).toBe('要観察');
  });

  it('lastActivities の am のみ空の場合 pm のみプリフィル', () => {
    const row = createEmptyRow('u1', '太郎', {
      lastActivities: { amActivity: '', pmActivity: '午後作業' },
    });

    expect(row.amActivity).toBe('');
    expect(row.pmActivity).toBe('午後作業');
  });
});

// ─── hasRowContent ──────────────────────────────────────

describe('hasRowContent', () => {
  it('全て空なら false', () => {
    expect(hasRowContent(makeRow())).toBe(false);
  });

  it('amActivity に値があれば true', () => {
    expect(hasRowContent(makeRow({ amActivity: '出勤' }))).toBe(true);
  });

  it('behaviorTags に値があれば true', () => {
    expect(hasRowContent(makeRow({ behaviorTags: ['tag1'] }))).toBe(true);
  });

  it('problemBehavior にフラグがあれば true', () => {
    expect(hasRowContent(makeRow({
      problemBehavior: {
        selfHarm: true,
        otherInjury: false,
        loudVoice: false,
        pica: false,
        other: false,
      },
    }))).toBe(true);
  });
});

// ─── shouldPrefillSpecialNotes ──────────────────────────

describe('shouldPrefillSpecialNotes', () => {
  it('(空, あり) → true', () => {
    expect(shouldPrefillSpecialNotes('', '注入テキスト')).toBe(true);
  });

  it('(入力済み, あり) → false', () => {
    expect(shouldPrefillSpecialNotes('手入力済み', '注入テキスト')).toBe(false);
  });

  it('(空, undefined) → false', () => {
    expect(shouldPrefillSpecialNotes('', undefined)).toBe(false);
  });

  it('(空白のみ, あり) → true', () => {
    expect(shouldPrefillSpecialNotes('   ', '注入テキスト')).toBe(true);
  });
});

// ─── applyHandoffNotesToRows ────────────────────────────

describe('applyHandoffNotesToRows', () => {
  it('空 specialNotes に handoff note を注入する', () => {
    const rows = [makeRow({ userId: 'u1', specialNotes: '' })];
    const notes = new Map([['u1', '申し送りメモ']]);

    const result = applyHandoffNotesToRows(rows, notes);

    expect(result.changed).toBe(true);
    expect(result.rows[0].specialNotes).toBe('申し送りメモ');
  });

  it('入力済み specialNotes は上書きされない', () => {
    const rows = [makeRow({ userId: 'u1', specialNotes: '手入力済み' })];
    const notes = new Map([['u1', '申し送りメモ']]);

    const result = applyHandoffNotesToRows(rows, notes);

    expect(result.changed).toBe(false);
    expect(result.rows[0].specialNotes).toBe('手入力済み');
  });

  it('handoff note がないユーザーはそのまま', () => {
    const rows = [makeRow({ userId: 'u1', specialNotes: '' })];
    const notes = new Map([['u2', '別ユーザーのメモ']]);

    const result = applyHandoffNotesToRows(rows, notes);

    expect(result.changed).toBe(false);
    expect(result.rows[0].specialNotes).toBe('');
  });

  it('全て入力済みなら changed = false', () => {
    const rows = [
      makeRow({ userId: 'u1', specialNotes: 'メモ1' }),
      makeRow({ userId: 'u2', userName: '次郎', specialNotes: 'メモ2' }),
    ];
    const notes = new Map([
      ['u1', '申し送り1'],
      ['u2', '申し送り2'],
    ]);

    const result = applyHandoffNotesToRows(rows, notes);

    expect(result.changed).toBe(false);
  });
});

// ─── syncRowsWithSelectedUsers ──────────────────────────

describe('syncRowsWithSelectedUsers', () => {
  it('新規ユーザー追加で createEmptyRow による行が生成される', () => {
    const existingRows: UserRowData[] = [];
    const selectedUsers = [{ userId: 'u1', name: '太郎' }];
    const selectedUserIds = ['u1'];

    const result = syncRowsWithSelectedUsers(
      existingRows,
      selectedUsers,
      selectedUserIds,
    );

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u1');
    expect(result[0].userName).toBe('太郎');
    expect(result[0].amActivity).toBe('');
  });

  it('既存ユーザーの入力済みデータが保持される', () => {
    const existingRows = [makeRow({ userId: 'u1', amActivity: '入力済み' })];
    const selectedUsers = [{ userId: 'u1', name: '太郎' }];
    const selectedUserIds = ['u1'];

    const result = syncRowsWithSelectedUsers(
      existingRows,
      selectedUsers,
      selectedUserIds,
    );

    expect(result).toHaveLength(1);
    expect(result[0].amActivity).toBe('入力済み');
  });

  it('未選択のユーザーの行は除外される', () => {
    const existingRows = [
      makeRow({ userId: 'u1' }),
      makeRow({ userId: 'u2', userName: '次郎' }),
    ];
    const selectedUsers = [{ userId: 'u1', name: '太郎' }];
    const selectedUserIds = ['u1'];

    const result = syncRowsWithSelectedUsers(
      existingRows,
      selectedUsers,
      selectedUserIds,
    );

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u1');
  });

  it('handoff note 付き新規ユーザーで specialNotes にプリフィルされる', () => {
    const existingRows: UserRowData[] = [];
    const selectedUsers = [{ userId: 'u1', name: '太郎' }];
    const selectedUserIds = ['u1'];
    const handoffNotes = new Map([['u1', '要観察']]);

    const result = syncRowsWithSelectedUsers(
      existingRows,
      selectedUsers,
      selectedUserIds,
      handoffNotes,
    );

    expect(result).toHaveLength(1);
    expect(result[0].specialNotes).toBe('要観察');
  });
});
