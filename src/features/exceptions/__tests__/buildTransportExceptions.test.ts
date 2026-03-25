/**
 * buildTransportExceptions — Unit Tests
 *
 * Transport Alert → ExceptionItem 変換の仕様をテストで固定する。
 * v2: per-user enrichment テストを追加。
 */
import { describe, expect, it } from 'vitest';
import { buildTransportExceptions } from '../domain/buildTransportExceptions';
import type { KpiAlert } from '@/features/telemetry/domain/computeCtaKpiDiff';
import type { TransportDetails } from '../domain/extractTransportDetails';
import type { MissingDriverDetail } from '../domain/buildTransportExceptions';

const TODAY = '2026-03-24';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAlert(overrides: Partial<KpiAlert> & { id: string }): KpiAlert {
  return {
    severity: 'warning',
    label: 'test alert',
    message: 'test message',
    value: 5,
    threshold: 3,
    ...overrides,
  };
}

// ── Legacy 2-arg Tests (backward compatibility) ─────────────────────────────

describe('buildTransportExceptions (legacy 2-arg)', () => {
  it('空のアラート配列は空の例外配列を返す', () => {
    const result = buildTransportExceptions([], TODAY);
    expect(result).toEqual([]);
  });

  it('sync-fail-count アラートを critical 例外に変換する', () => {
    const alerts = [makeAlert({ id: 'transport-sync-fail-count', severity: 'critical' })];
    const result = buildTransportExceptions(alerts, TODAY);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: `transport-transport-sync-fail-count-${TODAY}`,
      category: 'transport-alert',
      severity: 'critical',
      title: '送迎実績の同期に失敗があります',
      actionLabel: '送迎状況を確認',
      actionPath: '/today',
      targetDate: TODAY,
    });
  });

  it('fallback-active アラートを high 例外に変換する', () => {
    const alerts = [makeAlert({ id: 'transport-fallback-active' })];
    const result = buildTransportExceptions(alerts, TODAY);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      category: 'transport-alert',
      severity: 'high',
      title: '送迎対象フィルタが無効です',
    });
  });

  it('stale-count アラートを medium 例外に変換する', () => {
    const alerts = [makeAlert({ id: 'transport-stale-count' })];
    const result = buildTransportExceptions(alerts, TODAY);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      category: 'transport-alert',
      severity: 'medium',
      title: '送迎ステータスが長時間停滞中',
    });
  });

  it('low-completion アラートを medium 例外に変換する', () => {
    const alerts = [makeAlert({ id: 'transport-low-completion' })];
    const result = buildTransportExceptions(alerts, TODAY);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      category: 'transport-alert',
      severity: 'medium',
      title: '送迎完了率が閾値を下回っています',
    });
  });

  it('missing-driver アラートを high 例外に変換する', () => {
    const alerts = [makeAlert({ id: 'transport-missing-driver-assignment' })];
    const result = buildTransportExceptions(alerts, TODAY);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      category: 'transport-alert',
      severity: 'high',
      title: '運転者未設定の送迎車両があります',
      actionLabel: '配車ボードを確認',
      actionPath: '/today',
    });
  });

  it('未知のアラートIDはスキップする', () => {
    const alerts = [
      makeAlert({ id: 'transport-sync-fail-count' }),
      makeAlert({ id: 'unknown-future-alert' }),
    ];
    const result = buildTransportExceptions(alerts, TODAY);

    expect(result).toHaveLength(1);
    expect(result[0].id).toContain('transport-sync-fail-count');
  });

  it('複数アラートを一括変換する', () => {
    const alerts = [
      makeAlert({ id: 'transport-sync-fail-count' }),
      makeAlert({ id: 'transport-fallback-active' }),
      makeAlert({ id: 'transport-stale-count' }),
      makeAlert({ id: 'transport-low-completion' }),
    ];
    const result = buildTransportExceptions(alerts, TODAY);

    expect(result).toHaveLength(4);
    expect(result.map((r) => r.category)).toEqual([
      'transport-alert',
      'transport-alert',
      'transport-alert',
      'transport-alert',
    ]);
  });

  it('description にアラートの message が入る', () => {
    const alerts = [makeAlert({ id: 'transport-sync-fail-count', message: '同期が5件失敗' })];
    const result = buildTransportExceptions(alerts, TODAY);

    expect(result[0].description).toBe('同期が5件失敗');
  });

  it('updatedAt に today が設定される', () => {
    const alerts = [makeAlert({ id: 'transport-sync-fail-count' })];
    const result = buildTransportExceptions(alerts, TODAY);

    expect(result[0].updatedAt).toBe(TODAY);
  });
});

// ── Options object Tests (v2) ───────────────────────────────────────────────

describe('buildTransportExceptions (options object)', () => {
  it('options 形式で基本変換が動作する', () => {
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-stale-count' })],
      today: TODAY,
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('送迎ステータスが長時間停滞中');
  });
});

// ── Per-user Enrichment Tests ───────────────────────────────────────────────

