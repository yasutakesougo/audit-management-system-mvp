import { describe, expect, it } from 'vitest';
import {
  computeBehaviorTagCrossInsights,
  hasProblemBehavior,
  type CrossInsightInput,
} from '../behavior/behaviorTagCrossInsights';

// ─── ヘルパー ────────────────────────────────────────────

const noPB = {
  selfHarm: false,
  otherInjury: false,
  loudVoice: false,
  pica: false,
  other: false,
};

const withPB = { ...noPB, loudVoice: true };

function row(
  tags: string[],
  pb = noPB,
  am = '',
  pm = '',
): CrossInsightInput {
  return { behaviorTags: tags, problemBehavior: pb, amActivity: am, pmActivity: pm };
}

// ─── hasProblemBehavior ──────────────────────────────────

describe('hasProblemBehavior', () => {
  it('全 false なら false', () => {
    expect(hasProblemBehavior(noPB)).toBe(false);
  });

  it('1 つでも true なら true', () => {
    expect(hasProblemBehavior(withPB)).toBe(true);
  });
});

// ─── computeBehaviorTagCrossInsights ─────────────────────

describe('computeBehaviorTagCrossInsights', () => {
  // ケース 1
  it('空行配列 → null', () => {
    expect(computeBehaviorTagCrossInsights([])).toBeNull();
  });

  // ケース 2
  it('全行タグなし → null', () => {
    const rows = [row([]), row([])];
    expect(computeBehaviorTagCrossInsights(rows)).toBeNull();
  });

  // ケース 3: 基本的な併発率計算
  it('タグ別問題行動併発率を正しく計算する', () => {
    const rows = [
      row(['panic', 'sensory'], withPB),  // panic+問題あり, sensory+問題あり
      row(['panic'], noPB),                // panic+問題なし
      row(['sensory'], withPB),            // sensory+問題あり
    ];
    const result = computeBehaviorTagCrossInsights(rows)!;

    // panic: 2件中1件問題あり → 50%
    const panic = result.tagProblemRates.find(t => t.tagKey === 'panic')!;
    expect(panic.total).toBe(2);
    expect(panic.withProblem).toBe(1);
    expect(panic.rate).toBe(50);

    // sensory: 2件中2件問題あり → 100%
    const sensory = result.tagProblemRates.find(t => t.tagKey === 'sensory')!;
    expect(sensory.total).toBe(2);
    expect(sensory.withProblem).toBe(2);
    expect(sensory.rate).toBe(100);
  });

  // ケース 4: AM のみ活動ありの行 → AM集計に反映
  it('AM活動ありの行が AM Top3 に反映される', () => {
    const rows = [
      row(['panic'], noPB, '運動', ''),
      row(['sensory'], noPB, '作業', ''),
      row(['panic', 'eating'], noPB, '', '自由時間'),
    ];
    const result = computeBehaviorTagCrossInsights(rows)!;
    const am = result.slotTagFrequency.find(s => s.slot === 'am')!;
    const pm = result.slotTagFrequency.find(s => s.slot === 'pm')!;

    expect(am.totalRows).toBe(2);
    expect(am.topTags[0].tagKey).toBe('panic');  // AM で panic が 1 件
    expect(pm.totalRows).toBe(1);
  });

  // ケース 5: 問題行動あり/なし別平均タグ数
  it('問題行動あり/なし別の平均タグ数を計算する', () => {
    const rows = [
      row(['panic', 'sensory', 'eating'], withPB),  // あり: 3
      row(['panic'], withPB),                         // あり: 1 → 平均 2.0
      row(['sensory'], noPB),                         // なし: 1
      row([], noPB),                                  // なし: 0 → 平均 0.5
    ];
    const result = computeBehaviorTagCrossInsights(rows)!;
    expect(result.avgTagsByProblem.withProblem).toBe(2.0);
    expect(result.avgTagsByProblem.withoutProblem).toBe(0.5);
  });

  // ケース 6: problemBehavior が全 false → なし判定
  it('問題行動全 false はなし側にカウント', () => {
    const rows = [row(['panic'], noPB)];
    const result = computeBehaviorTagCrossInsights(rows)!;
    expect(result.avgTagsByProblem.withProblem).toBe(0);
    expect(result.avgTagsByProblem.withoutProblem).toBe(1);
  });

  // ケース 7: tagProblemRates が rate 降順
  it('併発率が高い順にソートされる', () => {
    const rows = [
      row(['panic'], noPB),            // panic: 0%
      row(['sensory'], withPB),        // sensory: 100%
      row(['eating'], withPB),         // eating: 100%（同率なら total 降順）
      row(['eating'], noPB),           // eating: 50%（total=2）
    ];
    const result = computeBehaviorTagCrossInsights(rows)!;
    const rates = result.tagProblemRates.map(t => t.rate);
    // 100, 50, 0
    expect(rates).toEqual([100, 50, 0]);
  });

  // ケース 8: Top3 を超えるタグのスライス
  it('スロット別 Top タグが 3 件以下にスライスされる', () => {
    const rows = [
      row(['panic', 'sensory', 'eating', 'toileting', 'cooperation'], noPB, '活動', ''),
    ];
    const result = computeBehaviorTagCrossInsights(rows)!;
    const am = result.slotTagFrequency.find(s => s.slot === 'am')!;
    expect(am.topTags.length).toBeLessThanOrEqual(3);
  });

  // ケース 9（ユーザー指摘）: AM/PM 両方に値がある行は両方にカウント
  it('AM・PM 両方に活動がある行は両方のスロット集計に入る', () => {
    const rows = [
      row(['panic'], noPB, '作業', '自由時間'),  // AM・PM 両方
      row(['sensory'], noPB, '運動', ''),         // AM のみ
    ];
    const result = computeBehaviorTagCrossInsights(rows)!;
    const am = result.slotTagFrequency.find(s => s.slot === 'am')!;
    const pm = result.slotTagFrequency.find(s => s.slot === 'pm')!;

    // AM: 2行 → panic(1) + sensory(1)
    expect(am.totalRows).toBe(2);
    expect(am.topTags.length).toBe(2);

    // PM: 1行 → panic(1)
    expect(pm.totalRows).toBe(1);
    expect(pm.topTags[0].tagKey).toBe('panic');
    expect(pm.topTags[0].count).toBe(1);
  });
});
