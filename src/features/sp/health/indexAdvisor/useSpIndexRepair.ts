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

    // シーケンシャルに1件ずつ実行
    for (const action of plan.actions) {
      let retryCount = 0;
      const MAX_RETRIES = 2;
      let success = false;

      while (retryCount <= MAX_RETRIES && !success) {
        if (retryCount > 0) {
          // リトライ時は少し長めに待機 (3s, 6s...)
          await new Promise(resolve => setTimeout(resolve, 3000 * retryCount));
        }

        const res = await executeRepairAction(sp, action);
        
        if (res.status === 'success') {
          newResults.push(res);
          success = true;
        } else if (res.errorDetail?.includes('429') || res.errorDetail?.includes('throttled')) {
          retryCount++;
          if (retryCount > MAX_RETRIES) {
            newResults.push(res);
          }
        } else {
          // 429 以外のエラーは即座に失敗として記録
          newResults.push(res);
          break;
        }
        
        // リアクティブに途中経過を反映
        setResults([...newResults]);
      }

      // API 負荷軽減のため、次のアクションの前に 3秒待機（特に大量のインデックス一括削除時）
      if (plan.actions.indexOf(action) < plan.actions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
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
