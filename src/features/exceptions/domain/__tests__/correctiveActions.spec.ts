/**
 * Contract Tests: buildCorrectiveActions / extractUserId / buildAllCorrectiveActions / pickTopCorrectiveAction
 *
 * PR #1052 の核心: 例外種別ごとの是正アクション生成仕様を固定する。
 *
 * ## 固定する仕様
 * 1. カテゴリごとに正しいアクション群が返る
 * 2. label / route / variant / severity / icon / key が期待どおり
 * 3. variant の並び順: primary > secondary > ghost
 * 4. actionPath から userId が正しく抽出・埋め込まれる
 * 5. actionPath がない場合の fallback route
 * 6. 未知カテゴリ → 空配列（型安全ガード）
 * 7. extractUserId の3パターン（QS / path / null）
 * 8. buildAllCorrectiveActions でマップが生成される
 * 9. pickTopCorrectiveAction で最優先 primary が返る
 */
import { describe, expect, it } from 'vitest';
import {
  buildCorrectiveActions,
  buildAllCorrectiveActions,
  pickTopCorrectiveAction,
  extractUserId,
} from '../correctiveActions';
import type { ExceptionItem } from '../exceptionLogic';

// ─── テスト用フィクスチャ ───────────────────────────────────

const base: Omit<ExceptionItem, 'category' | 'id'> = {
  severity: 'high',
  title: 'テスト例外',
  description: 'テスト用',
  updatedAt: '2026-03-18',
};

const makeMissingRecord = (userId = 'U-001'): ExceptionItem => ({
  ...base,
  id: 'ex-001',
  category: 'missing-record',
  actionPath: `/daily/activity?userId=${userId}`,
});

const makeOverduePlan = (userId = 'U-002'): ExceptionItem => ({
  ...base,
  id: 'ex-002',
  category: 'overdue-plan',
  actionPath: `/isp-editor/${userId}`,
});

const makeCriticalHandoff = (): ExceptionItem => ({
  ...base,
  id: 'ex-003',
  category: 'critical-handoff',
  severity: 'critical',
  actionPath: '/handoff-timeline?range=day&date=2026-03-18&handoffId=77',
  targetUserId: 'U-003',
});

const makeAttentionUser = (userId = 'U-004'): ExceptionItem => ({
  ...base,
  id: 'ex-004',
  category: 'attention-user',
  actionPath: `/isp-editor/${userId}`,
});

// ─── extractUserId ────────────────────────────────────────────

describe('extractUserId', () => {
  describe('クエリパラメータ（最優先）', () => {
    it('should extract userId from ?userId= query string', () => {
      expect(extractUserId('/daily/activity?userId=U-001')).toBe('U-001');
    });

    it('should extract userId from &userId= in multi-param QS', () => {
      expect(extractUserId('/page?date=2026-01-01&userId=U-002&foo=bar')).toBe('U-002');
    });

    it('should decode percent-encoded userId from QS', () => {
      expect(extractUserId('/page?userId=U%2D001')).toBe('U-001');
    });
  });

  describe('既知パス パターン', () => {
    it('should extract id from /isp-editor/:id', () => {
      expect(extractUserId('/isp-editor/U-003')).toBe('U-003');
    });

    it('should extract id from /users/:id', () => {
      expect(extractUserId('/users/U-004')).toBe('U-004');
    });

    it('should prefer QS over path pattern', () => {
      expect(extractUserId('/users/WRONG?userId=CORRECT')).toBe('CORRECT');
    });
  });

  describe('null ケース', () => {
    it('should return null for empty string', () => {
      expect(extractUserId('')).toBeNull();
    });

    it('should return null for path with no userId', () => {
      expect(extractUserId('/dailysupport')).toBeNull();
    });

    it('should return null for unrecognized path pattern', () => {
      expect(extractUserId('/some/unknown/path')).toBeNull();
    });
  });
});

// ─── buildCorrectiveActions ──────────────────────────────────

