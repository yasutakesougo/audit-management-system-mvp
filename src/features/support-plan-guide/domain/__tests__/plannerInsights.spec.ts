/**
 * plannerInsights.spec — P5-B: Planner Assist 集約関数テスト
 *
 * computePlannerInsights() は既存 Layer 2-5 の出力を集約して
 * planner が最初に見るべき「次の行動」を返す pure 関数。
 */

import { describe, it, expect } from 'vitest';
import {
  computePlannerInsights,
  computePlannerInsightDetails,
  computePlannerTrendSeries,
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
        goals: [{ id: 'g1', type: 'short', label: 'ダミー', domains: [] }],
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
        goals: [{ id: 'g1', type: 'short', label: 'テスト目標', domains: [] }],
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
        goals: [{ id: 'g1', type: 'short', label: 'ある', domains: [] }],
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

// ────────────────────────────────────────────
// P5-C1: computePlannerInsightDetails テスト
// ────────────────────────────────────────────

describe('computePlannerInsightDetails', () => {
  // ── 1. 未判断提案の内訳 ──
  it('未判断の提案タイトルを返す', () => {
    const result = computePlannerInsightDetails(
      makeInput({
        suggestions: [
          { id: 's1', title: '自己決定支援の強化', rationale: '根拠A', suggestedSupports: [], priority: 'high', provenance: [], goalType: 'short', domains: [] },
          { id: 's2', title: '生活リズム改善', rationale: '根拠B', suggestedSupports: [], priority: 'medium', provenance: [], goalType: 'long', domains: [] },
        ],
        decisions: [
          { id: 's1', source: 'smart', action: 'accepted', decidedAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    );

    expect(result.pendingSuggestions).toHaveLength(1);
    expect(result.pendingSuggestions![0].label).toBe('生活リズム改善');
    expect(result.pendingSuggestions![0].detail).toBe('根拠B');
  });

  it('全提案判断済みなら pendingSuggestions は undefined', () => {
    const result = computePlannerInsightDetails(
      makeInput({
        suggestions: [
          { id: 's1', title: '提案A', rationale: '', suggestedSupports: [], priority: 'high', provenance: [], goalType: 'short', domains: [] },
        ],
        decisions: [
          { id: 's1', source: 'smart', action: 'accepted', decidedAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    );
    expect(result.pendingSuggestions).toBeUndefined();
  });

  // ── 2. 昇格候補の内訳 ──
  it('noted/deferred の候補をタイトル付きで返す', () => {
    const result = computePlannerInsightDetails(
      makeInput({
        suggestions: [
          { id: 'm1', title: '候補メモA', rationale: '', suggestedSupports: [], priority: 'medium', provenance: [], goalType: 'short', domains: [] },
          { id: 'm2', title: '候補メモB', rationale: '', suggestedSupports: [], priority: 'low', provenance: [], goalType: 'long', domains: [] },
        ],
        decisions: [
          { id: 'm1', source: 'memo', action: 'noted', decidedAt: '2026-01-01T00:00:00Z' },
          { id: 'm2', source: 'memo', action: 'deferred', decidedAt: '2026-01-01T00:00:00Z' },
          { id: 'm3', source: 'memo', action: 'promoted', decidedAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    );

    expect(result.promotionCandidates).toHaveLength(2);
    expect(result.promotionCandidates![0].label).toBe('候補メモA');
    expect(result.promotionCandidates![0].detail).toBe('保留中');
    expect(result.promotionCandidates![1].label).toBe('候補メモB');
    expect(result.promotionCandidates![1].detail).toBe('再検討予定');
  });

  it('全メモが promoted なら promotionCandidates は undefined', () => {
    const result = computePlannerInsightDetails(
      makeInput({
        decisions: [
          { id: 'm1', source: 'memo', action: 'promoted', decidedAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    );
    expect(result.promotionCandidates).toBeUndefined();
  });

  // ── 3. 目標未設定 ──
  it('goals が空ならガイダンスメッセージを返す', () => {
    const result = computePlannerInsightDetails(makeInput({ goals: [] }));

    expect(result.missingGoals).toHaveLength(1);
    expect(result.missingGoals![0].label).toContain('支援目標が未設定');
    expect(result.missingGoals![0].navigateTo).toBe('smart');
  });

  it('goals がある場合は missingGoals を返さない', () => {
    const result = computePlannerInsightDetails(
      makeInput({
        goals: [{ id: 'g1', type: 'short', label: 'テスト目標', domains: [] }],
      }),
    );
    expect(result.missingGoals).toBeUndefined();
  });

  // ── 4. 制度要件問題の内訳 ──
  it('warning/danger の HUD 項目を個別に返す', () => {
    const result = computePlannerInsightDetails(
      makeInput({
        regulatoryItems: [
          { key: 'consent', label: '同意未取得', signal: 'danger', detail: '同意記録が未入力です。', navigateTo: 'compliance' },
          { key: 'delivery', label: '交付一部完了', signal: 'warning', detail: '相談支援専門員への交付がまだです。', navigateTo: 'compliance' },
          { key: 'isp-status', label: 'ISP確定済み', signal: 'ok' },
        ],
      }),
    );

    expect(result.regulatoryIssues).toHaveLength(2);
    expect(result.regulatoryIssues![0].label).toBe('同意未取得');
    expect(result.regulatoryIssues![0].detail).toBe('同意記録が未入力です。');
    expect(result.regulatoryIssues![1].label).toBe('交付一部完了');
  });

  it('全 HUD が ok なら regulatoryIssues は undefined', () => {
    const result = computePlannerInsightDetails(
      makeInput({
        regulatoryItems: [
          { key: 'r1', label: 'OK 1', signal: 'ok' },
          { key: 'r2', label: 'OK 2', signal: 'ok' },
        ],
      }),
    );
    expect(result.regulatoryIssues).toBeUndefined();
  });

  // ── 5. 全空入力 ──
  it('全空入力で missingGoals のみ返す', () => {
    const result = computePlannerInsightDetails(makeInput());
    expect(result.missingGoals).toBeDefined();
    expect(result.pendingSuggestions).toBeUndefined();
    expect(result.promotionCandidates).toBeUndefined();
    expect(result.regulatoryIssues).toBeUndefined();
  });
});

// ────────────────────────────────────────────
// P5-C2: computePlannerTrendSeries テスト
// ────────────────────────────────────────────

describe('computePlannerTrendSeries', () => {
  // 基準日: 2026-03-18 (水曜)
  // → 今週の月曜 = 2026-03-16
  const NOW = new Date('2026-03-18T12:00:00Z');

  // ── 1. 空データ ──
  it('判断なしなら isEmpty:true で全ポイント decisionCount=0', () => {
    const result = computePlannerTrendSeries([], { now: NOW, weeks: 4 });

    expect(result.isEmpty).toBe(true);
    expect(result.points).toHaveLength(4);
    expect(result.points.every((p) => p.decisionCount === 0)).toBe(true);
    expect(result.points.every((p) => p.acceptanceRate === undefined)).toBe(true);
  });

  // ── 2. バケット数 ──
  it('weeks 指定分のポイントを返す', () => {
    const r3 = computePlannerTrendSeries([], { now: NOW, weeks: 3 });
    expect(r3.points).toHaveLength(3);

    const r8 = computePlannerTrendSeries([], { now: NOW, weeks: 8 });
    expect(r8.points).toHaveLength(8);
  });

  // ── 3. 月曜始まりバケット ──
  it('ポイントの weekStart が月曜になる', () => {
    const result = computePlannerTrendSeries([], { now: NOW, weeks: 2 });
    // 2週前の月曜 = 2026-03-09, 今週の月曜 = 2026-03-16
    expect(result.points[0].weekStart).toBe('2026-03-09');
    expect(result.points[1].weekStart).toBe('2026-03-16');
  });

  // ── 4. 判断レコードの振り分け ──
  it('判断を正しい週バケットに振り分ける', () => {
    const decisions = [
      // 今週（3/16-3/22）
      { id: 's1', source: 'smart' as const, action: 'accepted' as const, decidedAt: '2026-03-18T10:00:00Z' },
      { id: 's2', source: 'smart' as const, action: 'dismissed' as const, decidedAt: '2026-03-17T08:00:00Z' },
      // 先週（3/9-3/15）
      { id: 's3', source: 'smart' as const, action: 'accepted' as const, decidedAt: '2026-03-10T09:00:00Z' },
    ];

    const result = computePlannerTrendSeries(decisions, { now: NOW, weeks: 2 });

    // 先週: 1件 accepted
    expect(result.points[0].decisionCount).toBe(1);
    expect(result.points[0].acceptanceRate).toBe(1.0);

    // 今週: 1 accepted + 1 dismissed = 2件
    expect(result.points[1].decisionCount).toBe(2);
    expect(result.points[1].acceptanceRate).toBe(0.5);
  });

  // ── 5. acceptanceRate 計算 ──
  it('accepted/dismissed がない週の acceptanceRate は undefined', () => {
    const decisions = [
      // 今週に noted（memo系 — accepted/dismissed ではない）
      { id: 'm1', source: 'memo' as const, action: 'noted' as const, decidedAt: '2026-03-18T10:00:00Z' },
    ];

    const result = computePlannerTrendSeries(decisions, { now: NOW, weeks: 2 });

    // 今週: total=1 だが accepted/dismissed が 0 → rate undefined
    expect(result.points[1].decisionCount).toBe(1);
    expect(result.points[1].acceptanceRate).toBeUndefined();
  });

  // ── 6. isEmpty フラグ ──
  it('判断ありなら isEmpty:false', () => {
    const decisions = [
      { id: 's1', source: 'smart' as const, action: 'accepted' as const, decidedAt: '2026-03-18T10:00:00Z' },
    ];
    const result = computePlannerTrendSeries(decisions, { now: NOW, weeks: 4 });
    expect(result.isEmpty).toBe(false);
  });

  // ── 7. 範囲外レコードは無視 ──
  it('バケット範囲外の判断は無視する', () => {
    const decisions = [
      // 2ヶ月前（範囲外）
      { id: 's1', source: 'smart' as const, action: 'accepted' as const, decidedAt: '2026-01-01T10:00:00Z' },
    ];
    const result = computePlannerTrendSeries(decisions, { now: NOW, weeks: 4 });
    expect(result.isEmpty).toBe(true);
    expect(result.points.every((p) => p.decisionCount === 0)).toBe(true);
  });

  // ── 8. weekLabel のフォーマット ──
  it('weekLabel が "月/日" 形式', () => {
    const result = computePlannerTrendSeries([], { now: NOW, weeks: 1 });
    // 今週の月曜 = 2026-03-16
    expect(result.points[0].weekLabel).toBe('3/16');
  });
});
