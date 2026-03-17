/**
 * tabRoute — ユニットテスト
 *
 * P1.5: group.sub ルーティングの正確性・互換性・エッジケースを検証。
 */

import { describe, expect, it } from 'vitest';
import {
  findGroupDef,
  getAllSubsFlat,
  getGroupDefaultSub,
  parseTabRoute,
  resolveTabRoute,
  resolveLegacyTabParam,
  serializeTabRoute,
  TAB_GROUPS,
} from '../tabRoute';

// ---------------------------------------------------------------------------
// TAB_GROUPS — 構造検証
// ---------------------------------------------------------------------------

describe('TAB_GROUPS', () => {
  it('5 グループが定義されている', () => {
    expect(TAB_GROUPS).toHaveLength(5);
  });

  it('全 10 個の SectionKey がカバーされている', () => {
    const allSubs = TAB_GROUPS.flatMap((g) => [...g.subs]);
    expect(allSubs).toHaveLength(10);
    expect(new Set(allSubs).size).toBe(10); // 重複なし
  });

  it('グループ key が一意', () => {
    const keys = TAB_GROUPS.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each([
    ['basic', '基本情報', ['overview', 'assessment']],
    ['plan', '計画策定', ['smart', 'supports', 'decision']],
    ['operations', '運用・実行', ['monitoring', 'risk', 'excellence']],
    ['system', '制度適合', ['compliance']],
    ['output', '出力', ['preview']],
  ] as const)('%s グループ: label=%s, subs=%j', (key, label, subs) => {
    const group = TAB_GROUPS.find((g) => g.key === key);
    expect(group).toBeDefined();
    expect(group!.label).toBe(label);
    expect([...group!.subs]).toEqual(subs);
  });
});

// ---------------------------------------------------------------------------
// resolveTabRoute — SectionKey → Route
// ---------------------------------------------------------------------------

describe('resolveTabRoute', () => {
  it.each([
    ['overview', 'basic'],
    ['assessment', 'basic'],
    ['smart', 'plan'],
    ['supports', 'plan'],
    ['decision', 'plan'],
    ['monitoring', 'operations'],
    ['risk', 'operations'],
    ['excellence', 'operations'],
    ['compliance', 'system'],
    ['preview', 'output'],
  ] as const)('%s → group=%s', (sub, expectedGroup) => {
    const route = resolveTabRoute(sub);
    expect(route).toEqual({ group: expectedGroup, sub });
  });

  it('存在しない key は undefined', () => {
    // @ts-expect-error — intentional invalid key
    expect(resolveTabRoute('nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// serializeTabRoute — Route → URL param 文字列
// ---------------------------------------------------------------------------

describe('serializeTabRoute', () => {
  it('group.sub 形式で出力', () => {
    expect(serializeTabRoute({ group: 'operations', sub: 'monitoring' })).toBe('operations.monitoring');
  });

  it('全タブのシリアライズが正しい', () => {
    expect(serializeTabRoute({ group: 'basic', sub: 'overview' })).toBe('basic.overview');
    expect(serializeTabRoute({ group: 'output', sub: 'preview' })).toBe('output.preview');
  });
});

// ---------------------------------------------------------------------------
// parseTabRoute — URL param → Route (新形式 + レガシー互換)
// ---------------------------------------------------------------------------

describe('parseTabRoute', () => {
  describe('新形式 (group.sub)', () => {
    it.each([
      ['basic.overview', 'basic', 'overview'],
      ['basic.assessment', 'basic', 'assessment'],
      ['plan.smart', 'plan', 'smart'],
      ['plan.supports', 'plan', 'supports'],
      ['plan.decision', 'plan', 'decision'],
      ['operations.monitoring', 'operations', 'monitoring'],
      ['operations.risk', 'operations', 'risk'],
      ['operations.excellence', 'operations', 'excellence'],
      ['system.compliance', 'system', 'compliance'],
      ['output.preview', 'output', 'preview'],
    ] as const)('%s → {group: %s, sub: %s}', (param, group, sub) => {
      expect(parseTabRoute(param)).toEqual({ group, sub });
    });
  });

  describe('レガシー互換 (sub のみ)', () => {
    it.each([
      ['monitoring', 'operations', 'monitoring'],
      ['overview', 'basic', 'overview'],
      ['compliance', 'system', 'compliance'],
      ['preview', 'output', 'preview'],
    ] as const)('%s → {group: %s, sub: %s}', (param, group, sub) => {
      expect(parseTabRoute(param)).toEqual({ group, sub });
    });
  });

  describe('不正入力', () => {
    it('null → undefined', () => {
      expect(parseTabRoute(null)).toBeUndefined();
    });

    it('空文字 → undefined', () => {
      expect(parseTabRoute('')).toBeUndefined();
    });

    it('空白のみ → undefined', () => {
      expect(parseTabRoute('   ')).toBeUndefined();
    });

    it('存在しない sub → undefined', () => {
      expect(parseTabRoute('nonexistent')).toBeUndefined();
    });

    it('存在しない group.sub → undefined', () => {
      expect(parseTabRoute('invalid.monitoring')).toBeUndefined();
    });

    it('group と sub の不整合 → undefined', () => {
      // monitoring は operations グループなので basic.monitoring は不正
      expect(parseTabRoute('basic.monitoring')).toBeUndefined();
    });

    it('ドットのみ → undefined', () => {
      expect(parseTabRoute('.')).toBeUndefined();
    });

    it('ドットから始まる → undefined', () => {
      expect(parseTabRoute('.monitoring')).toBeUndefined();
    });
  });

  describe('ラウンドトリップ', () => {
    it('serialize → parse が一致する', () => {
      const original = { group: 'operations' as const, sub: 'monitoring' as const };
      const serialized = serializeTabRoute(original);
      const parsed = parseTabRoute(serialized);
      expect(parsed).toEqual(original);
    });

    it('全タブのラウンドトリップ', () => {
      for (const group of TAB_GROUPS) {
        for (const sub of group.subs) {
          const route = resolveTabRoute(sub);
          expect(route).toBeDefined();
          const serialized = serializeTabRoute(route!);
          const parsed = parseTabRoute(serialized);
          expect(parsed).toEqual(route);
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// resolveLegacyTabParam — 旧形式アダプター
// ---------------------------------------------------------------------------

describe('resolveLegacyTabParam', () => {
  it('有効な旧パラメータ → Route', () => {
    expect(resolveLegacyTabParam('monitoring')).toEqual({
      group: 'operations',
      sub: 'monitoring',
    });
  });

  it('空文字 → undefined', () => {
    expect(resolveLegacyTabParam('')).toBeUndefined();
  });

  it('無効な値 → undefined', () => {
    expect(resolveLegacyTabParam('nonexistent')).toBeUndefined();
  });

  it('前後の空白は trim される', () => {
    expect(resolveLegacyTabParam('  monitoring  ')).toEqual({
      group: 'operations',
      sub: 'monitoring',
    });
  });
});

// ---------------------------------------------------------------------------
// ヘルパー関数
// ---------------------------------------------------------------------------

describe('findGroupDef', () => {
  it('存在するグループを返す', () => {
    const group = findGroupDef('plan');
    expect(group).toBeDefined();
    expect(group!.label).toBe('計画策定');
  });

  it('存在しないグループは undefined', () => {
    // @ts-expect-error — intentional invalid key
    expect(findGroupDef('nonexistent')).toBeUndefined();
  });
});

describe('getGroupDefaultSub', () => {
  it.each([
    ['basic', 'overview'],
    ['plan', 'smart'],
    ['operations', 'monitoring'],
    ['system', 'compliance'],
    ['output', 'preview'],
  ] as const)('%s → %s', (group, expected) => {
    expect(getGroupDefaultSub(group)).toBe(expected);
  });
});

describe('getAllSubsFlat', () => {
  it('全 10 個をフラット順で返す', () => {
    const subs = getAllSubsFlat();
    expect(subs).toHaveLength(10);
    expect(subs[0]).toBe('overview');
    expect(subs[9]).toBe('preview');
  });

  it('グループ定義順にフラット展開される（TAB_GROUPS 順）', () => {
    const expectedOrder = [
      // basic
      'overview', 'assessment',
      // plan
      'smart', 'supports', 'decision',
      // operations
      'monitoring', 'risk', 'excellence',
      // system
      'compliance',
      // output
      'preview',
    ];
    expect(getAllSubsFlat()).toEqual(expectedOrder);
  });
});
