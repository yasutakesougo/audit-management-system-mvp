/**
 * useOperationFlowConfig — Repository から設定配列を読み込む React フック
 *
 * 設計方針:
 *   - 初回マウント時に getAll() で設定を取得
 *   - ロード中・エラー時は DEFAULT_PHASE_CONFIG にフォールバック
 *   - 設定画面で saveAll() → invalidate() すれば最新値に反映
 *   - Repository の実装（InMemory / SharePoint）を意識しない
 *
 * @module features/operationFlow/hooks/useOperationFlowConfig
 */

import { useCallback, useEffect, useState } from 'react';
import { createOperationalPhaseRepository } from '../data/createOperationalPhaseRepository';
import { DEFAULT_PHASE_CONFIG } from '../domain/defaultPhaseConfig';
import type { OperationFlowPhaseConfig } from '../domain/operationFlowTypes';
import { PHASE_EVENTS, recordPhaseEvent } from '../telemetry/recordPhaseEvent';

export interface OperationFlowConfigResult {
  /** 現在の設定配列（ロード前は DEFAULT_PHASE_CONFIG） */
  config: readonly OperationFlowPhaseConfig[];
  /** ロード完了したか */
  loaded: boolean;
  /** ロードエラー（あれば） */
  error: Error | null;
  /** 設定を再読み込みする（saveAll 後に呼ぶ） */
  invalidate: () => void;
}

/**
 * フェーズ設定配列を取得するフック
 *
 * - 初回マウントで Repository.getAll() を呼ぶ
 * - ロード失敗時は DEFAULT_PHASE_CONFIG を使い続ける（画面は壊れない）
 * - invalidate() で再フェッチ
 */
export function useOperationFlowConfig(): OperationFlowConfigResult {
  const [config, setConfig] = useState<readonly OperationFlowPhaseConfig[]>(DEFAULT_PHASE_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const repo = createOperationalPhaseRepository();

    repo
      .getAll()
      .then((data) => {
        if (!cancelled) {
          setConfig(data.length > 0 ? data : DEFAULT_PHASE_CONFIG);
          setLoaded(true);
          setError(null);
          // ── 観測: 空配列フォールバック ──
          if (data.length === 0) {
            recordPhaseEvent({
              event: PHASE_EVENTS.CONFIG_FALLBACK,
              reason: 'empty-config',
            });
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // フォールバック: デフォルト値を維持
          setConfig(DEFAULT_PHASE_CONFIG);
          setLoaded(true);
          setError(err instanceof Error ? err : new Error(String(err)));
          console.warn('[useOperationFlowConfig] フォールバック使用:', err);
          // ── 観測: フォールバックイベント ──
          recordPhaseEvent({
            event: PHASE_EVENTS.CONFIG_FALLBACK,
            reason: 'repository-error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const invalidate = useCallback(() => {
    setRevision((r) => r + 1);
  }, []);

  return { config, loaded, error, invalidate };
}
