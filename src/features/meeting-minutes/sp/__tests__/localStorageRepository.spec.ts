/**
 * meeting-minutes — localStorageRepository 純関数テスト
 *
 * 対象:
 *   - matchesSearch  q / tag / category / from / to / publishedOnly の複合フィルタ
 *   - nextId         空配列・通常ケース
 *
 * テスト設計書: docs/test-design/meeting-minutes.md
 *
 * 設計上の注意:
 *   - q は title / summary / tags を AND でなく OR で検索（いずれか1つにヒットすれば一致）
 *   - tag は tags フィールドのみを検索（部分一致）
 *   - from / to は文字列比較（YYYY-MM-DD 前提）
 *   - 大文字小文字は区別しない（toLowerCase 済み）
 */
import { describe, it, expect } from 'vitest';

import { matchesSearch, nextId } from '../localStorageRepository';
import type { MeetingMinutes } from '../../types';

// ─── テスト用ファクトリ ───────────────────────────────────────────────────────

function makeMinutes(overrides?: Partial<MeetingMinutes>): MeetingMinutes {
  return {
    id: 1,
    title: 'テスト議事録',
    meetingDate: '2026-01-15',
    category: '職員会議',
    summary: '会議の概要',
    decisions: '決定事項',
    actions: '次のアクション',
    tags: 'タグA タグB',
    relatedLinks: '',
    isPublished: true,
    ...overrides,
  };
}

// ─── 条件なし（全件許可）────────────────────────────────────────────────────

describe('matchesSearch — 条件が空', () => {
  it('should match any item when all params are empty/omitted', () => {
    const item = makeMinutes();
    expect(matchesSearch(item, {})).toBe(true);
  });

  it('should match even for unpublished items when publishedOnly is not set', () => {
    const item = makeMinutes({ isPublished: false });
    expect(matchesSearch(item, {})).toBe(true);
  });
});

// ─── publishedOnly ───────────────────────────────────────────────────────────

describe('matchesSearch — publishedOnly', () => {
  it('should exclude unpublished items when publishedOnly is true', () => {
    const item = makeMinutes({ isPublished: false });
    expect(matchesSearch(item, { publishedOnly: true })).toBe(false);
  });

  it('should include published items when publishedOnly is true', () => {
    const item = makeMinutes({ isPublished: true });
    expect(matchesSearch(item, { publishedOnly: true })).toBe(true);
  });

  it('should include items with isPublished=undefined when publishedOnly is true', () => {
    // isPublished が明示的に false でなければ除外しない
    const item = makeMinutes({ isPublished: undefined });
    expect(matchesSearch(item, { publishedOnly: true })).toBe(true);
  });
});

// ─── q 検索（title / summary / tags の OR） ──────────────────────────────────

describe('matchesSearch — q', () => {
  it('should match when q is found in title', () => {
    const item = makeMinutes({ title: '職員会議 議事録', summary: '', tags: '' });
    expect(matchesSearch(item, { q: '職員会議' })).toBe(true);
  });

  it('should match when q is found in summary', () => {
    const item = makeMinutes({ title: 'A', summary: '重要な議題について', tags: '' });
    expect(matchesSearch(item, { q: '重要な議題' })).toBe(true);
  });

  it('should match when q is found in tags', () => {
    const item = makeMinutes({ title: 'A', summary: 'B', tags: '研修 安全' });
    expect(matchesSearch(item, { q: '安全' })).toBe(true);
  });

  it('should NOT match when q is not found in any of title/summary/tags', () => {
    const item = makeMinutes({ title: 'A', summary: 'B', tags: 'C' });
    expect(matchesSearch(item, { q: 'Z' })).toBe(false);
  });

  it('should be case-insensitive for q', () => {
    const item = makeMinutes({ title: 'Safety Check', summary: '', tags: '' });
    expect(matchesSearch(item, { q: 'safety' })).toBe(true);
    expect(matchesSearch(item, { q: 'SAFETY' })).toBe(true);
  });

  it('should trim whitespace from q before matching', () => {
    const item = makeMinutes({ title: '会議', summary: '', tags: '' });
    expect(matchesSearch(item, { q: '  会議  ' })).toBe(true);
  });

  it('should match all items when q is empty string', () => {
    const item = makeMinutes({ title: 'X', summary: 'Y', tags: 'Z' });
    expect(matchesSearch(item, { q: '' })).toBe(true);
  });
});

