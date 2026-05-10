export interface ReverseBridgeExecutionRecord {
  id?: string;
  date: string;
  status: 'completed' | 'triggered' | 'skipped' | 'unrecorded';
  memo?: string;
  triggeredBipIds?: string[];
}

export interface ReverseBridgeWeeklyObservation {
  id?: string;
  observationDate: string;
  observationContent: string;
  adviceContent?: string;
  observerName?: string;
}

export interface ReverseBridgeInput {
  periodStart: string;
  periodEnd: string;
  executionRecords: ReverseBridgeExecutionRecord[];
  weeklyObservations: ReverseBridgeWeeklyObservation[];
}

export interface ReverseBridgeSuggestion {
  improvementResult: string;
  nextSupport: string;
  evidenceSummary: string;
  stats: {
    procedureCompletionRate: number | null;
    bipActivationRate: number | null;
    recordCount: number;
    observationCount: number;
  };
  confidence: 'high' | 'medium' | 'low' | 'none';

  // Backward-compatibility properties to keep existing UI fully operational and compiled
  completionRate: number;
  bipTriggerRate: number;
  totalRecords: number;
}

/**
 * Normalizes text by removing duplicate whitespaces, tabs, and newlines, and clamps to maxLength.
 */
function normalizeAndClamp(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length > maxLength) {
    return clean.slice(0, maxLength) + '...';
  }
  return clean;
}

/**
 * L3の支援実績（手順実施記録、週次観察）からL2支援計画シート§9（改善結果、次回支援方針）の提案を生成する純関数
 */
