/**
 * plannerInsights.spec — P5-B: Planner Assist 集約関数テスト
 *
 * computePlannerInsights() は既存 Layer 2-5 の出力を集約して
 * planner が最初に見るべき「次の行動」を返す pure 関数。
 */

import { describe, it, expect } from 'vitest';
import {
  computePlannerInsights,
  type PlannerInsightsInput,
} from '../plannerInsights';

// ────────────────────────────────────────────
// ファクトリ
// ────────────────────────────────────────────

function makeInput(overrides: Partial<PlannerInsightsInput> = {}): PlannerInsightsInput {
  return {
    suggestions: [],
    decisions: [],
    goals: [],
    regulatoryItems: [],
    ...overrides,
  };
}

// ────────────────────────────────────────────
// テスト
// ────────────────────────────────────────────

describe('computePlannerInsights', () => {
  // ── 1. 空入力（goals 以外すべて空） ──
  it('提案・判断・HUD 全空で goals ありなら actions は空配列', () => {
    const result = computePlannerInsights(
      makeInput({
        goals: [{ id: 'g1', type: 'short', title: 'ダミー', domains: [] }],
      }),
    );
    expect(result.actions).toEqual([]);
    expect(result.summary.totalOpenActions).toBe(0);
  });

  it('全データ空（goals=[]）なら missingGoals のみ', () => {
    const result = computePlannerInsights(makeInput());
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].key).toBe('missingGoals');
    expect(result.summary.totalOpenActions).toBe(1);
  });

  // ── 2. 未判断提案 ──
  it('未判断の提案があれば pendingSuggestions アクションを返す', () => {
    const result = computePlannerInsights(
      makeInput({
        suggestions: [
          { id: 's1', title: '目標A', rationale: '', suggestedSupports: [], priority: 'high', provenance: [], goalType: 'short', domains: [] },
          { id: 's2', title: '目標B', rationale: '', suggestedSupports: [], priority: 'medium', provenance: [], goalType: 'long', domains: [] },
        ],
        decisions: [
          { id: 's1', source: 'smart', action: 'accepted', decidedAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    );

    const pending = result.actions.find((a) => a.key === 'pendingSuggestions');
    expect(pending).toBeDefined();
    expect(pending!.count).toBe(1); // s2 のみ未判断
    expect(pending!.tab).toBe('smart');
  });

  it('全提案が判断済みなら pendingSuggestions を返さない', () => {
    const result = computePlannerInsights(
      makeInput({
        suggestions: [
          { id: 's1', title: '目標A', rationale: '', suggestedSupports: [], priority: 'high', provenance: [], goalType: 'short', domains: [] },
        ],
        decisions: [
          { id: 's1', source: 'smart', action: 'accepted', decidedAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    );

    const pending = result.actions.find((a) => a.key === 'pendingSuggestions');
    expect(pending).toBeUndefined();
  });

  // ── 3. 昇格候補 ──
  it('noted/deferred のメモがあれば promotionCandidates を返す', () => {
    const result = computePlannerInsights(
      makeInput({
        decisions: [
          { id: 'm1', source: 'memo', action: 'noted', decidedAt: '2026-01-01T00:00:00Z' },
          { id: 'm2', source: 'memo', action: 'deferred', decidedAt: '2026-01-01T00:00:00Z' },
          { id: 'm3', source: 'memo', action: 'promoted', decidedAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    );

    const promo = result.actions.find((a) => a.key === 'promotionCandidates');
    expect(promo).toBeDefined();
    expect(promo!.count).toBe(2); // noted + deferred のみ（promoted は除外）
    expect(promo!.tab).toBe('excellence');
  });

  it('全メモが promoted なら promotionCandidates を返さない', () => {
    const result = computePlannerInsights(
      makeInput({
        decisions: [
          { id: 'm1', source: 'memo', action: 'promoted', decidedAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    );

    const promo = result.actions.find((a) => a.key === 'promotionCandidates');
    expect(promo).toBeUndefined();
  });

  // ── 4. 未設定目標 ──
  it('goals が空なら missingGoals を返す', () => {
    const result = computePlannerInsights(makeInput({ goals: [] }));

    const missing = result.actions.find((a) => a.key === 'missingGoals');
    expect(missing).toBeDefined();
    expect(missing!.count).toBe(1); // 「目標未設定」として1件
    expect(missing!.tab).toBe('smart');
  });

  it('goals が存在すれば missingGoals を返さない', () => {
    const result = computePlannerInsights(
      makeInput({
        goals: [{ id: 'g1', type: 'short', title: 'テスト目標', domains: [] }],
      }),
    );

    const missing = result.actions.find((a) => a.key === 'missingGoals');
    expect(missing).toBeUndefined();
  });

  // ── 5. 制度要件漏れ ──
  it('warning/danger の HUD 項目があれば regulatoryIssues を返す', () => {
    const result = computePlannerInsights(
      makeInput({
        regulatoryItems: [
          { key: 'r1', label: 'ISP 期限切れ', signal: 'danger' },
          { key: 'r2', label: 'モニタリング未実施', signal: 'warning' },
          { key: 'r3', label: 'コンプライアンス OK', signal: 'ok' },
        ],
      }),
    );

    const regulatory = result.actions.find((a) => a.key === 'regulatoryIssues');
    expect(regulatory).toBeDefined();
    expect(regulatory!.count).toBe(2); // danger + warning のみ
    expect(regulatory!.tab).toBe('compliance');
  });

  it('全 HUD が ok なら regulatoryIssues を返さない', () => {
    const result = computePlannerInsights(
      makeInput({
        regulatoryItems: [
          { key: 'r1', label: 'OK 1', signal: 'ok' },
          { key: 'r2', label: 'OK 2', signal: 'ok' },
        ],
      }),
    );

    const regulatory = result.actions.find((a) => a.key === 'regulatoryIssues');
    expect(regulatory).toBeUndefined();
  });

  // ── 6. 0件アクションは返さない ──
  it('0件カウントのアクションは actions に含まれない', () => {
    const result = computePlannerInsights(
      makeInput({
        suggestions: [],
        decisions: [],
        goals: [{ id: 'g1', type: 'short', title: 'ある', domains: [] }],
        regulatoryItems: [{ key: 'r1', label: 'OK', signal: 'ok' }],
      }),
    );

    // すべて問題なし → actions は空
    expect(result.actions).toEqual([]);
  });

  // ── 7. severity / count による並び順 ──
  it('severity desc → count desc の順で actions を返す', () => {
    const result = computePlannerInsights(
      makeInput({
        suggestions: [
          { id: 's1', title: '提案1', rationale: '', suggestedSupports: [], priority: 'high', provenance: [], goalType: 'short', domains: [] },
          { id: 's2', title: '提案2', rationale: '', suggestedSupports: [], priority: 'high', provenance: [], goalType: 'short', domains: [] },
          { id: 's3', title: '提案3', rationale: '', suggestedSupports: [], priority: 'high', provenance: [], goalType: 'short', domains: [] },
        ],
        decisions: [
          { id: 'm1', source: 'memo', action: 'noted', decidedAt: '2026-01-01T00:00:00Z' },
        ],
        goals: [],
        regulatoryItems: [
          { key: 'r1', label: '期限切れ', signal: 'danger' },
        ],
      }),
    );

    expect(result.actions.length).toBeGreaterThanOrEqual(3);

    // danger が先（regulatoryIssues, missingGoals は warning）
    const severities = result.actions.map((a) => a.severity);
    const severityOrder = { danger: 0, warning: 1, info: 2 };
    for (let i = 1; i < severities.length; i++) {
      expect(severityOrder[severities[i]]).toBeGreaterThanOrEqual(
        severityOrder[severities[i - 1]],
      );
    }
  });

  // ── 8. acceptanceRate のゼロ除算 ──
  it('判断データなしなら weeklyAcceptanceRate は undefined', () => {
    const result = computePlannerInsights(makeInput());
    expect(result.summary.weeklyAcceptanceRate).toBeUndefined();
  });

  it('判断データがあれば weeklyAcceptanceRate を算出', () => {
    const result = computePlannerInsights(
      makeInput({
        decisions: [
          { id: 's1', source: 'smart', action: 'accepted', decidedAt: '2026-01-01T00:00:00Z' },
          { id: 's2', source: 'smart', action: 'accepted', decidedAt: '2026-01-01T00:00:00Z' },
          { id: 's3', source: 'smart', action: 'dismissed', decidedAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    );

    // 2 accepted / 3 total (smart) = 2/3 ≈ 0.667
    expect(result.summary.weeklyAcceptanceRate).toBeCloseTo(2 / 3);
  });

  // ── 9. totalOpenActions の集計 ──
  it('totalOpenActions は全アクションの count 合計', () => {
    const result = computePlannerInsights(
      makeInput({
        suggestions: [
          { id: 's1', title: '提案1', rationale: '', suggestedSupports: [], priority: 'high', provenance: [], goalType: 'short', domains: [] },
        ],
        goals: [],
        regulatoryItems: [
          { key: 'r1', label: '要件漏れ', signal: 'warning' },
        ],
      }),
    );

    const expectedTotal = result.actions.reduce((sum, a) => sum + a.count, 0);
    expect(result.summary.totalOpenActions).toBe(expectedTotal);
  });

  // ── 10. append-only の最新判断を使う ──
  it('同じ id の複数レコードは最新のみ参照', () => {
    const result = computePlannerInsights(
      makeInput({
        suggestions: [
          { id: 's1', title: '提案1', rationale: '', suggestedSupports: [], priority: 'high', provenance: [], goalType: 'short', domains: [] },
        ],
        decisions: [
          // s1: 最初 dismissed → 後で accepted（最新）
          { id: 's1', source: 'smart', action: 'dismissed', decidedAt: '2026-01-01T00:00:00Z' },
          { id: 's1', source: 'smart', action: 'accepted', decidedAt: '2026-01-02T00:00:00Z' },
        ],
      }),
    );

    // s1 は最新で accepted → 未判断は 0
    const pending = result.actions.find((a) => a.key === 'pendingSuggestions');
    expect(pending).toBeUndefined();
  });
});
