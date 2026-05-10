import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import type { FormState } from './components/new-form/types';

/**
 * ラベル群を重複排除してトリミングする
 */
function uniqueLabels(items: string[]): string[] {
  return Array.from(new Set(items.map(s => s.trim()).filter(Boolean)));
}

/**
 * 氷山モデルの要因ラベルを「きっかけ(Trigger)」か「環境(Environment)」かに分類する
 */
export function classifyTriggerFactor(label: string): 'trigger' | 'environment' {
  const envKeywords = [
    '場所', '部屋', '環境', '光', '音', '声', '匂い', '感覚',
    '混雑', '人込み', '騒がしい', '明るい', '暗い', '暑い', '寒い',
    '座席', '配置', '視覚', '聴覚', '触覚', '圧迫',
  ];

  const lowerLabel = label.toLowerCase();
  const isEnv = envKeywords.some(kw => lowerLabel.includes(kw));

  return isEnv ? 'environment' : 'trigger';
}

/**
 * 氷山分析の BehaviorInterventionPlan 群を PlanningSheet の FormState にマッピングする。
 * 
 * マッピング方針:
 * - targetBehavior: 最初の行動ノードをセット
 * - triggers: 直接的なきっかけをカンマ区切りで集約
 * - environmentFactors: 場所や感覚などの背景要因をカンマ区切りで集約
 * - strategies: 予防・代替・事後の各戦略を適切なフィールドへ展開
 */
export function icebergToPlanningBridge(drafts: BehaviorInterventionPlan[]): Partial<FormState> {
  if (drafts.length === 0) return {};

  const firstDraft = drafts[0];

  const allFactorLabels = drafts.flatMap(d => d.triggerFactors.map(t => t.label));
  const triggers: string[] = [];
  const environments: string[] = [];

  allFactorLabels.forEach(label => {
    if (classifyTriggerFactor(label) === 'environment') {
      environments.push(label);
    } else {
      triggers.push(label);
    }
  });

  const preventionStrategies = drafts.map(d => d.strategies.prevention);
  const alternativeStrategies = drafts.map(d => d.strategies.alternative);
  const reactiveStrategies = drafts.map(d => d.strategies.reactive);

  return {
    targetBehavior: firstDraft.targetBehavior,
    icebergSurface: firstDraft.targetBehavior, // 氷山分析の「表面」にもセット
    triggers: uniqueLabels(triggers).join(', '),
    environmentFactors: uniqueLabels(environments).join(', '),
    
    // §5 予防的支援
    environmentalAdjustment: uniqueLabels(preventionStrategies).join('\n'),
    
    // §6 代替行動
    desiredBehavior: '', // ここは手動入力が基本だが、文脈的に alternative を教え方に入れる
    teachingMethod: uniqueLabels(alternativeStrategies).join('\n'),
    
    // §7 問題行動時対応
    initialResponse: uniqueLabels(reactiveStrategies).join('\n'),
    // 初期対応と職員対応は現行BIPでは分離できないため、同じ reactive 案を初期値として入れる
    staffResponse: uniqueLabels(reactiveStrategies).join('\n'),
  };
}

export interface IcebergImportResult {
  formPatches: Partial<FormState>;
  summary: {
    behaviorCount: number;
    triggerCount: number;
    environmentFactorCount: number;
    strategyCount: number;
  };
}

export function buildIcebergImportResult(drafts: BehaviorInterventionPlan[]): IcebergImportResult {
  const patches = icebergToPlanningBridge(drafts);
  
  const allFactorLabels = drafts.flatMap(d => d.triggerFactors.map(t => t.label));
  const triggers = allFactorLabels.filter(l => classifyTriggerFactor(l) === 'trigger');
  const environments = allFactorLabels.filter(l => classifyTriggerFactor(l) === 'environment');

  const strategyInputs = drafts.flatMap(d => [
    d.strategies.prevention,
    d.strategies.alternative,
    d.strategies.reactive
  ]).filter(Boolean);

  return {
    formPatches: patches,
    summary: {
      behaviorCount: drafts.length,
      triggerCount: uniqueLabels(triggers).length,
      environmentFactorCount: uniqueLabels(environments).length,
      strategyCount: uniqueLabels(strategyInputs).length,
    }
  };
}
