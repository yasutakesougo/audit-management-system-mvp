import { describe, expect, it } from 'vitest';

import type { HandoffRecord } from '../handoffTypes';
import { groupHandoffsByUser } from './groupHandoffsByUser';

// ────────────────────────────────────────────────────────────
// テストヘルパー
// ────────────────────────────────────────────────────────────

let _nextId = 1;
function makeRecord(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    id: _nextId++,
    title: 'テスト申し送り',
    message: 'テストメッセージ',
    userCode: 'U001',
    userDisplayName: 'テスト太郎',
    category: '体調',
    severity: '通常',
    status: '未対応',
    timeBand: '朝',
    createdAt: '2026-03-11T10:00:00+09:00',
    createdByName: '記録者',
    isDraft: false,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// テスト
// ────────────────────────────────────────────────────────────

describe('groupHandoffsByUser', () => {
  beforeEach(() => { _nextId = 1; });

  it('空配列に対して空配列を返す', () => {
    expect(groupHandoffsByUser([])).toEqual([]);
  });

  it('レコードを利用者ごとにグループ化する', () => {
    const records = [
      makeRecord({ userCode: 'U001', userDisplayName: 'Aさん' }),
      makeRecord({ userCode: 'U002', userDisplayName: 'Bさん' }),
      makeRecord({ userCode: 'U001', userDisplayName: 'Aさん' }),
    ];

    const result = groupHandoffsByUser(records);
    expect(result).toHaveLength(2);

    const userA = result.find((g) => g.userId === 'U001');
    const userB = result.find((g) => g.userId === 'U002');
    expect(userA?.totalCount).toBe(2);
    expect(userB?.totalCount).toBe(1);
  });

  it('各グループの最新メッセージ・投稿者・時刻が正しい', () => {
    const records = [
      makeRecord({
        userCode: 'U001',
        userDisplayName: 'Aさん',
        message: '古いメッセージ',
        createdAt: '2026-03-11T08:00:00+09:00',
        createdByName: '田中',
      }),
      makeRecord({
        userCode: 'U001',
        userDisplayName: 'Aさん',
        message: '最新メッセージ',
        createdAt: '2026-03-11T14:00:00+09:00',
        createdByName: '佐藤',
      }),
    ];

    const result = groupHandoffsByUser(records);
    expect(result).toHaveLength(1);
    expect(result[0].latestMessage).toBe('最新メッセージ');
    expect(result[0].latestAuthorName).toBe('佐藤');
    expect(result[0].latestAt).toBe('2026-03-11T14:00:00+09:00');
  });

  it('totalCount が正しい', () => {
    const records = [
      makeRecord({ userCode: 'U001' }),
      makeRecord({ userCode: 'U001' }),
      makeRecord({ userCode: 'U001' }),
      makeRecord({ userCode: 'U002' }),
    ];

    const result = groupHandoffsByUser(records);
    const u1 = result.find((g) => g.userId === 'U001');
    const u2 = result.find((g) => g.userId === 'U002');
    expect(u1?.totalCount).toBe(3);
    expect(u2?.totalCount).toBe(1);
  });

  it('重要グループが要注意グループより先にソートされる', () => {
    const records = [
      makeRecord({
        userCode: 'U_NORMAL',
        userDisplayName: '通常さん',
        severity: '通常',
        createdAt: '2026-03-11T15:00:00+09:00',
      }),
      makeRecord({
        userCode: 'U_IMPORTANT',
        userDisplayName: '重要さん',
        severity: '重要',
        createdAt: '2026-03-11T10:00:00+09:00',
      }),
      makeRecord({
        userCode: 'U_CAUTION',
        userDisplayName: '要注意さん',
        severity: '要注意',
        createdAt: '2026-03-11T12:00:00+09:00',
      }),
    ];

    const result = groupHandoffsByUser(records);
    expect(result[0].userId).toBe('U_IMPORTANT');
    expect(result[1].userId).toBe('U_CAUTION');
    expect(result[2].userId).toBe('U_NORMAL');
  });

  it('要注意グループが通常グループより先にソートされる', () => {
    const records = [
      makeRecord({
        userCode: 'U_NORMAL',
        severity: '通常',
        createdAt: '2026-03-11T15:00:00+09:00',
      }),
      makeRecord({
        userCode: 'U_CAUTION',
        severity: '要注意',
        createdAt: '2026-03-11T08:00:00+09:00',
      }),
    ];

    const result = groupHandoffsByUser(records);
    expect(result[0].userId).toBe('U_CAUTION');
    expect(result[1].userId).toBe('U_NORMAL');
  });

  it('同一重要度では最新投稿がある利用者が先にソートされる', () => {
    const records = [
      makeRecord({
        userCode: 'U_OLD',
        userDisplayName: '古い方',
        severity: '通常',
        createdAt: '2026-03-11T08:00:00+09:00',
      }),
      makeRecord({
        userCode: 'U_NEW',
        userDisplayName: '新しい方',
        severity: '通常',
        createdAt: '2026-03-11T15:00:00+09:00',
      }),
    ];

    const result = groupHandoffsByUser(records);
    expect(result[0].userId).toBe('U_NEW');
    expect(result[1].userId).toBe('U_OLD');
  });

  it('メタデータ欠損時に安定したフォールバックを返す', () => {
    const records = [
      makeRecord({
        userCode: '',
        userDisplayName: '',
        createdByName: '',
      }),
    ];

    const result = groupHandoffsByUser(records);
    expect(result).toHaveLength(1);
    // userCode が空 → __unknown__ にフォールバック
    expect(result[0].userId).toBe('__unknown__');
    // userDisplayName が空 → userId がフォールバック
    expect(result[0].userName).toBe('__unknown__');
    // createdByName が空 → '不明' にフォールバック
    expect(result[0].latestAuthorName).toBe('不明');
  });

  it('グループ内 records は最新順で並ぶ', () => {
    const records = [
      makeRecord({ userCode: 'U001', createdAt: '2026-03-11T09:00:00+09:00', message: '2番目' }),
      makeRecord({ userCode: 'U001', createdAt: '2026-03-11T14:00:00+09:00', message: '最新' }),
      makeRecord({ userCode: 'U001', createdAt: '2026-03-11T07:00:00+09:00', message: '最古' }),
    ];

    const result = groupHandoffsByUser(records);
    expect(result[0].records[0].message).toBe('最新');
    expect(result[0].records[1].message).toBe('2番目');
    expect(result[0].records[2].message).toBe('最古');
  });

  it('hasImportant / hasCaution が正しく判定される', () => {
    const records = [
      makeRecord({ userCode: 'U001', severity: '通常' }),
      makeRecord({ userCode: 'U001', severity: '重要' }),
    ];

    const result = groupHandoffsByUser(records);
    expect(result[0].hasImportant).toBe(true);
    expect(result[0].hasCaution).toBe(false);
    expect(result[0].highestSeverity).toBe('重要');
  });

  it('混合 severity がある場合の highestSeverity が正しい', () => {
    const records = [
      makeRecord({ userCode: 'U001', severity: '要注意' }),
      makeRecord({ userCode: 'U001', severity: '通常' }),
    ];

    const result = groupHandoffsByUser(records);
    expect(result[0].highestSeverity).toBe('要注意');
    expect(result[0].hasImportant).toBe(false);
    expect(result[0].hasCaution).toBe(true);
  });

  it('重要レコードがあるグループが最新投稿で負けていても先にソートされる', () => {
    // U_NORMAL は最新投稿が新しいが severity は通常
    // U_IMPORTANT は最新投稿が古いが severity は重要
    const records = [
      makeRecord({
        userCode: 'U_NORMAL',
        severity: '通常',
        createdAt: '2026-03-11T16:00:00+09:00', // 最新
      }),
      makeRecord({
        userCode: 'U_IMPORTANT',
        severity: '重要',
        createdAt: '2026-03-11T08:00:00+09:00', // 古い
      }),
    ];

    const result = groupHandoffsByUser(records);
    expect(result[0].userId).toBe('U_IMPORTANT');
  });
});
