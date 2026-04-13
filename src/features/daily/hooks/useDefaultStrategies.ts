/**
 * useDefaultStrategies — 直近記録から戦略の初期選択を導出する hook
 *
 * RecordInputStep に組み込み、Step 3 を開いたとき
 * 同一ユーザーの直近1件の記録から実施済み戦略を取得し、
 * StrategyChipBar の初期 Set を返す。
 *
 * 設計方針:
 *   - userId が変わったら再取得
 *   - リポジトリ取得は最大1件に制限（パフォーマンス）
 *   - 取得エラーは握りつぶして空 Set を返す（UX 優先）
 *   - コンポーネント側でリセット管理（保存後は呼び出し元が `new Set()` で上書き）
 */
import { useState, useEffect, useRef } from 'react';
import { deriveDefaultStrategies, type DeriveDefaultResult, type StrategyChipKey } from '@/features/daily/domain/deriveDefaultStrategies';
import { getABCRecordsForUser } from '@/features/ibd/core/ibdStore';

export interface UseDefaultStrategiesResult {
  /** 初期選択すべき戦略キーの Set */
  defaultKeys: Set<StrategyChipKey>;
  /** 由来ラベル（表示用） */
  sourceLabel: string | null;
  /** 読み込み中フラグ */
  loading: boolean;
  /** 取得完了フラグ（true になったら初期値適用可能） */
  resolved: boolean;
}

const EMPTY_RESULT: DeriveDefaultResult = { defaultKeys: new Set(), sourceLabel: null };

export function useDefaultStrategies(userId: string | undefined): UseDefaultStrategiesResult {
  const [result, setResult] = useState<DeriveDefaultResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState(false);
  const prevUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    // userId が変わったらリセット
    if (prevUserId.current !== userId) {
      setResolved(false);
    }
    prevUserId.current = userId;

    if (!userId) {
      setResult(EMPTY_RESULT);
      setResolved(true);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchDefault = async () => {
      try {
        // B（BehaviorObservationRepository）を正本導線として参照
        // 移行期につき B only とし、Daily BehaviorRepository (A) への fallback は行わない
        const records = getABCRecordsForUser(userId);

        if (cancelled) return;
        const derived = deriveDefaultStrategies(records);
        setResult(derived);
      } catch {
        // 取得失敗はサイレントに無視（空 Set）
        if (!cancelled) setResult(EMPTY_RESULT);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setResolved(true);
        }
      }
    };

    fetchDefault();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    defaultKeys: result.defaultKeys,
    sourceLabel: result.sourceLabel,
    loading,
    resolved,
  };
}
