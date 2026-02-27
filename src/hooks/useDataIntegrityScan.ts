import type { ScanProgress, ScanResult, ScanTarget } from '@/lib/dataIntegrityScanner';
import { scanAll } from '@/lib/dataIntegrityScanner';
import { useCallback, useRef, useState } from 'react';

export type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

export interface DataIntegrityScanState {
  status: ScanStatus;
  progress: ScanProgress | null;
  results: ScanResult[];
  error: string | null;
}

/**
 * React hook for batch data integrity scanning.
 *
 * Usage:
 * ```ts
 * const { status, progress, results, startScan, cancelScan } = useDataIntegrityScan();
 *
 * const handleScan = () => {
 *   // fetchData は呼び出し側の責任（Repository 等を通じて取得）
 *   const data = new Map([['users', rawUserItems], ['daily', rawDailyItems]]);
 *   startScan(targets, data);
 * };
 * ```
 */
export function useDataIntegrityScan() {
  const [state, setState] = useState<DataIntegrityScanState>({
    status: 'idle',
    progress: null,
    results: [],
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const startScan = useCallback(
    (targets: ScanTarget[], data: Map<string, unknown[]>) => {
      // Cancel any existing scan
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        status: 'scanning',
        progress: null,
        results: [],
        error: null,
      });

      try {
        const results = scanAll(
          targets,
          data,
          (progress) => {
            setState((prev) => ({ ...prev, progress }));
          },
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setState({
            status: 'done',
            progress: null,
            results,
            error: null,
          });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            progress: null,
            results: [],
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    },
    [],
  );

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({
      ...prev,
      status: 'idle',
      progress: null,
    }));
  }, []);

  return {
    ...state,
    startScan,
    cancelScan,
  };
}
