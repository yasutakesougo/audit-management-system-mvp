import { createTokuseiDemoResponses, mapSpRowToTokuseiResponse, type SpTokuseiRawRow, type TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { isDemoModeEnabled, shouldSkipSharePoint } from '@/lib/env';
import { getActiveProviderType } from '@/lib/data/createDataProvider';
import type { UseSP } from '@/lib/spClient';
import { useSP } from '@/lib/spClient';
import { FIELD_MAP_SURVEY_TOKUSEI, LIST_CONFIG, ListKeys, SURVEY_TOKUSEI_SELECT_FIELDS } from '@/sharepoint/fields';
import { useCallback, useEffect, useRef, useState } from 'react';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

type HookState = {
  data: TokuseiSurveyResponse[];
  status: LoadState;
  error: Error | null;
};

const LIST_LEGACY = LIST_CONFIG[ListKeys.SurveyTokusei]?.title ?? 'FormsResponses_Tokusei';
const LIST_V2 = LIST_CONFIG[ListKeys.SurveyTokuseiV2]?.title ?? 'List2';

export function useTokuseiSurveyResponses() {
  const sp = useSP();
  const spRef = useRef(sp);
  spRef.current = sp;
  const demoMode = isDemoModeEnabled();
  const skipSp = shouldSkipSharePoint();
  const [state, setState] = useState<HookState>({ data: [], status: 'idle', error: null });

  const load = useCallback(async (signal?: AbortSignal) => {
    const activeType = getActiveProviderType();
    if (demoMode || skipSp || activeType === 'memory') {
      setState({ data: createTokuseiDemoResponses(), status: 'success', error: null });
      return;
    }

    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const currentSp = spRef.current;

      // ヘルパー: 指定されたリストから回答を読み込む
      const fetchFromList = async (listTitle: string): Promise<TokuseiSurveyResponse[]> => {
        try {
          const { resolveSurveyTokuseiFields } = await import('../../../sharepoint/fields/surveyTokuseiFields');
          const getListFieldInternalNames = (currentSp as Partial<UseSP> & {
            getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>;
          }).getListFieldInternalNames;

          const resolved = typeof getListFieldInternalNames === 'function'
            ? await resolveSurveyTokuseiFields(() => getListFieldInternalNames(listTitle))
            : { select: SURVEY_TOKUSEI_SELECT_FIELDS as string[], mapping: FIELD_MAP_SURVEY_TOKUSEI };

          const rows = await currentSp.listItems<SpTokuseiRawRow>(listTitle, {
            select: resolved.select,
            orderby: `Created desc`,
            top: 200,
            signal,
          });
          return rows.map((row) => mapSpRowToTokuseiResponse(row, resolved.mapping));
        } catch (e) {
          console.warn(`[useTokuseiSurveyResponses] List "${listTitle}" load failed:`, e);
          return []; // 片方のリストがなくても続行
        }
      };

      // 1. レガシーリストと V2 リストの両方から取得（並列）
      const [legacyResponses, v2Responses] = await Promise.all([
        fetchFromList(LIST_LEGACY),
        fetchFromList(LIST_V2)
      ]);

      if (signal?.aborted) return;

      // 2. 統合して作成日時順にソート
      const combined = [...v2Responses, ...legacyResponses]
        .sort((a, b) => {
          const dateA = a.createdAt || a.fillDate || '';
          const dateB = b.createdAt || b.fillDate || '';
          return dateB.localeCompare(dateA);
        })
        // 重複排除 (responseId がある場合)
        .filter((val, index, self) => 
          !val.responseId || self.findIndex(v => v.responseId === val.responseId) === index
        );

      setState({ data: combined, status: 'success', error: null });
    } catch (error) {
      if (signal?.aborted) return;
      const fallback = error instanceof Error ? error : new Error('特性アンケートの読込に失敗しました');
      setState((prev) => ({ ...prev, status: 'error', error: fallback }));
    }
  }, [demoMode]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    data: state.data,
    responses: state.data,
    status: state.status,
    error: state.error,
    refresh,
  } as const;
}
