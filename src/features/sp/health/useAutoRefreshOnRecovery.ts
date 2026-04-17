import { useEffect } from 'react';
import { subscribeSpHealthSignal } from './spHealthSignalStore';

/**
 * useAutoRefreshOnRecovery
 * 
 * 接続状態（Health Signal）が解消（null）された際に、
 * 自動的に指定した関数（再取得ロジック等）を実行する。
 * Step 3: Readiness Linkage の中核ロジック。
 */
export function useAutoRefreshOnRecovery(refreshFn: () => void | Promise<void>) {
  useEffect(() => {
    return subscribeSpHealthSignal((signal) => {
      if (signal === null) {
        void refreshFn();
      }
    });
  }, [refreshFn]);
}
