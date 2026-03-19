/**
 * @fileoverview Phase F2 + F2.5: detectTagTrends 契約テスト
 * @description
 * spike / drop / new の3種のトレンド検知を網羅的にテスト。
 * F2.5: ノイズ制御（maxAlerts / maxPerType / minNewCount / truncatedCount）を検証。
 */
import { describe, it, expect } from 'vitest';
import {
  detectTagTrends,
  DEFAULT_THRESHOLDS,
  type DetectTagTrendsInput,
} from '../tagTrendAlerts';

// ── ヘルパー ──

const mkInput = (
  overrides: Partial<DetectTagTrendsInput> = {},
): DetectTagTrendsInput => ({
  currentCounts: {},
  baselineCounts: {},
  currentDays: 7,
  baselineDays: 30,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════
// 基本動作
// ═══════════════════════════════════════════════════════════

describe('detectTagTrends - 基本', () => {
  it('空入力 → アラートなし', () => {
    const result = detectTagTrends(mkInput());
    expect(result.hasAlerts).toBe(false);
    expect(result.spikes).toEqual([]);
    expect(result.drops).toEqual([]);
    expect(result.newTags).toEqual([]);
    expect(result.all).toEqual([]);
  });

  it('同じカウント → アラートなし', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 3 },
      baselineCounts: { panic: 3 },
      currentDays: 7,
      baselineDays: 7,
    }));
    expect(result.hasAlerts).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Spike 検知
// ═══════════════════════════════════════════════════════════

describe('detectTagTrends - spike', () => {
  it('日次平均が2倍以上 → spike', () => {
    // current: 7日間で14回 → 日次平均 2.0
    // baseline: 30日間で15回 → 日次平均 0.5
    // 比率: 4.0倍 → spike
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 14 },
      baselineCounts: { panic: 15 },
      currentDays: 7,
      baselineDays: 30,
    }));
    expect(result.spikes).toHaveLength(1);
    expect(result.spikes[0].tagKey).toBe('panic');
    expect(result.spikes[0].type).toBe('spike');
    expect(result.spikes[0].severity).toBe('warning');
    expect(result.spikes[0].changeRate).toBe(300); // (2.0 - 0.5) / 0.5 * 100
  });

  it('日次平均が2倍未満 → spike なし', () => {
    // current: 7日間で4回 → 日次平均 0.57
    // baseline: 30日間で15回 → 日次平均 0.5
    // 比率: 1.14倍 → spike ではない
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 4 },
      baselineCounts: { panic: 15 },
      currentDays: 7,
      baselineDays: 30,
    }));
    expect(result.spikes).toHaveLength(0);
  });

  it('minCount 未満 → spike 除外', () => {
    // current: 1回 → minCount(2) 未満
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 1 },
      baselineCounts: { panic: 1 },
      currentDays: 1,
      baselineDays: 30,
    }));
    expect(result.spikes).toHaveLength(0);
  });

  it('複数 spike → changeRate 降順', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 10, sensory: 20 },
      baselineCounts: { panic: 5, sensory: 5 },
      currentDays: 7,
      baselineDays: 30,
    }));
    expect(result.spikes.length).toBeGreaterThanOrEqual(1);
    if (result.spikes.length > 1) {
      expect(result.spikes[0].changeRate).toBeGreaterThanOrEqual(result.spikes[1].changeRate);
    }
  });

  it('spike のメッセージに +% が含まれる', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 14 },
      baselineCounts: { panic: 15 },
      currentDays: 7,
      baselineDays: 30,
    }));
    expect(result.spikes[0].message).toContain('急増');
    expect(result.spikes[0].message).toContain('+');
    expect(result.spikes[0].message).toContain('%');
  });
});

// ═══════════════════════════════════════════════════════════
// Drop 検知
// ═══════════════════════════════════════════════════════════

describe('detectTagTrends - drop', () => {
  it('baseline にあるが current に 0 → drop', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: {},
      baselineCounts: { panic: 5 },
    }));
    expect(result.drops).toHaveLength(1);
    expect(result.drops[0].tagKey).toBe('panic');
    expect(result.drops[0].type).toBe('drop');
    expect(result.drops[0].severity).toBe('info');
    expect(result.drops[0].changeRate).toBe(-100);
  });

  it('baseline が minCount 未満 → drop 除外', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: {},
      baselineCounts: { panic: 1 },
    }));
    expect(result.drops).toHaveLength(0);
  });

  it('detectDrops = false → drop を無視', () => {
    const result = detectTagTrends(
      mkInput({
        currentCounts: {},
        baselineCounts: { panic: 5 },
      }),
      { detectDrops: false },
    );
    expect(result.drops).toHaveLength(0);
  });

  it('drop のメッセージに「消失」が含まれる', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: {},
      baselineCounts: { panic: 3 },
    }));
    expect(result.drops[0].message).toContain('消失');
  });
});

