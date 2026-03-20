import { deriveDefaultStrategies } from '../deriveDefaultStrategies';
import type { ABCRecord } from '@/domain/behavior/abc';

// ── ヘルパー ──────────────────────────────────────────────────

const NOW = new Date('2026-03-20T10:00:00Z');

function makeRecord(overrides: Partial<ABCRecord> = {}): ABCRecord {
  return {
    id: 'r1',
    userId: 'U001',
    recordedAt: '2026-03-20T08:00:00Z', // 2時間前
    behavior: 'テスト行動',
    antecedent: '',
    antecedentTags: [],
    consequence: '',
    intensity: 3,
    ...overrides,
  };
}

// ── テスト ──────────────────────────────────────────────────

describe('deriveDefaultStrategies', () => {
  it('空配列 → 空 Set', () => {
    const result = deriveDefaultStrategies([], NOW);
    expect(result.defaultKeys.size).toBe(0);
    expect(result.sourceLabel).toBeNull();
  });

  it('referencedStrategies なし → 空 Set', () => {
    const result = deriveDefaultStrategies([makeRecord()], NOW);
    expect(result.defaultKeys.size).toBe(0);
  });

  it('applied=false のみ → 空 Set', () => {
    const result = deriveDefaultStrategies([
      makeRecord({
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '見通しカード', applied: false },
        ],
      }),
    ], NOW);
    expect(result.defaultKeys.size).toBe(0);
  });

  it('applied=true → 初期選択に含まれる', () => {
    const result = deriveDefaultStrategies([
      makeRecord({
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '見通しカード', applied: true },
        ],
      }),
    ], NOW);
    expect(result.defaultKeys.size).toBe(1);
    expect(result.defaultKeys.has('antecedent:見通しカード')).toBe(true);
    expect(result.sourceLabel).toContain('今日');
    expect(result.sourceLabel).toContain('の記録から反映');
  });

  it('3日超過の記録 → 空 Set', () => {
    const result = deriveDefaultStrategies([
      makeRecord({
        recordedAt: '2026-03-16T08:00:00Z', // 4日前
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '見通しカード', applied: true },
        ],
      }),
    ], NOW);
    expect(result.defaultKeys.size).toBe(0);
  });

  it('3日以内の記録 → 適用される', () => {
    const result = deriveDefaultStrategies([
      makeRecord({
        recordedAt: '2026-03-18T14:00:00Z', // 約1.8日前
        referencedStrategies: [
          { strategyKey: 'teaching', strategyText: 'ソーシャルスキル', applied: true },
        ],
      }),
    ], NOW);
    expect(result.defaultKeys.size).toBe(1);
    expect(result.sourceLabel).not.toBeNull();
    expect(result.sourceLabel).toContain('の記録から反映');
  });

  it('同一カテゴリ2件 → 最大1件に絞られる', () => {
    const result = deriveDefaultStrategies([
      makeRecord({
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '見通しカード', applied: true },
          { strategyKey: 'antecedent', strategyText: '環境調整', applied: true },
        ],
      }),
    ], NOW);
    expect(result.defaultKeys.size).toBe(1);
    expect(result.defaultKeys.has('antecedent:見通しカード')).toBe(true);
  });

  it('3カテゴリ混在 → 合計最大2件に絞られる', () => {
    const result = deriveDefaultStrategies([
      makeRecord({
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '見通しカード', applied: true },
          { strategyKey: 'teaching', strategyText: 'ソーシャルスキル', applied: true },
          { strategyKey: 'consequence', strategyText: '強化子提示', applied: true },
        ],
      }),
    ], NOW);
    expect(result.defaultKeys.size).toBe(2);
  });

  it('昨日の記録 → sourceLabel に「昨日」が含まれる', () => {
    const result = deriveDefaultStrategies([
      makeRecord({
        recordedAt: '2026-03-19T02:00:00Z', // 32時間前 → 1日前
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: 'テスト', applied: true },
        ],
      }),
    ], NOW);
    expect(result.sourceLabel).toContain('昨日');
    expect(result.sourceLabel).toContain('の記録から反映');
  });

  it('最新記録のみ参照（2件目は無視）', () => {
    const result = deriveDefaultStrategies([
      makeRecord({
        id: 'r1',
        recordedAt: '2026-03-20T09:00:00Z',
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '最新の戦略', applied: true },
        ],
      }),
      makeRecord({
        id: 'r2',
        recordedAt: '2026-03-19T09:00:00Z',
        referencedStrategies: [
          { strategyKey: 'teaching', strategyText: '古い戦略', applied: true },
        ],
      }),
    ], NOW);
    expect(result.defaultKeys.size).toBe(1);
    expect(result.defaultKeys.has('antecedent:最新の戦略')).toBe(true);
    expect(result.defaultKeys.has('teaching:古い戦略')).toBe(false);
  });
});