// ─── tag 検索（tags フィールドのみ・部分一致） ───────────────────────────────

describe('matchesSearch — tag', () => {
  it('should match when tag is found in tags field', () => {
    const item = makeMinutes({ tags: '研修 安全管理' });
    expect(matchesSearch(item, { tag: '安全管理' })).toBe(true);
  });

  it('should NOT match when tag is not in tags field', () => {
    const item = makeMinutes({ tags: '研修' });
    expect(matchesSearch(item, { tag: '安全' })).toBe(false);
  });

  it('should be case-insensitive for tag', () => {
    const item = makeMinutes({ tags: 'Safety Training' });
    expect(matchesSearch(item, { tag: 'safety' })).toBe(true);
  });

  it('should match all items when tag is empty string', () => {
    const item = makeMinutes({ tags: '' });
    expect(matchesSearch(item, { tag: '' })).toBe(true);
  });

  it('should NOT search title or summary for tag (tags-only search)', () => {
    // title に 'safety' があっても tag: 'safety' はタグフィールドのみ検索
    const item = makeMinutes({ title: 'Safety Meeting', tags: '' });
    expect(matchesSearch(item, { tag: 'safety' })).toBe(false);
  });
});

// ─── category 検索 ──────────────────────────────────────────────────────────

describe('matchesSearch — category', () => {
  it('should match when category exactly equals item category', () => {
    const item = makeMinutes({ category: '朝会' });
    expect(matchesSearch(item, { category: '朝会' })).toBe(true);
  });

  it('should NOT match when category differs', () => {
    const item = makeMinutes({ category: '職員会議' });
    expect(matchesSearch(item, { category: '朝会' })).toBe(false);
  });

  it('should match all items when category is ALL', () => {
    const item = makeMinutes({ category: '朝会' });
    expect(matchesSearch(item, { category: 'ALL' })).toBe(true);
  });

  it('should match all items when category is not specified', () => {
    const item = makeMinutes({ category: '夕会' });
    expect(matchesSearch(item, {})).toBe(true);
  });
});

// ─── from 境界値 ─────────────────────────────────────────────────────────────

describe('matchesSearch — from (日付範囲)', () => {
  it('should match when meetingDate === from (boundary: exact)', () => {
    const item = makeMinutes({ meetingDate: '2026-03-01' });
    expect(matchesSearch(item, { from: '2026-03-01' })).toBe(true);
  });

  it('should match when meetingDate > from (after boundary)', () => {
    const item = makeMinutes({ meetingDate: '2026-03-02' });
    expect(matchesSearch(item, { from: '2026-03-01' })).toBe(true);
  });

  it('should NOT match when meetingDate < from (before boundary)', () => {
    const item = makeMinutes({ meetingDate: '2026-02-28' });
    expect(matchesSearch(item, { from: '2026-03-01' })).toBe(false);
  });
});

// ─── to 境界値 ───────────────────────────────────────────────────────────────

describe('matchesSearch — to (日付範囲)', () => {
  it('should match when meetingDate === to (boundary: exact)', () => {
    const item = makeMinutes({ meetingDate: '2026-03-31' });
    expect(matchesSearch(item, { to: '2026-03-31' })).toBe(true);
  });

  it('should match when meetingDate < to (before boundary)', () => {
    const item = makeMinutes({ meetingDate: '2026-03-30' });
    expect(matchesSearch(item, { to: '2026-03-31' })).toBe(true);
  });

  it('should NOT match when meetingDate > to (after boundary)', () => {
    const item = makeMinutes({ meetingDate: '2026-04-01' });
    expect(matchesSearch(item, { to: '2026-03-31' })).toBe(false);
  });
});

