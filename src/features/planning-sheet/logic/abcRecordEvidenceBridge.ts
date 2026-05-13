import type { AbcRecord } from '@/domain/abc/abcRecord';

export type BuildAbcEvidenceDraftInput = {
  records: AbcRecord[];
  period: {
    from: string;
    to: string;
    isProvisional?: boolean;
  };
};

export type AbcEvidenceEvaluationDraft = {
  evaluationMethod: string;
  improvementResult: string;
  nextSupport: string;
  metadata: {
    totalRecords: number;
    byOrigin: Array<{ label: string; count: number }>;
    byIntensity: Array<{ label: string; count: number }>;
    topAntecedents: Array<{ text: string; count: number }>;
    topBehaviors: Array<{ text: string; count: number }>;
    topConsequences: Array<{ text: string; count: number }>;
    topSlots: Array<{ slotLabel: string; count: number }>;
    riskRecordsCount: number;
  };
};

/**
 * ABC記録の作成元を分かりやすい由来ラベルに変換する
 */
export function getAbcOriginLabel(record: AbcRecord): string {
  const sourceContext = record.sourceContext;
  const source = sourceContext?.source;
  const isKiosk = source === 'standalone' && sourceContext?.returnUrl?.includes('kiosk');

  if (source === 'daily-support') {
    return '支援手順起点';
  } else if (source === 'standalone') {
    if (isKiosk) {
      return 'キオスク・支援手順起点';
    } else {
      return '専用ABC画面起点';
    }
  }
  return '由来不明/旧データ';
}

/**
 * 出現頻度順に集計してソートする汎用ヘルパー
 */
function getTopItems(items: string[], maxCount = 3): Array<{ text: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const trimmed = item ? item.trim() : '';
    if (!trimmed) continue;
    counts[trimmed] = (counts[trimmed] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, maxCount);
}

/**
 * 時間帯スロットを出現頻度順にソートするヘルパー
 */
function getTopSlots(records: AbcRecord[], maxCount = 3): Array<{ slotLabel: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const rec of records) {
    const sourceContext = rec.sourceContext;
    let label = 'その他のABC記録（時間枠なし）';
    if (sourceContext && sourceContext.slotLabel) {
      label = sourceContext.slotLabel;
    } else if (sourceContext && sourceContext.slotId) {
      const parts = sourceContext.slotId.split('|');
      label = parts[1] || parts[0];
    }
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([slotLabel, count]) => ({ slotLabel, count }))
    .sort((a, b) => b.count - a.count || a.slotLabel.localeCompare(b.slotLabel))
    .slice(0, maxCount);
}

/**
 * 期間内のDedicated ABC記録から、支援計画§9評価欄向けの評価ドラフトテキストを自動生成する（Pure Function）
 */