describe('buildCorrectiveActions', () => {
  // ── 並び順の保証 ───────────────────────────────

  describe('variant 並び順 (primary > secondary > ghost)', () => {
    it('missing-record: primary が先頭, ghost が末尾', () => {
      const actions = buildCorrectiveActions(makeMissingRecord());
      expect(actions[0].variant).toBe('primary');
      expect(actions[1].variant).toBe('ghost');
    });

    it('critical-handoff: primary が先頭, secondary が2番目', () => {
      const actions = buildCorrectiveActions(makeCriticalHandoff());
      expect(actions[0].variant).toBe('primary');
      expect(actions[1].variant).toBe('secondary');
    });
  });

  // ── missing-record ─────────────────────────────

  describe('missing-record', () => {
    it('should return 2 actions', () => {
      expect(buildCorrectiveActions(makeMissingRecord())).toHaveLength(2);
    });

    it('primary: 記録を入力する / route に userId が埋め込まれる', () => {
      const actions = buildCorrectiveActions(makeMissingRecord('U-001'));
      const primary = actions.find((a) => a.variant === 'primary')!;
      expect(primary.label).toBe('記録を入力する');
      expect(primary.route).toContain('U-001');
      expect(primary.severity).toBe('high');
      expect(primary.icon).toBe('📝');
    });

    it('ghost: 利用者ハブを開く / route に userId が埋め込まれる', () => {
      const actions = buildCorrectiveActions(makeMissingRecord('U-001'));
      const ghost = actions.find((a) => a.variant === 'ghost')!;
      expect(ghost.label).toBe('利用者ハブを開く');
      expect(ghost.route).toContain('U-001');
      expect(ghost.severity).toBe('medium');
    });

    it('actionPath なし時: fallback route が /dailysupport', () => {
      const item: ExceptionItem = { ...makeMissingRecord(), actionPath: undefined };
      const primary = buildCorrectiveActions(item).find((a) => a.variant === 'primary')!;
      expect(primary.route).toBe('/dailysupport');
    });

    it('actionPath なし時: ghost fallback が /users', () => {
      const item: ExceptionItem = { ...makeMissingRecord(), actionPath: undefined };
      const ghost = buildCorrectiveActions(item).find((a) => a.variant === 'ghost')!;
      expect(ghost.route).toBe('/users');
    });

    it('key が item.id を含む（重複防止）', () => {
      const actions = buildCorrectiveActions(makeMissingRecord());
      actions.forEach((a) => expect(a.key).toContain('ex-001'));
    });
  });

  // ── overdue-plan ───────────────────────────────

  describe('overdue-plan', () => {
    it('should return 2 actions', () => {
      expect(buildCorrectiveActions(makeOverduePlan())).toHaveLength(2);
    });

    it('primary: 支援計画を作成する / route に userId が埋め込まれる', () => {
      const item = makeOverduePlan('U-002');
      const primary = buildCorrectiveActions(item).find((a) => a.variant === 'primary')!;
      expect(primary.label).toBe('支援計画を作成する');
      expect(primary.route).toContain('U-002');
      expect(primary.severity).toBe('high');
      expect(primary.icon).toBe('📋');
    });

    it('ghost: 利用者ハブを開く / severity は low', () => {
      const item = makeOverduePlan('U-002');
      const ghost = buildCorrectiveActions(item).find((a) => a.variant === 'ghost')!;
      expect(ghost.label).toBe('利用者ハブを開く');
      expect(ghost.severity).toBe('low');
      expect(ghost.route).toContain('U-002');
    });

    it('actionPath なし時: primary fallback が /planning', () => {
      const item: ExceptionItem = { ...makeOverduePlan(), actionPath: undefined };
      const primary = buildCorrectiveActions(item).find((a) => a.variant === 'primary')!;
      expect(primary.route).toBe('/planning');
    });
  });

  // ── critical-handoff ───────────────────────────

  describe('critical-handoff', () => {
    it('should return 2 actions', () => {
      expect(buildCorrectiveActions(makeCriticalHandoff())).toHaveLength(2);
    });

    it('primary: 申し送りを確認する / severity は critical', () => {
      const primary = buildCorrectiveActions(makeCriticalHandoff())
        .find((a) => a.variant === 'primary')!;
      expect(primary.label).toBe('申し送りを確認する');
      expect(primary.route).toBe('/handoff-timeline?range=day&date=2026-03-18&handoffId=77');
      expect(primary.severity).toBe('critical');
      expect(primary.icon).toBe('🔴');
    });

    it('secondary: 対応記録を残す / severity は high', () => {
      const secondary = buildCorrectiveActions(makeCriticalHandoff())
        .find((a) => a.variant === 'secondary')!;
      expect(secondary.label).toBe('対応記録を残す');
      expect(secondary.route).toBe('/daily/activity?userId=U-003');
      expect(secondary.severity).toBe('high');
      expect(secondary.icon).toBe('📝');
    });
  });

  // ── attention-user ─────────────────────────────

  describe('attention-user', () => {
    it('should return 2 actions', () => {
      expect(buildCorrectiveActions(makeAttentionUser())).toHaveLength(2);
    });

    it('primary: 支援手順書を確認する / severity は high', () => {
      const item = makeAttentionUser('U-004');
      const primary = buildCorrectiveActions(item).find((a) => a.variant === 'primary')!;
      expect(primary.label).toBe('支援手順書を確認する');
      expect(primary.route).toContain('U-004');
      expect(primary.severity).toBe('high');
      expect(primary.icon).toBe('📋');
    });

    it('secondary: 利用者ハブを開く / severity は medium', () => {
      const item = makeAttentionUser('U-004');
      const secondary = buildCorrectiveActions(item).find((a) => a.variant === 'secondary')!;
      expect(secondary.label).toBe('利用者ハブを開く');
      expect(secondary.severity).toBe('medium');
      expect(secondary.route).toContain('U-004');
    });
  });

  // ── 未知カテゴリのガード ───────────────────────

  describe('未知カテゴリ', () => {
    it('should return empty array for unknown category', () => {
      const item = { ...makeMissingRecord(), category: 'unknown-category' as never };
      expect(buildCorrectiveActions(item)).toEqual([]);
    });
  });

  // ── key の一意性 ───────────────────────────────

  describe('key の一意性', () => {
    it('actions within same item have different keys', () => {
      const actions = buildCorrectiveActions(makeMissingRecord());
      const keys = actions.map((a) => a.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('actions from different items with same category have different keys', () => {
      const item1 = { ...makeMissingRecord(), id: 'ex-A' };
      const item2 = { ...makeMissingRecord(), id: 'ex-B' };
      const keys1 = buildCorrectiveActions(item1).map((a) => a.key);
      const keys2 = buildCorrectiveActions(item2).map((a) => a.key);
      keys1.forEach((k) => expect(keys2).not.toContain(k));
    });
  });
});

// ─── buildAllCorrectiveActions ────────────────────────────────

describe('buildAllCorrectiveActions', () => {
  it('should return a Map with one entry per item', () => {
    const items = [makeMissingRecord(), makeOverduePlan(), makeCriticalHandoff()];
    const result = buildAllCorrectiveActions(items);
    expect(result.size).toBe(3);
    expect(result.has('ex-001')).toBe(true);
    expect(result.has('ex-002')).toBe(true);
    expect(result.has('ex-003')).toBe(true);
  });

  it('should return empty Map for empty input', () => {
    expect(buildAllCorrectiveActions([])).toEqual(new Map());
  });

  it('each map entry should have correct actions', () => {
    const result = buildAllCorrectiveActions([makeMissingRecord()]);
    const actions = result.get('ex-001')!;
    expect(actions[0].variant).toBe('primary');
  });
});

// ─── pickTopCorrectiveAction ──────────────────────────────────

describe('pickTopCorrectiveAction', () => {
  it('should return primary action of the first item', () => {
    const items = [makeMissingRecord(), makeOverduePlan()];
    const result = pickTopCorrectiveAction(items);
    expect(result).not.toBeNull();
    expect(result!.variant).toBe('primary');
    expect(result!.key).toContain('ex-001');
  });

  it('should return null for empty items array', () => {
    expect(pickTopCorrectiveAction([])).toBeNull();
  });

  it('should skip items with no primary action and return next', () => {
    // 未知カテゴリ（primary なし）→ 次のアイテムの primary を返す
    const unknownItem = { ...makeMissingRecord(), id: 'ex-X', category: 'unknown' as never };
    const validItem = { ...makeOverduePlan(), id: 'ex-valid' };
    const result = pickTopCorrectiveAction([unknownItem, validItem]);
    expect(result).not.toBeNull();
    expect(result!.key).toContain('ex-valid');
  });

  it('should return null when all items have unknown category', () => {
    const item = { ...makeMissingRecord(), category: 'unknown' as never };
    expect(pickTopCorrectiveAction([item])).toBeNull();
  });
});
