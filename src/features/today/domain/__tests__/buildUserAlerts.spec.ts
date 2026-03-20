import { buildUserAlerts } from '../buildUserAlerts';
import type { ABCRecord } from '@/domain/behavior/abc';

// ── ヘルパー ──────────────────────────────────────────────────

const BASE_RECORD: Omit<ABCRecord, 'id' | 'userId' | 'recordedAt' | 'behavior' | 'intensity'> = {
  antecedent: '要求却下',
  antecedentTags: [],
  consequence: '見守り',
};

function makeRecord(
  overrides: Partial<ABCRecord> & Pick<ABCRecord, 'userId' | 'recordedAt' | 'behavior' | 'intensity'>,
): ABCRecord {
  return {
    ...BASE_RECORD,
    id: `rec-${Math.random().toString(36).slice(2, 8)}`,
    ...overrides,
  };
}

const NOW = new Date('2026-03-20T15:00:00+09:00');

// ── テスト ────────────────────────────────────────────────────

describe('buildUserAlerts', () => {
  it('空配列なら空の Map を返す', () => {
    const result = buildUserAlerts([], NOW);
    expect(result.byUser.size).toBe(0);
  });

  it('低強度レコードのみ → 高強度アラートは出ない', () => {
    const records = [
      makeRecord({ userId: 'U001', recordedAt: '2026-03-20T10:00:00+09:00', behavior: '離席/飛び出し', intensity: 2 }),
      makeRecord({ userId: 'U001', recordedAt: '2026-03-19T10:00:00+09:00', behavior: '離席/飛び出し', intensity: 1 }),
    ];
    const result = buildUserAlerts(records, NOW);
    // 高強度なし、戦略もなし → 何も出ない
    expect(result.byUser.has('U001')).toBe(false);
  });

  it('高強度レコードがあれば high-intensity アラートが出る', () => {
    const records = [
      makeRecord({ userId: 'U001', recordedAt: '2026-03-20T10:00:00+09:00', behavior: '自傷(叩く)', intensity: 4 }),
      makeRecord({ userId: 'U001', recordedAt: '2026-03-19T10:00:00+09:00', behavior: '自傷(叩く)', intensity: 3 }),
    ];
    const result = buildUserAlerts(records, NOW);
    expect(result.byUser.has('U001')).toBe(true);
    const alerts = result.byUser.get('U001')!;
    const highAlert = alerts.find((a) => a.type === 'high-intensity');
    expect(highAlert).toBeDefined();
    expect(highAlert!.label).toContain('自傷');
  });

  it('直近に集中 → トレンド ↑ で severity=warning', () => {
    // 直近3日に3件、古いほうに1件 → 直近が多い = ↑
    const records = [
      makeRecord({ userId: 'U001', recordedAt: '2026-03-20T10:00:00+09:00', behavior: '他害(叩く/蹴る)', intensity: 4 }),
      makeRecord({ userId: 'U001', recordedAt: '2026-03-19T10:00:00+09:00', behavior: '他害(叩く/蹴る)', intensity: 3 }),
      makeRecord({ userId: 'U001', recordedAt: '2026-03-18T10:00:00+09:00', behavior: '他害(叩く/蹴る)', intensity: 5 }),
      makeRecord({ userId: 'U001', recordedAt: '2026-03-10T10:00:00+09:00', behavior: '他害(叩く/蹴る)', intensity: 3 }),
    ];
    const result = buildUserAlerts(records, NOW);
    const alert = result.byUser.get('U001')!.find(a => a.type === 'high-intensity')!;
    expect(alert.label).toContain('↑');
    expect(alert.severity).toBe('warning');
  });

  it('古いほうに集中 → トレンド ↓ で severity=info', () => {
    // 直近3日に0件、古いほうに4件 → ↓
    const records = [
      makeRecord({ userId: 'U001', recordedAt: '2026-03-10T10:00:00+09:00', behavior: '大声/奇声', intensity: 4 }),
      makeRecord({ userId: 'U001', recordedAt: '2026-03-09T10:00:00+09:00', behavior: '大声/奇声', intensity: 3 }),
      makeRecord({ userId: 'U001', recordedAt: '2026-03-08T10:00:00+09:00', behavior: '大声/奇声', intensity: 5 }),
      makeRecord({ userId: 'U001', recordedAt: '2026-03-07T10:00:00+09:00', behavior: '大声/奇声', intensity: 3 }),
    ];
    const result = buildUserAlerts(records, NOW);
    const alert = result.byUser.get('U001')!.find(a => a.type === 'high-intensity')!;
    expect(alert.label).toContain('↓');
    expect(alert.severity).toBe('info');
  });

  it('行動名の括弧部分が省略される', () => {
    const records = [
      makeRecord({ userId: 'U001', recordedAt: '2026-03-20T10:00:00+09:00', behavior: '自傷(叩く)', intensity: 4 }),
    ];
    const result = buildUserAlerts(records, NOW);
    const alert = result.byUser.get('U001')![0]!;
    expect(alert.label).toMatch(/^自傷/);
    expect(alert.label).not.toContain('(叩く)');
  });

  it('referencedStrategies の applied=true → active-strategy アラートが出る', () => {
    const records = [
      makeRecord({
        userId: 'U002',
        recordedAt: '2026-03-20T10:00:00+09:00',
        behavior: '離席/飛び出し',
        intensity: 2,
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '見通しカードの提示', applied: true },
          { strategyKey: 'teaching', strategyText: '深呼吸の声かけ', applied: false },
        ],
      }),
    ];
    const result = buildUserAlerts(records, NOW);
    expect(result.byUser.has('U002')).toBe(true);
    const alert = result.byUser.get('U002')!.find(a => a.type === 'active-strategy')!;
    expect(alert).toBeDefined();
    expect(alert.label).toContain('見通しカード');
    expect(alert.label).toContain('実施中');
  });

  it('applied=false のみ → 戦略アラートは出ない', () => {
    const records = [
      makeRecord({
        userId: 'U002',
        recordedAt: '2026-03-20T10:00:00+09:00',
        behavior: '離席/飛び出し',
        intensity: 2,
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '見通しカードの提示', applied: false },
        ],
      }),
    ];
    const result = buildUserAlerts(records, NOW);
    expect(result.byUser.has('U002')).toBe(false);
  });

  it('両方のアラートがある場合 → 最大2件に絞られる', () => {
    const records = [
      makeRecord({
        userId: 'U003',
        recordedAt: '2026-03-20T10:00:00+09:00',
        behavior: '自傷(叩く)',
        intensity: 5,
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: 'タイマー提示', applied: true },
        ],
      }),
      makeRecord({
        userId: 'U003',
        recordedAt: '2026-03-19T10:00:00+09:00',
        behavior: '自傷(叩く)',
        intensity: 4,
        referencedStrategies: [
          { strategyKey: 'teaching', strategyText: '深呼吸の声かけ', applied: true },
        ],
      }),
    ];
    const result = buildUserAlerts(records, NOW);
    const alerts = result.byUser.get('U003')!;
    expect(alerts.length).toBeLessThanOrEqual(2);
    // high-intensity が先に来るはず
    expect(alerts[0]!.type).toBe('high-intensity');
  });

  it('複数ユーザーが混在 → 各ユーザー独立に算出', () => {
    const records = [
      makeRecord({ userId: 'U001', recordedAt: '2026-03-20T10:00:00+09:00', behavior: '自傷(叩く)', intensity: 5 }),
      makeRecord({ userId: 'U002', recordedAt: '2026-03-20T10:00:00+09:00', behavior: '離席/飛び出し', intensity: 2 }),
    ];
    const result = buildUserAlerts(records, NOW);
    expect(result.byUser.has('U001')).toBe(true);
    expect(result.byUser.has('U002')).toBe(false); // 低強度 + 戦略なし → 表示なし
  });

  it('長い戦略テキストは切り詰められる', () => {
    const records = [
      makeRecord({
        userId: 'U004',
        recordedAt: '2026-03-20T10:00:00+09:00',
        behavior: '離席/飛び出し',
        intensity: 2,
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: 'とても長い戦略テキストが入ったときの省略テスト', applied: true },
        ],
      }),
    ];
    const result = buildUserAlerts(records, NOW);
    const alert = result.byUser.get('U004')!.find(a => a.type === 'active-strategy')!;
    expect(alert.label.length).toBeLessThan(30);
    expect(alert.label).toContain('…');
  });
});
