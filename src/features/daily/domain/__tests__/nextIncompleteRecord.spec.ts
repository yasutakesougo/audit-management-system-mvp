/**
 * @fileoverview getNextIncompleteRecord の単体テスト
 * @description
 * MVP-004: 次の未完了レコード検索ロジックのテスト
 *
 * テスト観点:
 * - 正常系: 後方に未完了あり → 返す
 * - 正常系: 後方全完了 → 先頭から検索
 * - 全完了時: null を返す
 * - 空配列: null を返す
 * - 存在しないID: null を返す
 * - 最終レコードからの検索
 */

import { describe, it, expect } from 'vitest';
import { getNextIncompleteRecord } from '../validation/nextIncompleteRecord';
import type { PersonDaily } from '@/domain/daily/types';

/** 最小限のPersonDailyファクトリ */
function makeRecord(id: number, status: '完了' | '作成中' | '未作成'): PersonDaily {
  return {
    id,
    userId: `user-${id}`,
    userName: `User ${id}`,
    date: '2026-03-17',
    status,
    reporter: { name: 'recorder' },
    draft: { isDraft: status !== '完了' },
    kind: 'A',
    data: {
      amActivities: [],
      pmActivities: [],
      behaviorTags: [],
    },
  } as PersonDaily;
}

describe('getNextIncompleteRecord', () => {
  it('後方に未完了レコードがあればそれを返す', () => {
    const records = [
      makeRecord(1, '完了'),
      makeRecord(2, '作成中'),  // current
      makeRecord(3, '未作成'),  // ← expected
      makeRecord(4, '完了'),
    ];

    const result = getNextIncompleteRecord(records, 2);
    expect(result?.id).toBe(3);
  });

  it('後方が全て完了なら先頭から検索する', () => {
    const records = [
      makeRecord(1, '未作成'),  // ← expected
      makeRecord(2, '完了'),
      makeRecord(3, '作成中'),  // current
      makeRecord(4, '完了'),
    ];

    const result = getNextIncompleteRecord(records, 3);
    expect(result?.id).toBe(1);
  });

  it('全完了ならnullを返す', () => {
    const records = [
      makeRecord(1, '完了'),
      makeRecord(2, '完了'),
      makeRecord(3, '完了'),
    ];

    const result = getNextIncompleteRecord(records, 2);
    expect(result).toBeNull();
  });

  it('空配列ならnullを返す', () => {
    const result = getNextIncompleteRecord([], 1);
    expect(result).toBeNull();
  });

  it('存在しないIDならnullを返す', () => {
    const records = [
      makeRecord(1, '未作成'),
      makeRecord(2, '作成中'),
    ];

    const result = getNextIncompleteRecord(records, 999);
    expect(result).toBeNull();
  });

  it('最終レコードからでも先頭の未完了を見つける', () => {
    const records = [
      makeRecord(1, '完了'),
      makeRecord(2, '未作成'),  // ← expected
      makeRecord(3, '完了'),
      makeRecord(4, '作成中'),  // current
    ];

    const result = getNextIncompleteRecord(records, 4);
    expect(result?.id).toBe(2);
  });

  it('自分自身は対象外（完了済のcurrentは返さない）', () => {
    const records = [
      makeRecord(1, '完了'),
      makeRecord(2, '完了'),   // current — すでに完了
    ];

    const result = getNextIncompleteRecord(records, 2);
    expect(result).toBeNull();
  });

  it('1件だけで未完了ならnull（自分自身は対象外）', () => {
    const records = [makeRecord(1, '作成中')]; // current自身
    const result = getNextIncompleteRecord(records, 1);
    // 自身以外に未完了がないため null
    expect(result).toBeNull();
  });
});
