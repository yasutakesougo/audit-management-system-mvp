import { SelfHealingAggregate } from './selfHealingNormalization';

export type ActionLevel = 'notice' | 'recommendation' | 'escalation';

export type ActionReasonCode = 
  | 'repeated_success' 
  | 'repeated_skip_limit' 
  | 'persistent_remediation';

export interface SelfHealingAction {
  id: string;
  resourceKey: string;
  fieldKey?: string;
  level: ActionLevel;
  reasonCode: ActionReasonCode;
  title: string;
  description: string;
  primaryActionLabel?: string;
  suggestedRoute?: string;
}

/**
 * 集計データから推奨アクションを生成する (Strongest one per resource)
 */
export function generateRemediationActions(
  aggregates: SelfHealingAggregate[],
): SelfHealingAction[] {
  const actions: SelfHealingAction[] = [];

  aggregates.forEach((agg) => {
    const action = evaluateResourceActions(agg);
    if (action) {
      actions.push(action);
    }
  });

  return actions;
}

function evaluateResourceActions(agg: SelfHealingAggregate): SelfHealingAction | null {
  const { resourceKey, fieldKey, successCount, skipCount, repeatedSkipCount, lastOutcome } = agg;
  const baseId = `${resourceKey}|${fieldKey || ''}`;

  // 1. Escalation (Strongest)
  // 3回連続スキップ、または合計3回スキップかつ最新もスキップ
  if (repeatedSkipCount >= 3 || (skipCount >= 3 && lastOutcome === 'skipped_limit')) {
    return {
      id: `${baseId}|escalation`,
      resourceKey,
      fieldKey,
      level: 'escalation',
      reasonCode: 'repeated_skip_limit',
      title: '自動修復の限界到達',
      description: 'インデックス上限（20件）により、継続的に修復がスキップされています。不要なインデックスの手動整理が必要です。',
      primaryActionLabel: 'インデックスを確認する',
    };
  }

  // 2. Recommendation
  // 5回以上繰り返し修復されている
  if (successCount >= 5) {
    return {
      id: `${baseId}|recommendation`,
      resourceKey,
      fieldKey,
      level: 'recommendation',
      reasonCode: 'persistent_remediation',
      title: '設計見直しの推奨',
      description: '修復が定常化しています。本来不要な列がインデックス対象に含まれていないか、設計を再確認してください。',
      primaryActionLabel: '設計を確認する',
    };
  }

  // 3. Notice
  // 3回以上繰り返し修復されている
  if (successCount >= 3) {
    return {
      id: `${baseId}|notice`,
      resourceKey,
      fieldKey,
      level: 'notice',
      reasonCode: 'repeated_success',
      title: '頻繁な再修復の検知',
      description: 'この項目は頻繁に再修復されています。外部要因による設定の巻き戻りがないか注意してください。',
    };
  }

  return null;
}
