import { useState, useCallback } from 'react';
import { useSP } from '@/lib/spClient';
import { DriftRepairDispatcher } from '../infra/DriftRepairDispatcher';
import type { RepairActionKind } from '../domain/driftRepairProposal';
import { usePersistentDrift } from './usePersistentDrift';

export interface RepairState {
  isRepairing: boolean;
  lastError: string | null;
  lastSuccessMessage: string | null;
}

/**
 * ドリフトの自動修復を実行するためのフック
 */
export function useDriftRepair() {
  const sp = useSP();
  const { refetch } = usePersistentDrift(); // 修復後に再取得するため
  const [state, setState] = useState<RepairState>({
    isRepairing: false,
    lastError: null,
    lastSuccessMessage: null,
  });

  const repair = useCallback(async (
    kind: RepairActionKind,
    listName: string,
    fieldName: string
  ) => {
    if (!sp) return;

    setState(prev => ({ ...prev, isRepairing: true, lastError: null, lastSuccessMessage: null }));
    
    try {
      const dispatcher = new DriftRepairDispatcher(sp.spFetch);
      const result = await dispatcher.dispatch(kind, listName, fieldName);

      if (result.success) {
        setState(prev => ({ ...prev, lastSuccessMessage: result.message }));
        // 成功したら一覧を再読み込み
        if (result.reScanRequired) {
          await refetch();
        }
      } else {
        setState(prev => ({ ...prev, lastError: result.message }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, lastError: msg }));
    } finally {
      setState(prev => ({ ...prev, isRepairing: false }));
    }
  }, [sp, refetch]);

  return {
    ...state,
    repair,
  };
}
