import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import type { ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';
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

/**
 * Iceberg import の出典参照（pure data、副作用なし）。
 * importAuditStore へ渡すための取込メタデータを保持する。
 */
export interface IcebergSourceRef {
  /** 氷山セッション ID */
  sessionId: string;
  /** セッション最終更新日時（ISO 8601） */
  sessionUpdatedAt: string;
  /** 取込実行日時（ISO 8601） */
  importedAt: string;
  /** 抽出した行動ノード ID 一覧 */
  behaviorNodeIds: string[];
  /** 反映先フィールド一覧（importAuditRecord.affectedFields に使用） */
  affectedFields: string[];
}

export interface IcebergImportResult {
  formPatches: Partial<FormState>;
  summary: {
    behaviorCount: number;
    triggerCount: number;
    environmentFactorCount: number;
    strategyCount: number;
  };
  /**
   * フィールド変換の根拠一覧（assessmentBridge と同形式）。
   * sessionRef を渡した場合に生成される。省略時は空配列。
   */
  provenance: ProvenanceEntry[];
  /**
   * 取込元の Iceberg セッション参照情報。
   * sessionRef を渡した場合に生成される。省略時は null。
   */
  sourceRef: IcebergSourceRef | null;
}

/**
 * BehaviorInterventionPlan[] を IcebergImportResult に変換する。
 *
 * @param drafts - icebergToInterventionDrafts() が返す BIP Draft 群
 * @param sessionRef - 取込元の Iceberg セッション参照（任意）。
 *   指定した場合のみ provenance と sourceRef が生成される。
 *   省略時は後方互換（provenance: [], sourceRef: null）。
 */
export function buildIcebergImportResult(
  drafts: BehaviorInterventionPlan[],
  sessionRef?: Pick<{ id: string; updatedAt: string }, 'id' | 'updatedAt'>,
): IcebergImportResult {
  const patches = icebergToPlanningBridge(drafts);
  const now = new Date().toISOString();

  const allFactorLabels = drafts.flatMap(d => d.triggerFactors.map(t => t.label));
  const triggers = allFactorLabels.filter(l => classifyTriggerFactor(l) === 'trigger');
  const environments = allFactorLabels.filter(l => classifyTriggerFactor(l) === 'environment');

  const strategyInputs = drafts.flatMap(d => [
    d.strategies.prevention,
    d.strategies.alternative,
    d.strategies.reactive,
  ]).filter(Boolean);

  const summary = {
    behaviorCount: drafts.length,
    triggerCount: uniqueLabels(triggers).length,
    environmentFactorCount: uniqueLabels(environments).length,
    strategyCount: uniqueLabels(strategyInputs).length,
  };

  // sessionRef が省略された場合は後方互換の最小値を返す
  if (!sessionRef) {
    return { formPatches: patches, summary, provenance: [], sourceRef: null };
  }

  // ---------------------------------------------------------------------------
  // Provenance 生成（sessionRef あり）
  // ---------------------------------------------------------------------------

  const provenance: ProvenanceEntry[] = [];
  const affectedFields: string[] = [];
  const sessionLabel = `氷山分析セッション（${sessionRef.id}）`;

  const firstDraft = drafts[0];

  // targetBehavior / icebergSurface
  if (firstDraft && firstDraft.targetBehavior) {
    provenance.push({
      field: 'targetBehavior',
      source: 'iceberg_session',
      sourceLabel: sessionLabel,
      reason: `行動ノード「${firstDraft.targetBehavior}」を targetBehavior にマッピング`,
      value: firstDraft.targetBehavior,
      importedAt: now,
    });
    provenance.push({
      field: 'icebergSurface',
      source: 'iceberg_session',
      sourceLabel: sessionLabel,
      reason: `行動ノード「${firstDraft.targetBehavior}」を icebergSurface にマッピング`,
      value: firstDraft.targetBehavior,
      importedAt: now,
    });
    affectedFields.push('targetBehavior', 'icebergSurface');
  }

  // triggers
  const dedupedTriggers = uniqueLabels(triggers);
  if (dedupedTriggers.length > 0) {
    provenance.push({
      field: 'triggers',
      source: 'iceberg_session',
      sourceLabel: sessionLabel,
      reason: `行動トリガー ${dedupedTriggers.length}件を triggers にマッピング`,
      value: dedupedTriggers.join(', '),
      importedAt: now,
    });
    affectedFields.push('triggers');
  }

  // environmentFactors
  const dedupedEnvs = uniqueLabels(environments);
  if (dedupedEnvs.length > 0) {
    provenance.push({
      field: 'environmentFactors',
      source: 'iceberg_session',
      sourceLabel: sessionLabel,
      reason: `環境因子 ${dedupedEnvs.length}件を environmentFactors にマッピング`,
      value: dedupedEnvs.join(', '),
      importedAt: now,
    });
    affectedFields.push('environmentFactors');
  }

  // environmentalAdjustment（§5 予防的支援）
  const dedupedPrevention = uniqueLabels(drafts.map(d => d.strategies.prevention).filter(Boolean));
  if (dedupedPrevention.length > 0) {
    provenance.push({
      field: 'environmentalAdjustment',
      source: 'iceberg_session',
      sourceLabel: sessionLabel,
      reason: `予防戦略 ${dedupedPrevention.length}件を environmentalAdjustment にマッピング`,
      value: dedupedPrevention.join(', '),
      importedAt: now,
    });
    affectedFields.push('environmentalAdjustment');
  }

  // teachingMethod（§6 代替行動）
  const dedupedAlternative = uniqueLabels(drafts.map(d => d.strategies.alternative).filter(Boolean));
  if (dedupedAlternative.length > 0) {
    provenance.push({
      field: 'teachingMethod',
      source: 'iceberg_session',
      sourceLabel: sessionLabel,
      reason: `代替行動戦略 ${dedupedAlternative.length}件を teachingMethod にマッピング`,
      value: dedupedAlternative.join(', '),
      importedAt: now,
    });
    affectedFields.push('teachingMethod');
  }

  // initialResponse / staffResponse（§7 問題行動時対応）
  const dedupedReactive = uniqueLabels(drafts.map(d => d.strategies.reactive).filter(Boolean));
  if (dedupedReactive.length > 0) {
    provenance.push(
      {
        field: 'initialResponse',
        source: 'iceberg_session',
        sourceLabel: sessionLabel,
        reason: `事後対応戦略 ${dedupedReactive.length}件を initialResponse にマッピング`,
        value: dedupedReactive.join(', '),
        importedAt: now,
      },
      {
        field: 'staffResponse',
        source: 'iceberg_session',
        sourceLabel: sessionLabel,
        reason: `事後対応戦略 ${dedupedReactive.length}件を staffResponse にマッピング（initialResponse と同値）`,
        value: dedupedReactive.join(', '),
        importedAt: now,
      },
    );
    affectedFields.push('initialResponse', 'staffResponse');
  }

  const sourceRef: IcebergSourceRef = {
    sessionId: sessionRef.id,
    sessionUpdatedAt: sessionRef.updatedAt,
    importedAt: now,
    behaviorNodeIds: drafts.map(d => d.targetBehaviorNodeId),
    affectedFields,
  };

  return { formPatches: patches, summary, provenance, sourceRef };
}
