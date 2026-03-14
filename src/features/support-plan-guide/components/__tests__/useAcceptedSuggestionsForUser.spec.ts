/**
 * useAcceptedSuggestionsForUser.spec.ts — スタブ hook のテスト
 *
 * Issue #10 Phase 2: SupportPlanGuide への接続
 *
 * Phase 2 ではスタブ実装なので、テストは契約の正当性を確認する。
 */

import { describe, expect, it } from 'vitest';

import { useAcceptedSuggestionsForUser } from '../../hooks/useAcceptedSuggestionsForUser';

describe('useAcceptedSuggestionsForUser', () => {
  it('Phase 2 スタブは空配列を返す', () => {
    const result = useAcceptedSuggestionsForUser('user-001');
    expect(result.items).toEqual([]);
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
    expect(result.source).toBe('stub');
  });

  it('どの userId を渡しても同じスタブ結果を返す', () => {
    const r1 = useAcceptedSuggestionsForUser('user-001');
    const r2 = useAcceptedSuggestionsForUser('user-999');
    expect(r1).toEqual(r2);
  });

  it('戻り値型が将来の SP 連携に必要な4プロパティを持つ', () => {
    const result = useAcceptedSuggestionsForUser('user-001');
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('isLoading');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('source');
  });
});