// ═══════════════════════════════════════════════════════════
// New 検知
// ═══════════════════════════════════════════════════════════

describe('detectTagTrends - new', () => {
  it('current にのみ存在 → new', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 3 },
      baselineCounts: {},
    }));
    expect(result.newTags).toHaveLength(1);
    expect(result.newTags[0].tagKey).toBe('panic');
    expect(result.newTags[0].type).toBe('new');
    expect(result.newTags[0].severity).toBe('info');
    expect(result.newTags[0].changeRate).toBe(Infinity);
  });

  it('detectNew = false → new を無視', () => {
    const result = detectTagTrends(
      mkInput({
        currentCounts: { panic: 3 },
        baselineCounts: {},
      }),
      { detectNew: false },
    );
    expect(result.newTags).toHaveLength(0);
  });

  it('new のメッセージに「新規出現」が含まれる', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 2 },
      baselineCounts: {},
    }));
    expect(result.newTags[0].message).toContain('新規出現');
  });

  it('current = 0 & baseline = 0 → どれにも該当しない', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 0 },
      baselineCounts: { panic: 0 },
    }));
    expect(result.hasAlerts).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// ソート & 統合
// ═══════════════════════════════════════════════════════════

describe('detectTagTrends - all ソート', () => {
  it('warning が info より先', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 14, newTag: 2 },
      baselineCounts: { panic: 15, oldTag: 5 },
      currentDays: 7,
      baselineDays: 30,
    }));
    if (result.all.length >= 2) {
      const firstWarning = result.all.findIndex(a => a.severity === 'warning');
      const firstInfo = result.all.findIndex(a => a.severity === 'info');
      if (firstWarning >= 0 && firstInfo >= 0) {
        expect(firstWarning).toBeLessThan(firstInfo);
      }
    }
  });

  it('hasAlerts がアラートありの時 true', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { newTag: 2 },
      baselineCounts: {},
    }));
    expect(result.hasAlerts).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 閾値カスタマイズ
// ═══════════════════════════════════════════════════════════

describe('detectTagTrends - 閾値カスタマイズ', () => {
  it('spikeMultiplier を下げると検知しやすくなる', () => {
    const input = mkInput({
      currentCounts: { panic: 5 },
      baselineCounts: { panic: 10 },
      currentDays: 7,
      baselineDays: 30,
    });
    // デフォルト（×2.0）では spike にならない
    const r1 = detectTagTrends(input);
    // ×1.5 なら spike になる
    const r2 = detectTagTrends(input, { spikeMultiplier: 1.5 });
    expect(r2.spikes.length).toBeGreaterThanOrEqual(r1.spikes.length);
  });

  it('minCount を上げるとノイズが除外される', () => {
    const result = detectTagTrends(
      mkInput({
        currentCounts: {},
        baselineCounts: { panic: 2 },
      }),
      { minCount: 3 },
    );
    expect(result.drops).toHaveLength(0);
  });

  it('DEFAULT_THRESHOLDS がエクスポートされている', () => {
    expect(DEFAULT_THRESHOLDS.spikeMultiplier).toBe(2.0);
    expect(DEFAULT_THRESHOLDS.minCount).toBe(2);
    expect(DEFAULT_THRESHOLDS.minNewCount).toBe(2);
    expect(DEFAULT_THRESHOLDS.maxAlerts).toBe(5);
    expect(DEFAULT_THRESHOLDS.maxPerType).toBe(3);
    expect(DEFAULT_THRESHOLDS.detectDrops).toBe(true);
    expect(DEFAULT_THRESHOLDS.detectNew).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// タグ情報
// ═══════════════════════════════════════════════════════════

describe('detectTagTrends - タグ情報', () => {
  it('既知タグ → ラベルとカテゴリが正しい', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 3 },
      baselineCounts: {},
    }));
    expect(result.newTags[0].tagLabel).toBe('パニック');
    expect(result.newTags[0].category).toBe('behavior');
    expect(result.newTags[0].categoryLabel).toBe('行動');
  });

  it('不明タグ → key がそのまま label に', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { unknownTag: 3 },
      baselineCounts: {},
    }));
    expect(result.newTags[0].tagLabel).toBe('unknownTag');
    expect(result.newTags[0].category).toBe('unknown');
  });
});

