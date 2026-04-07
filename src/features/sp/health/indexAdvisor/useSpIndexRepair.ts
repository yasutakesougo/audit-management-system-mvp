import React from 'react';
import { useSP } from '@/lib/spClient';
import { 
  createIndexRepairPlan, 
  type SpIndexRepairPlan 
} from './spIndexRepairPlanner';
import { 
  executeRepairAction, 
  type SpIndexRepairResult 
} from './spIndexRepairExecutor';
import { type IndexFieldSpec } from './spIndexKnownConfig';
import { type SpIndexedField } from './spIndexLogic';

export interface UseSpIndexRepair {
  /** 修復計画（Preview）の生成 */
  generatePlan: (listName: string, additions: IndexFieldSpec[], deletions: SpIndexedField[]) => void;
  /** 修復の実行 */
  executeRepair: () => Promise<void>;
  /** 現在の計画 */
  plan: SpIndexRepairPlan | null;
  /** 実行結果 */
  results: SpIndexRepairResult[];
  /** 状態制御 */
  isExecuting: boolean;
  isConfirmed: boolean;
  setConfirmed: (c: boolean) => void;
  /** 全リセット（モーダルを閉じる時など）*/
  reset: () => void;
}

/**
 * SharePoint インデックス修復フローを管理する Hook
 */
export function useSpIndexRepair(): UseSpIndexRepair {
  const sp = useSP();
  const [plan, setPlan] = React.useState<SpIndexRepairPlan | null>(null);
  const [results, setResults] = React.useState<SpIndexRepairResult[]>([]);
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [isConfirmed, setConfirmed] = React.useState(false);

  // 1. 計画生成 (Preview)
  const generatePlan = React.useCallback((
    listName: string, 
    additions: IndexFieldSpec[], 
    deletions: SpIndexedField[]
  ) => {
    const newPlan = createIndexRepairPlan(listName, additions, deletions);
    setPlan(newPlan);
    setResults([]);
    setConfirmed(false);
    setIsExecuting(false);
  }, []);

  // 2. 修復実行 (Execute)
  const executeRepair = React.useCallback(async () => {
    if (!plan || !sp) return;
    
    setIsExecuting(true);
    const newResults: SpIndexRepairResult[] = [];

    // シーケンシャルに1件ずつ実行（安全のため）
    for (const action of plan.actions) {
      const res = await executeRepairAction(sp, action);
      newResults.push(res);
      // リアクティブに途中経過を反映
      setResults([...newResults]);
    }

    setIsExecuting(false);
  }, [plan, sp]);

  // 3. リセット
  const reset = React.useCallback(() => {
    setPlan(null);
    setResults([]);
    setIsExecuting(false);
    setConfirmed(false);
  }, []);

  return {
    generatePlan,
    executeRepair,
    plan,
    results,
    isExecuting,
    isConfirmed,
    setConfirmed,
    reset,
  };
}
