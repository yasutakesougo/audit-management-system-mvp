import { type IndexFieldSpec } from './spIndexKnownConfig';
import { type SpIndexedField } from './spIndexLogic';

/**
 * インデックス修復アクションの型
 */
export type SpIndexRepairActionType = 'create' | 'delete';

/**
 * 修復アクションの定義
 */
export interface SpIndexRepairAction {
  type: SpIndexRepairActionType;
  listName: string;
  internalName: string;
  displayName: string;
  reason: string;
  risk?: string;
  expectedBenefit?: string;
}

/**
 * 修復計画のサマリー
 */
export interface SpIndexRepairPlan {
  actions: SpIndexRepairAction[];
  summary: {
    toCreate: number;
    toDelete: number;
    total: number;
  };
}

/**
 * 現在の候補（Addition/Deletion）から修復計画を生成する
 */
export function createIndexRepairPlan(
  listName: string,
  additionCandidates: IndexFieldSpec[],
  deletionCandidates: SpIndexedField[]
): SpIndexRepairPlan {
  const actions: SpIndexRepairAction[] = [
    ...additionCandidates.map(f => ({
      type: 'create' as const,
      listName,
      internalName: f.internalName,
      displayName: f.displayName,
      reason: f.reason,
      risk: '既存データへの影響はありませんが、リストサイズが大きい場合は完了まで時間がかかることがあります。',
      expectedBenefit: '5,000件上限エラーの解消、および対象列を用いたフィルタリング/ソートの高速化。'
    })),
    ...deletionCandidates.map(f => ({
      type: 'delete' as const,
      listName,
      internalName: f.internalName,
      displayName: f.displayName,
      reason: f.deletionReason || '不必要なインデックスです。',
      risk: 'もし外部ツールや Power Automate 等でこの列を直接フィルタリングしている場合、その処理が失敗する可能性があります。',
      expectedBenefit: '書き込み（保存）パフォーマンスの向上、およびインデックス制限枠（20個）の節約。'
    }))
  ];

  return {
    actions,
    summary: {
      toCreate: additionCandidates.length,
      toDelete: deletionCandidates.length,
      total: actions.length
    }
  };
}