describe('buildTransportExceptions (per-user enrichment)', () => {
  const staleDetails: TransportDetails = {
    staleUsers: [
      { userCode: 'U001', direction: 'to', minutesElapsed: 45 },
      { userCode: 'U002', direction: 'from', minutesElapsed: 35 },
    ],
    syncFailedUsers: [],
  };
  const missingDriverUsers: MissingDriverDetail[] = [
    { userCode: 'U010', userName: '山田太郎', direction: 'to', vehicleId: '車両2' },
    { userCode: 'U011', direction: 'from', vehicleId: '車両4' },
  ];

  it('stale アラートで per-user 子例外を生成する', () => {
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-stale-count' })],
      today: TODAY,
      details: staleDetails,
    });

    // 1 aggregate + 2 per-user = 3
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('送迎ステータスが長時間停滞中');
    expect(result[1]).toMatchObject({
      targetUserId: 'U001',
      severity: 'medium', // 45分 < 60分
      title: expect.stringContaining('U001'),
      actionPath: expect.stringContaining('highlight=U001'),
    });
    expect(result[2]).toMatchObject({
      targetUserId: 'U002',
      actionPath: expect.stringContaining('direction=from'),
    });
  });

  it('60分以上の stale は severity を high に昇格する', () => {
    const longStale: TransportDetails = {
      staleUsers: [
        { userCode: 'U003', direction: 'to', minutesElapsed: 75 },
      ],
      syncFailedUsers: [],
    };
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-stale-count' })],
      today: TODAY,
      details: longStale,
    });

    expect(result[1].severity).toBe('high');
    expect(result[1].title).toContain('75分以上停滞中');
  });

  it('sync-failed アラートで per-user 子例外を生成する', () => {
    const syncDetails: TransportDetails = {
      staleUsers: [],
      syncFailedUsers: [
        { userCode: 'U004', direction: 'to', errorMessage: 'Network error' },
      ],
    };
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-sync-fail-count' })],
      today: TODAY,
      details: syncDetails,
    });

    // 1 aggregate + 1 per-user = 2
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      severity: 'critical',
      targetUserId: 'U004',
      description: 'Network error',
      actionPath: expect.stringContaining('highlight=U004'),
    });
  });

  it('userNames マップでコード → 名前変換が効く', () => {
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-stale-count' })],
      today: TODAY,
      details: staleDetails,
      userNames: { U001: '田中太郎', U002: '佐藤花子' },
    });

    expect(result[1].title).toContain('田中太郎');
    expect(result[1].targetUser).toBe('田中太郎');
    expect(result[1].actionLabel).toContain('田中太郎');
    expect(result[2].title).toContain('佐藤花子');
  });

  it('per-user は最大5件に制限される', () => {
    const manyStale: TransportDetails = {
      staleUsers: Array.from({ length: 8 }, (_, i) => ({
        userCode: `U${String(i + 1).padStart(3, '0')}`,
        direction: 'to' as const,
        minutesElapsed: 40,
      })),
      syncFailedUsers: [],
    };
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-stale-count' })],
      today: TODAY,
      details: manyStale,
    });

    // 1 aggregate + 5 per-user (MAX) = 6
    expect(result).toHaveLength(6);
  });

  it('details ありでも fallback/low-completion には per-user 生成しない', () => {
    const result = buildTransportExceptions({
      alerts: [
        makeAlert({ id: 'transport-fallback-active' }),
        makeAlert({ id: 'transport-low-completion' }),
      ],
      today: TODAY,
      details: staleDetails,
    });

    // 2 aggregate only, no per-user
    expect(result).toHaveLength(2);
  });

  it('deep link に direction パラメータが含まれる', () => {
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-stale-count' })],
      today: TODAY,
      details: {
        staleUsers: [
          { userCode: 'U001', direction: 'to', minutesElapsed: 40 },
        ],
        syncFailedUsers: [],
      },
    });

    expect(result[1].actionPath).toBe('/today?highlight=U001&direction=to');
  });

  it('子例外に parentId が設定され、集約例外には parentId が無い', () => {
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-stale-count' })],
      today: TODAY,
      details: staleDetails,
    });

    // 集約（親）には parentId なし
    expect(result[0].parentId).toBeUndefined();
    // 子 Exception には集約の ID が parentId として設定
    const expectedParentId = `transport-transport-stale-count-${TODAY}`;
    expect(result[1].parentId).toBe(expectedParentId);
    expect(result[2].parentId).toBe(expectedParentId);
  });

  it('sync-failed の子例外にも parentId が設定される', () => {
    const syncDetails: TransportDetails = {
      staleUsers: [],
      syncFailedUsers: [
        { userCode: 'U004', direction: 'to', errorMessage: 'Timeout' },
      ],
    };
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-sync-fail-count' })],
      today: TODAY,
      details: syncDetails,
    });

    expect(result[0].parentId).toBeUndefined();
    expect(result[1].parentId).toBe(`transport-transport-sync-fail-count-${TODAY}`);
  });

  it('missing-driver アラートで per-user 子例外を生成する', () => {
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-missing-driver-assignment' })],
      today: TODAY,
      missingDriverUsers,
      userNames: { U011: '佐藤花子' },
    });

    expect(result).toHaveLength(3);
    expect(result[0].parentId).toBeUndefined();
    expect(result[1]).toMatchObject({
      parentId: `transport-transport-missing-driver-assignment-${TODAY}`,
      targetUserId: 'U010',
      targetUser: '山田太郎',
      severity: 'high',
      title: expect.stringContaining('車両2'),
      actionPath: '/today?highlight=U010&direction=to',
    });
    expect(result[2]).toMatchObject({
      targetUserId: 'U011',
      targetUser: '佐藤花子',
      actionPath: '/today?highlight=U011&direction=from',
    });
  });

  it('missing-driver の子例外も最大5件に制限される', () => {
    const manyMissing: MissingDriverDetail[] = Array.from({ length: 7 }, (_, i) => ({
      userCode: `U${String(i + 1).padStart(3, '0')}`,
      direction: 'to',
      vehicleId: '車両1',
    }));
    const result = buildTransportExceptions({
      alerts: [makeAlert({ id: 'transport-missing-driver-assignment' })],
      today: TODAY,
      missingDriverUsers: manyMissing,
    });

    expect(result).toHaveLength(6);
  });
});