export function buildReverseBridgeSuggestions(input: ReverseBridgeInput): ReverseBridgeSuggestion {
  const { periodStart, periodEnd, executionRecords, weeklyObservations } = input;

  // 1. Filter records and observations by date range (inclusive)
  const filteredRecords = executionRecords.filter(
    (r) => r.date >= periodStart && r.date <= periodEnd
  );
  const filteredObservations = weeklyObservations.filter(
    (o) => o.observationDate >= periodStart && o.observationDate <= periodEnd
  );

  // Filter out 'unrecorded' logs for actual rate calculation
  const activeRecords = filteredRecords.filter((r) => r.status !== 'unrecorded');
  const recordCount = activeRecords.length;
  const observationCount = filteredObservations.length;

  // 2. Handle empty records (none)
  if (recordCount === 0) {
    return {
      improvementResult: 'まだ実績記録が存在しないため、自動提案は利用できません。',
      nextSupport: '実績記録がありません。まずは手順の定着と記録の収集を優先してください。',
      evidenceSummary: `対象期間（${periodStart} 〜 ${periodEnd}）内に有効な実績記録がありません。`,
      stats: {
        procedureCompletionRate: null,
        bipActivationRate: null,
        recordCount: 0,
        observationCount,
      },
      confidence: 'none',

      // Backward-compatibility
      completionRate: 0,
      bipTriggerRate: 0,
      totalRecords: 0,
    };
  }

  // 3. Quantitative calculation
  const completedCount = activeRecords.filter((r) => r.status === 'completed').length;
  const triggeredCount = activeRecords.filter((r) => r.status === 'triggered').length;
  const skippedCount = activeRecords.filter((r) => r.status === 'skipped').length;

  const validDenominator = completedCount + triggeredCount + skippedCount;
  const procedureCompletionRate = validDenominator > 0 
    ? Math.round((completedCount / validDenominator) * 100) 
    : 0;
  const bipActivationRate = validDenominator > 0 
    ? Math.round((triggeredCount / validDenominator) * 100) 
    : 0;

  // 4. Determine Confidence
  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
  if (recordCount >= 10) {
    confidence = 'high';
  } else if (recordCount >= 3) {
    confidence = 'medium';
  } else if (recordCount > 0) {
    confidence = 'low';
  }

  // 5. Determine Tone and Templates
  let tone: 'positive' | 'review' | 'neutral' = 'neutral';
  if (procedureCompletionRate >= 90 && bipActivationRate < 10) {
    tone = 'positive';
  } else if (procedureCompletionRate < 50 || bipActivationRate >= 30) {
    tone = 'review';
  }

  let improvementResult = '';
  let nextSupport = '';

  if (tone === 'positive') {
    improvementResult =
      '支援手順の実施率は非常に高い水準（90%以上）を維持しており、行動発生率も10%未満と極めて低水準に抑制されています。想定された環境調整および先行刺激のコントロールが極めて有効に機能しており、ご本人が終日穏やかかつ安定して過ごせている状況が確認できます。';
    nextSupport =
      '1. 現行支援の継続: 現在の支援手順（先行制御・環境調整）が効果を発揮しているため、この関わり方を全スタッフ間で一貫して継続します。\n2. 段階的緩和の検討: 安定した状態が継続するようであれば、次回アセスメント時に、一部環境調整の段階的な緩和や、自発的コミュニケーション手段のさらなる拡充（フェードアウト設計）を検討します。';
  } else if (tone === 'review') {
    improvementResult =
      '支援手順の実施完了率が50%未満に低迷しているか、または行動の発生（BIP発動）が30%以上の高頻度で確認されています。想定された先行制御が現場の実態に合致していないか、手順の実行難易度が高い可能性があります。先行刺激の再評価および仮説の見直しが必要な状況です。';
    nextSupport =
      '1. 手順設計の根本的見直し（仮説の修正）: 記録やアセスメントを元に、実行困難となっている支援手順を簡素化するか、環境調整の強化（トリガーの再特定）を実施します。\n2. 多職種ケースカンファレンスの招集: 発生状況についてチーム間で共通理解を形成し、関わり方の不一致を解消するための緊急カンファレンスを開催します。';
  } else {
    improvementResult =
      '支援手順はおおむね実施されていますが、特定の場面において手順のスキップや散発的な行動発生が認められます。全体的なアプローチは部分的に機能しているものの、状況に応じた柔軟な調整、またはスタッフ間の実践精度の標準化が求められる段階です。';
    nextSupport =
      '1. 手順の微調整と一貫性の担保: 現場メモから不全要因を特定し、手順の表現や実施タイミングの一部マイナー修正（Minor Revision）を行います。\n2. 職員レクチャーの実施: 手順のバラつきを減らすため、全勤務帯での実施方法についてロールプレイやショートレクチャーを実施します。';
  }

  // 6. Generate evidence summary
  const recentMemos = activeRecords
    .map((r) => r.memo)
    .filter(Boolean)
    .reverse()
    .slice(0, 3)
    .map((m) => normalizeAndClamp(m!, 50));

  const recentObservations = filteredObservations
    .sort((a, b) => b.observationDate.localeCompare(a.observationDate))
    .slice(0, 3)
    .map((o) => {
      const content = normalizeAndClamp(o.observationContent, 50);
      return `[${o.observationDate}] ${content}`;
    });

  const memoSec = recentMemos.length > 0
    ? recentMemos.map((m) => `  - ${m}`).join('\n')
    : '  - （現場記録メモの記述はありません）';

  const obsSec = recentObservations.length > 0
    ? recentObservations.map((o) => `  - ${o}`).join('\n')
    : '  - （週次観察アセスメントの記述はありません）';

  const evidenceSummary = `【期間】${periodStart} 〜 ${periodEnd}
・有効実績記録: ${recordCount}件
・週次観察データ: ${observationCount}件

■ 直近の現場記録メモ:
${memoSec}

■ 直近 of 週次観察アセスメント:
${obsSec}`;

  return {
    improvementResult,
    nextSupport,
    evidenceSummary,
    stats: {
      procedureCompletionRate,
      bipActivationRate,
      recordCount,
      observationCount,
    },
    confidence,

    // Backward-compatibility
    completionRate: procedureCompletionRate,
    bipTriggerRate: bipActivationRate,
    totalRecords: recordCount,
  };
}