// ─── from + to 範囲 ──────────────────────────────────────────────────────────

describe('matchesSearch — from + to (range)', () => {
  it('should match items within the date range', () => {
    const item = makeMinutes({ meetingDate: '2026-02-15' });
    expect(matchesSearch(item, { from: '2026-01-01', to: '2026-03-31' })).toBe(true);
  });

  it('should NOT match items before from in a range', () => {
    const item = makeMinutes({ meetingDate: '2025-12-31' });
    expect(matchesSearch(item, { from: '2026-01-01', to: '2026-03-31' })).toBe(false);
  });

  it('should NOT match items after to in a range', () => {
    const item = makeMinutes({ meetingDate: '2026-04-01' });
    expect(matchesSearch(item, { from: '2026-01-01', to: '2026-03-31' })).toBe(false);
  });
});

// ─── 複合条件 ────────────────────────────────────────────────────────────────

describe('matchesSearch — 複合条件', () => {
  it('should match when q AND tag both match', () => {
    const item = makeMinutes({ title: '安全会議', tags: '安全管理' });
    // q が title に、tag が tags にそれぞれ一致
    expect(matchesSearch(item, { q: '安全会議', tag: '安全管理' })).toBe(true);
  });

  it('should NOT match when q matches but tag does not', () => {
    const item = makeMinutes({ title: '安全会議', tags: '研修' });
    expect(matchesSearch(item, { q: '安全会議', tag: '安全管理' })).toBe(false);
  });

  it('should match when q AND category both match', () => {
    const item = makeMinutes({ title: '安全確認', category: '朝会' });
    expect(matchesSearch(item, { q: '安全', category: '朝会' })).toBe(true);
  });

  it('should NOT match when q matches but category does not', () => {
    const item = makeMinutes({ title: '安全確認', category: '職員会議' });
    expect(matchesSearch(item, { q: '安全', category: '朝会' })).toBe(false);
  });

  it('should match when tag + category + from/to all match', () => {
    const item = makeMinutes({
      meetingDate: '2026-02-15',
      category: '委員会',
      tags: '拘束 適正化',
    });
    expect(
      matchesSearch(item, {
        tag: '拘束',
        category: '委員会',
        from: '2026-01-01',
        to: '2026-03-31',
      }),
    ).toBe(true);
  });

  it('should NOT match when one condition in complex query fails', () => {
    const item = makeMinutes({
      meetingDate: '2026-02-15',
      category: '委員会',
      tags: '拘束 適正化',
    });
    // from の条件が不一致（日付が範囲外）
    expect(
      matchesSearch(item, {
        tag: '拘束',
        category: '委員会',
        from: '2026-03-01', // ← これが不一致
        to: '2026-03-31',
      }),
    ).toBe(false);
  });

  it('should NOT match when q matches but publishedOnly excludes the item', () => {
    const item = makeMinutes({ title: '重要会議', isPublished: false });
    expect(matchesSearch(item, { q: '重要会議', publishedOnly: true })).toBe(false);
  });
});

// ─── nextId ──────────────────────────────────────────────────────────────────

describe('nextId', () => {
  it('should return 1 when items array is empty', () => {
    expect(nextId([])).toBe(1);
  });

  it('should return max id + 1 for a single item', () => {
    const items = [makeMinutes({ id: 5 })];
    expect(nextId(items)).toBe(6);
  });

  it('should return max id + 1 for multiple items with non-sequential ids', () => {
    const items = [
      makeMinutes({ id: 3 }),
      makeMinutes({ id: 10 }),
      makeMinutes({ id: 7 }),
    ];
    expect(nextId(items)).toBe(11);
  });

  it('should return 2 when the only item has id = 1', () => {
    const items = [makeMinutes({ id: 1 })];
    expect(nextId(items)).toBe(2);
  });
});