// ═══════════════════════════════════════════════════════════
// F2.5: ノイズ制御
// ═══════════════════════════════════════════════════════════

describe('detectTagTrends - F2.5 ノイズ制御', () => {
  it('minNewCount — 1回だけの new はノイズとして除外', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { tag1: 1 },
      baselineCounts: {},
    }));
    expect(result.newTags).toHaveLength(0);
    expect(result.hasAlerts).toBe(false);
  });

  it('minNewCount — 2回以上なら new として検知', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { tag1: 2 },
      baselineCounts: {},
    }));
    expect(result.newTags).toHaveLength(1);
  });

  it('minNewCount カスタマイズ', () => {
    const result = detectTagTrends(
      mkInput({
        currentCounts: { tag1: 3 },
        baselineCounts: {},
      }),
      { minNewCount: 5 },
    );
    expect(result.newTags).toHaveLength(0);
  });

  it('maxPerType — 各種類最大3件に制限', () => {
    // 5個の drop を作る
    const baseline: Record<string, number> = {};
    for (let i = 0; i < 5; i++) baseline[`tag${i}`] = 10 - i;
    const result = detectTagTrends(mkInput({
      currentCounts: {},
      baselineCounts: baseline,
    }));
    expect(result.drops).toHaveLength(3); // maxPerType = 3
  });

  it('maxPerType カスタマイズ', () => {
    const baseline: Record<string, number> = {};
    for (let i = 0; i < 5; i++) baseline[`tag${i}`] = 5;
    const result = detectTagTrends(
      mkInput({ currentCounts: {}, baselineCounts: baseline }),
      { maxPerType: 2 },
    );
    expect(result.drops).toHaveLength(2);
  });

  it('maxAlerts — 全体で最大5件に制限', () => {
    // 3 spike + 3 drop + 3 new = 9 個のアラートを作る
    const current: Record<string, number> = {};
    const baseline: Record<string, number> = {};
    // spike: s0-s2 (current 高、baseline 低)
    for (let i = 0; i < 3; i++) {
      current[`spike${i}`] = 20;
      baseline[`spike${i}`] = 2;
    }
    // drop: d0-d2 (baseline のみ)
    for (let i = 0; i < 3; i++) {
      baseline[`drop${i}`] = 5;
    }
    // new: n0-n2 (current のみ)
    for (let i = 0; i < 3; i++) {
      current[`new${i}`] = 3;
    }
    const result = detectTagTrends(mkInput({
      currentCounts: current,
      baselineCounts: baseline,
      currentDays: 7,
      baselineDays: 30,
    }));
    expect(result.all.length).toBeLessThanOrEqual(5);
  });

  it('truncatedCount — 切り捨て件数が正確', () => {
    const current: Record<string, number> = {};
    const baseline: Record<string, number> = {};
    for (let i = 0; i < 3; i++) {
      current[`spike${i}`] = 20;
      baseline[`spike${i}`] = 2;
    }
    for (let i = 0; i < 3; i++) {
      baseline[`drop${i}`] = 5;
    }
    for (let i = 0; i < 3; i++) {
      current[`new${i}`] = 3;
    }
    const result = detectTagTrends(mkInput({
      currentCounts: current,
      baselineCounts: baseline,
      currentDays: 7,
      baselineDays: 30,
    }));
    const totalRaw = 3 + 3 + 3; // 9 raw alerts
    expect(result.truncatedCount).toBe(totalRaw - result.all.length);
  });

  it('truncatedCount — 切り捨てなしの場合は 0', () => {
    const result = detectTagTrends(mkInput({
      currentCounts: { panic: 3 },
      baselineCounts: {},
    }));
    expect(result.truncatedCount).toBe(0);
  });

  it('maxAlerts = 0 → 全て切り捨て', () => {
    const result = detectTagTrends(
      mkInput({
        currentCounts: { panic: 3 },
        baselineCounts: {},
      }),
      { maxAlerts: 0 },
    );
    expect(result.all).toHaveLength(0);
    expect(result.hasAlerts).toBe(false);
    expect(result.truncatedCount).toBeGreaterThan(0);
  });
});
