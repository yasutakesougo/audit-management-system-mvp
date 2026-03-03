import { createTokuseiDemoResponses, mapSpRowToTokuseiResponse, type SpTokuseiRawRow, type TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { isDemoModeEnabled } from '@/lib/env';
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

const SURVEY_LIST_TITLE = LIST_CONFIG[ListKeys.SurveyTokusei]?.title ?? 'FormsResponses_Tokusei';

export function useTokuseiSurveyResponses() {
  const sp = useSP();
  const spRef = useRef(sp);
  spRef.current = sp;
  const demoMode = isDemoModeEnabled();
  const [state, setState] = useState<HookState>({ data: [], status: 'idle', error: null });
  const loadedRef = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const currentSp = spRef.current;
      // Build select dynamically from available fields; fallback to static safe list if method missing or fails
      const selectFields = demoMode
        ? (SURVEY_TOKUSEI_SELECT_FIELDS as string[])
        : await (async () => {
            const { buildSurveyTokuseiSelectFields } = await import('../../../sharepoint/fields');
            const getListFieldInternalNames = (currentSp as Partial<UseSP> & {
              getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>;
            }).getListFieldInternalNames;
            if (typeof getListFieldInternalNames !== 'function') {
              return SURVEY_TOKUSEI_SELECT_FIELDS as string[];
            }
            return buildSurveyTokuseiSelectFields(() => getListFieldInternalNames(SURVEY_LIST_TITLE));
          })();

      const responses = demoMode
        ? createTokuseiDemoResponses()
        : await currentSp.listItems<SpTokuseiRawRow>(SURVEY_LIST_TITLE, {
            select: selectFields,
            orderby: `${FIELD_MAP_SURVEY_TOKUSEI.created} desc`,
            top: 200,
            signal,
          }).then((rows) => rows.map(mapSpRowToTokuseiResponse));

      if (signal?.aborted) return;
      setState({ data: responses, status: 'success', error: null });
    } catch (error) {
      if (signal?.aborted) return;
      const fallback = error instanceof Error ? error : new Error('特性アンケートの読込に失敗しました');
      setState((prev) => ({ ...prev, status: 'error', error: fallback }));
    }
  }, [demoMode]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
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
