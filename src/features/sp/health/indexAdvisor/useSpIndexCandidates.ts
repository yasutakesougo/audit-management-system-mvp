/**
 * useSpIndexCandidates — SP リストの現在のインデックス状態を取得し、
 * 削除候補・追加候補を計算する Hook
 *
 * - SP REST: lists/getbytitle('X')/fields?$filter=Indexed eq true
 * - 既知必須フィールドとのデルタで候補を算出
 * - Fail-open: エラー時は error を返すだけでクラッシュしない
 */

import React from 'react';
import { useSP } from '@/lib/spClient';
import { KNOWN_REQUIRED_INDEXED_FIELDS } from './spIndexKnownConfig';
import { 
  calculateIndexDiff, 
  type IndexDiffResult 
} from './spIndexLogic';

export interface SpIndexCandidates extends IndexDiffResult {
  /** このリストの既知必須セットが定義されているか */
  hasKnownConfig: boolean;
  loading: boolean;
  error: string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpIndexCandidates(
  listName: string | undefined,
  reloadKey = 0,
): SpIndexCandidates {
  const sp = useSP();
  const [state, setState] = React.useState<SpIndexCandidates>({
    currentIndexed: [],
    deletionCandidates: [],
    additionCandidates: [],
    hasKnownConfig: false,
    loading: false,
    error: null,
  });

  React.useEffect(() => {
    if (!sp || !listName) return;

    setState((p) => ({ ...p, loading: true, error: null }));

    const doFetch = async () => {
      try {
        const path = `lists/getbytitle('${encodeURIComponent(listName)}')/fields?$filter=Indexed eq true&$select=InternalName,Title,TypeAsString`;
        const res = await sp.spFetch(path);
        const json = await res.json().catch(() => ({ value: [] })) as {
          value?: { InternalName: string; Title: string; TypeAsString: string }[];
        };

        const requiredSet = KNOWN_REQUIRED_INDEXED_FIELDS[listName];
        const hasKnownConfig = Boolean(requiredSet);

        // 判定エンジン (Pure Logic) を呼び出す
        const diff = calculateIndexDiff(json.value ?? [], requiredSet);

        setState({
          ...diff,
          hasKnownConfig,
          loading: false,
          error: null,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((p) => ({ ...p, loading: false, error: msg }));
      }
    };

    doFetch();
  // eslint-disable-line
  }, [sp, listName, reloadKey]);

  return state;
}