export function buildAbcEvidenceEvaluationDraft(input: BuildAbcEvidenceDraftInput): AbcEvidenceEvaluationDraft {
  const { records, period } = input;

  // 論理削除されているものを除外する
  const validRecords = records.filter(rec => rec.isDeleted !== true);

  // 0件の場合のフォールバック
  if (validRecords.length === 0) {
    const suffixProvisional = period.isProvisional
      ? '\nなお、本評価期間は支援開始日が未確定のため、適用開始日をもとに暫定算出している。'
      : '';

    return {
      evaluationMethod: `対象期間内に評価ドラフト生成に利用できるDedicated ABC記録は確認されていない。${suffixProvisional}`,
      improvementResult: '対象期間内にDedicated ABC記録は確認されていないため、本項目では日々の支援記録や職員の観察を併せて評価する。',
      nextSupport: '必要に応じて、今後の支援場面でABC記録を継続的に蓄積し、次回モニタリング時の評価材料とする。',
      metadata: {
        totalRecords: 0,
        byOrigin: [],
        byIntensity: [
          { label: '重度', count: 0 },
          { label: '中度', count: 0 },
          { label: '軽度', count: 0 }
        ],
        topAntecedents: [],
        topBehaviors: [],
        topConsequences: [],
        topSlots: [],
        riskRecordsCount: 0
      }
    };
  }

  // 1. 各集計処理 (Metadataの生成)
  const totalCount = validRecords.length;

  // 由来別集計
  const originCounts: Record<string, number> = {};
  validRecords.forEach(rec => {
    const label = getAbcOriginLabel(rec);
    originCounts[label] = (originCounts[label] || 0) + 1;
  });
  const byOrigin = Object.entries(originCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // 強度別集計
  const intensityCounts = { high: 0, medium: 0, low: 0 };
  validRecords.forEach(rec => {
    if (rec.intensity === 'high') intensityCounts.high++;
    else if (rec.intensity === 'medium') intensityCounts.medium++;
    else if (rec.intensity === 'low') intensityCounts.low++;
  });
  const byIntensity = [
    { label: '重度', count: intensityCounts.high },
    { label: '中度', count: intensityCounts.medium },
    { label: '軽度', count: intensityCounts.low }
  ];

  // 頻出項目
  const topAntecedents = getTopItems(validRecords.map(r => r.antecedent));
  const topBehaviors = getTopItems(validRecords.map(r => r.behavior));
  const topConsequences = getTopItems(validRecords.map(r => r.consequence));
  const topSlots = getTopSlots(validRecords);

  // 危険行動
  const riskRecordsCount = validRecords.filter(r => r.riskFlag === true).length;

  // 2. evaluationMethod の生成
  const originBreakdown = byOrigin.map(o => `${o.label} ${o.count}件`).join('、');
  const methodText = `評価期間中（${period.from}〜${period.to}）に記録されたDedicated ABC記録（総数${totalCount}件：${originBreakdown}）をもとに、発生場面、行動、先行事象、結果、および強度の推移傾向を確認し、行動変容の量的・質的評価を実施した。`;
  const suffixProvisional = period.isProvisional
    ? '\nなお、本評価期間は支援開始日が未確定のため、適用開始日をもとに暫定算出している。'
    : '';
  const evaluationMethod = `${methodText}${suffixProvisional}`;

  // 3. improvementResult の生成
  const intensityBreakdown = byIntensity.map(i => `${i.label}が${i.count}件`).join('、');
  const primaryBehaviorText = topBehaviors.length > 0
    ? `そのうち、特に確認頻度の高い行動は「${topBehaviors[0].text}」（期間中${topBehaviors[0].count}回）である。`
    : '';
  
  const slotBiasText = topSlots.length > 0
    ? `場面別の記録状況としては、主に「${topSlots[0].slotLabel}」（${topSlots[0].count}件）において記録が多く蓄積されている。`
    : '';

  const riskText = riskRecordsCount > 0
    ? `なお、職員による特別な配慮や注視を要する危険行動（riskFlag）を伴う記録が期間中に${riskRecordsCount}件確認されている。`
    : '';

  const improvementResult = `対象期間中、合計${totalCount}件のDedicated ABC記録が蓄積された。記録の強度分布は${intensityBreakdown}となっている。${primaryBehaviorText}${slotBiasText}
これらの客観的な記録傾向から、支援介入にともなう一時的な行動パターンの偏りや推移が示唆される。記述された先行事象および結果の客観分析により、特定の環境や契機（トリガー）が行動に影響を与えている可能性が示唆されるため、支援方法の有効性を継続して確認する。${riskText}`;

  // 4. nextSupport の生成
  const primaryAntecedent = topAntecedents.length > 0 ? topAntecedents[0].text : '';
  const primaryConsequence = topConsequences.length > 0 ? topConsequences[0].text : '';
  
  let suggestionText = '';
  if (primaryAntecedent || primaryConsequence) {
    const antecedentPart = primaryAntecedent ? `「${primaryAntecedent}」といった先行事象（トリガー）の発生状況や` : '';
    const consequencePart = primaryConsequence ? `行動後の「${primaryConsequence}」におけるかかわり方` : '';
    suggestionText = `今後は、頻出している${antecedentPart}${consequencePart}に着目し、刺激の緩和や一貫したアプローチ手順を整理することが推奨される。`;
  }

  const primarySlot = topSlots.length > 0 ? topSlots[0].slotLabel : '';
  const slotSuggestion = primarySlot && primarySlot !== 'その他のABC記録（時間枠なし）'
    ? `特に記録件数の多い「${primarySlot}」の時間帯においては、先行事象の整理と個別支援手順の適合度合を継続して確認することが望ましい。`
    : '各支援場面において、先行事象（トリガー）の確実な記録および整理を継続する。';

  const riskPrioritySuggestion = (intensityCounts.high > 0 || riskRecordsCount > 0)
    ? '\nまた、重度の行動や危険を伴う行動が確認されているため、該当する時間枠や状況における職員間の初期対応手順（速やかな安全確保・指示出し）の優先確認、および環境調整や介入声かけの見直しを最優先で検討する。'
    : '';

  const nextSupport = `これまでに蓄積された行動観察結果をもとに、特定の時間枠や場面における個別支援手順を継続確認する。${suggestionText}${slotSuggestion}${riskPrioritySuggestion}`;

  return {
    evaluationMethod,
    improvementResult,
    nextSupport,
    metadata: {
      totalRecords: totalCount,
      byOrigin,
      byIntensity,
      topAntecedents,
      topBehaviors,
      topConsequences,
      topSlots,
      riskRecordsCount
    }
  };
}
