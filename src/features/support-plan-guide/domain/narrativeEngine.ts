/**
 * 根拠（エビデンス）のソース
 */
export type EvidenceSourceType = 
  | 'summary_kpi'    // KPI（停滞日数等）
  | 'diff_goal'      // 目標の変更
  | 'diff_safety'    // 安全更新
  | 'guidance_item'  // ガイダンス判定
  | 'iceberg_finding' // 背景（観察・仮説等）
  | 'manual_field';   // 特定の入力フィールド

export interface NarrativeEvidence {
  sourceType: EvidenceSourceType;
  label: string;      // 表示用ラベル（例: "停滞日数: 90日"）
  value?: any;        // 実際の生データ
}

export interface NarrativeSection {
  text: string;
  evidence: NarrativeEvidence[];
}

/**
 * 支援計画の分析結果から、ナラティブ（説明文）を生成するためのインターフェース
 */
export interface SupportPlanNarrative {
  /** 計画の現状に関する要約文 */
  summary: NarrativeSection;
  /** 判定の根拠や変化点に関する詳細文 */
  details: NarrativeSection[];
  /** 最終的なレコメンデーション */
  conclusion: NarrativeSection;
  /** 生成方式のメタデータ（'template' | 'ai'） */
  generatedBy: 'template' | 'ai';
}

export function buildGuidanceNarrative(
  summary: SupportPlanTimelineSummary,
  guidance: SupportPlanGuidance,
  currentDiff: SupportPlanDiff | null,
  icebergItems: IcebergPdcaItem[] = []
): SupportPlanNarrative {
  // 1. サマリセクション
  let summaryText = `本支援計画は、第${summary.totalVersions}世代として構成されています。`;
  const summaryEvidence: NarrativeEvidence[] = [
    { sourceType: 'summary_kpi', label: `通算バージョン: ${summary.totalVersions}` }
  ];

  if (summary.stagnantSince) {
    const days = Math.floor((new Date().getTime() - new Date(summary.stagnantSince).getTime()) / (1000 * 60 * 60 * 24));
    summaryText += `最終的な構造的変更から約${days}日が経過しており、生活環境や本人の状態に新たな変化がないか、再アセスメントが推奨される時期です。`;
    summaryEvidence.push({ sourceType: 'summary_kpi', label: `停滞期間: ${days}日`, value: summary.stagnantSince });
  } else {
    summaryText += `直近の記録において計画の更新が継続的に行われており、PDCAサイクルが正常に機能しています。`;
  }

  // 2. 詳細セクション
  const details: NarrativeSection[] = [];
  
  // ガイダンスから抽出
  guidance.items.forEach(item => {
    if (item.severity === 'critical' || item.severity === 'warn') {
      details.push({
        text: item.message,
        evidence: [{ sourceType: 'guidance_item', label: item.actionLabel, value: item }]
      });
    }
  });

  // Diff から具体的な変化を抽出
  if (currentDiff) {
    if (currentDiff.isStructuralChange) {
      const addedGoals = currentDiff.goals.added.length;
      const removedGoals = currentDiff.goals.removed.length;
      if (addedGoals > 0 || removedGoals > 0) {
        details.push({
          text: `今回のドラフトでは長期・短期目標に構造的な変更（追加:${addedGoals}件 / 削除:${removedGoals}件）が含まれており、支援の方向性が調整されています。`,
          evidence: [
            { sourceType: 'diff_goal', label: `目標追加: ${addedGoals}件` },
            { sourceType: 'diff_goal', label: `目標削除: ${removedGoals}件` }
          ]
        });
      }
    }
    
    if (currentDiff.isCriticalSafetyUpdate) {
      details.push({
        text: `リスク管理・留意事項に重要な更新があります。現場での支援手順への反映と周知を優先してください。`,
        evidence: [{ sourceType: 'diff_safety', label: '重要安全項目更新あり' }]
      });
    }
  }

  // 4. 背景データ (Iceberg) の注入
  const recentFindings = icebergItems
    .filter(item => item.phase === 'PLAN' || item.phase === 'CHECK')
    .slice(0, 2);

  recentFindings.forEach(finding => {
    details.push({
      text: `背景分析（Iceberg）において『${finding.title}』が特定されており、本計画での対策状況を確認してください。`,
      evidence: [{ sourceType: 'iceberg_finding', label: `分析: ${finding.title}`, value: finding }]
    });
  });

  // 5. 結論セクション
  let conclusionText = '現在の計画の妥当性をモニタリング会議等で共有し、必要に応じて承認プロセスを進めてください。';
  if (summary.stagnantSince && guidance.items.some(i => i.severity === 'critical')) {
    conclusionText = '重大な停滞または安全面の更新が必要な可能性があります。期限内にサービス担当者会議を開催し、計画の全体的な見直しを強く推奨します。';
  }

  return {
    summary: { text: summaryText, evidence: summaryEvidence },
    details,
    conclusion: { text: conclusionText, evidence: [] },
    generatedBy: 'template',
  };
}

/**
 * ナラティブをプレーンテキストのパラグラフとして構築するユーティリティ
 */
export function formatNarrativeAsParagraph(narrative: SupportPlanNarrative): string {
  const detailTexts = narrative.details.map(d => `・${d.text}`).join('\n');
  
  return `${narrative.summary.text}\n${detailTexts}\n\n結論: ${narrative.conclusion.text}`;
}
