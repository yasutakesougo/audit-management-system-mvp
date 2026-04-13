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

  it('全 11 個の SectionKey がカバーされている', () => {
    const allSubs = TAB_GROUPS.flatMap((g) => [...g.subs]);
    expect(allSubs).toHaveLength(11);
    expect(new Set(allSubs).size).toBe(11); // 重複なし
  });

  it('グループ key が一意', () => {
    const keys = TAB_GROUPS.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each([
    ['assessment', '1. アセスメント', ['assessment']],
    ['isp', '2. 個別支援計画 (ISP)', ['overview', 'smart', 'supports', 'safety', 'decision']],
    ['monitoring', '3. モニタリング', ['monitoring']],
    ['ibd', '4. 強度行動障害支援計画シート', ['risk', 'excellence']],
    ['output', '5. 同意・プレビュー', ['compliance', 'preview']],
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
    ['overview', 'isp'],
    ['assessment', 'assessment'],
    ['smart', 'isp'],
    ['supports', 'isp'],
    ['safety', 'isp'],
    ['decision', 'isp'],
    ['monitoring', 'monitoring'],
    ['risk', 'ibd'],
    ['excellence', 'ibd'],
    ['compliance', 'output'],
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
    expect(serializeTabRoute({ group: 'monitoring', sub: 'monitoring' })).toBe('monitoring.monitoring');
  });

  it('全タブのシリアライズが正しい', () => {
    expect(serializeTabRoute({ group: 'isp', sub: 'overview' })).toBe('isp.overview');
    expect(serializeTabRoute({ group: 'output', sub: 'preview' })).toBe('output.preview');
  });
});

// ---------------------------------------------------------------------------
// parseTabRoute — URL param → Route (新形式 + レガシー互換)
// ---------------------------------------------------------------------------

describe('parseTabRoute', () => {
  describe('新形式 (group.sub)', () => {
    it.each([
      ['assessment.assessment', 'assessment', 'assessment'],
      ['isp.overview', 'isp', 'overview'],
      ['isp.smart', 'isp', 'smart'],
      ['isp.supports', 'isp', 'supports'],
      ['isp.safety', 'isp', 'safety'],
      ['isp.decision', 'isp', 'decision'],
      ['monitoring.monitoring', 'monitoring', 'monitoring'],
      ['ibd.risk', 'ibd', 'risk'],
      ['ibd.excellence', 'ibd', 'excellence'],
      ['output.compliance', 'output', 'compliance'],
      ['output.preview', 'output', 'preview'],
    ] as const)('%s → {group: %s, sub: %s}', (param, group, sub) => {
      expect(parseTabRoute(param)).toEqual({ group, sub });
    });
  });

  describe('レガシー互換 (sub のみ)', () => {
    it.each([
      ['monitoring', 'monitoring', 'monitoring'],
      ['overview', 'isp', 'overview'],
      ['compliance', 'output', 'compliance'],
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
      expect(parseTabRoute('isp.monitoring')).toBeUndefined();
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
      const original = { group: 'monitoring' as const, sub: 'monitoring' as const };
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
      group: 'monitoring',
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
      group: 'monitoring',
      sub: 'monitoring',
    });
  });
});

// ---------------------------------------------------------------------------
// ヘルパー関数
// ---------------------------------------------------------------------------

describe('findGroupDef', () => {
  it('存在するグループを返す', () => {
    const group = findGroupDef('isp');
    expect(group).toBeDefined();
    expect(group!.label).toBe('2. 個別支援計画 (ISP)');
  });

  it('存在しないグループは undefined', () => {
    // @ts-expect-error — intentional invalid key
    expect(findGroupDef('nonexistent')).toBeUndefined();
  });
});

describe('getGroupDefaultSub', () => {
  it.each([
    ['assessment', 'assessment'],
    ['isp', 'overview'],
    ['monitoring', 'monitoring'],
    ['ibd', 'risk'],
    ['output', 'compliance'],
  ] as const)('%s → %s', (group, expected) => {
    expect(getGroupDefaultSub(group)).toBe(expected);
  });
});

describe('getAllSubsFlat', () => {
  it('全 11 個をフラット順で返す', () => {
    const subs = getAllSubsFlat();
    expect(subs).toHaveLength(11);
    expect(subs[0]).toBe('assessment');
    expect(subs[10]).toBe('preview');
  });

  it('グループ定義順にフラット展開される（TAB_GROUPS 順）', () => {
    const expectedOrder = [
      // assessment
      'assessment',
      // isp
      'overview', 'smart', 'supports', 'safety', 'decision',
      // monitoring
      'monitoring',
      // ibd
      'risk', 'excellence',
      // output
      'compliance', 'preview',
    ];
    expect(getAllSubsFlat()).toEqual(expectedOrder);
  });
});
