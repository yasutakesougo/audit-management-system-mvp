import { createTokuseiDemoResponses, type TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { isDemoModeEnabled } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { FIELD_MAP_SURVEY_TOKUSEI, LIST_CONFIG, ListKeys, SURVEY_TOKUSEI_SELECT_FIELDS } from '@/sharepoint/fields';
import { useCallback, useEffect, useState } from 'react';

type SharePointTokuseiRow = {
  [FIELD_MAP_SURVEY_TOKUSEI.id]: number;
  [FIELD_MAP_SURVEY_TOKUSEI.responseId]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.responderEmail]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.responderName]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.fillDate]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.targetUserName]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.guardianName]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.relation]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.heightCm]?: string | number | null;
  [FIELD_MAP_SURVEY_TOKUSEI.weightKg]?: string | number | null;
  [FIELD_MAP_SURVEY_TOKUSEI.personality]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.sensoryFeatures]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.behaviorFeatures]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.preferences]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.strengths]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.notes]?: string;
  [FIELD_MAP_SURVEY_TOKUSEI.created]?: string;
};

type LoadState = 'idle' | 'loading' | 'success' | 'error';

type HookState = {
  data: TokuseiSurveyResponse[];
  status: LoadState;
  error: Error | null;
};

const SURVEY_LIST_TITLE = LIST_CONFIG[ListKeys.SurveyTokusei]?.title ?? 'FormsResponses_Tokusei';

const sanitizeString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const sanitizeOptionalString = (value: unknown): string | undefined => {
  const normalized = sanitizeString(value);
  return normalized ? normalized : undefined;
};

const parseNumericField = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]/g, '').trim();
    if (!normalized) return null;
    const numeric = Number.parseFloat(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const mapRowToResponse = (row: SharePointTokuseiRow): TokuseiSurveyResponse => {
  const idRaw = row[FIELD_MAP_SURVEY_TOKUSEI.id];
  const id = typeof idRaw === 'number' && Number.isFinite(idRaw) ? idRaw : 0;

  return {
    id,
    responseId: sanitizeString(row[FIELD_MAP_SURVEY_TOKUSEI.responseId] ?? ''),
    responderName: sanitizeString(row[FIELD_MAP_SURVEY_TOKUSEI.responderName] ?? ''),
    responderEmail: sanitizeOptionalString(row[FIELD_MAP_SURVEY_TOKUSEI.responderEmail]),
    fillDate: sanitizeString(row[FIELD_MAP_SURVEY_TOKUSEI.fillDate] ?? row[FIELD_MAP_SURVEY_TOKUSEI.created] ?? ''),
    targetUserName: sanitizeString(row[FIELD_MAP_SURVEY_TOKUSEI.targetUserName] ?? ''),
    guardianName: sanitizeOptionalString(row[FIELD_MAP_SURVEY_TOKUSEI.guardianName]),
    relation: sanitizeOptionalString(row[FIELD_MAP_SURVEY_TOKUSEI.relation]),
    heightCm: parseNumericField(row[FIELD_MAP_SURVEY_TOKUSEI.heightCm]),
    weightKg: parseNumericField(row[FIELD_MAP_SURVEY_TOKUSEI.weightKg]),
    personality: sanitizeOptionalString(row[FIELD_MAP_SURVEY_TOKUSEI.personality]),
    sensoryFeatures: sanitizeOptionalString(row[FIELD_MAP_SURVEY_TOKUSEI.sensoryFeatures]),
    behaviorFeatures: sanitizeOptionalString(row[FIELD_MAP_SURVEY_TOKUSEI.behaviorFeatures]),
    preferences: sanitizeOptionalString(row[FIELD_MAP_SURVEY_TOKUSEI.preferences]),
    strengths: sanitizeOptionalString(row[FIELD_MAP_SURVEY_TOKUSEI.strengths]),
    notes: sanitizeOptionalString(row[FIELD_MAP_SURVEY_TOKUSEI.notes]),
    createdAt: sanitizeString(row[FIELD_MAP_SURVEY_TOKUSEI.created] ?? ''),
  };
};

export function useTokuseiSurveyResponses() {
  const sp = useSP();
  const demoMode = isDemoModeEnabled();
  const [state, setState] = useState<HookState>({ data: [], status: 'idle', error: null });

  const load = useCallback(async (signal?: AbortSignal) => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const responses = demoMode
        ? createTokuseiDemoResponses()
        : await sp.listItems<SharePointTokuseiRow>(SURVEY_LIST_TITLE, {
            select: SURVEY_TOKUSEI_SELECT_FIELDS as string[],
            orderby: `${FIELD_MAP_SURVEY_TOKUSEI.created} desc`,
            top: 200,
            signal,
          }).then((rows) => rows.map(mapRowToResponse));

      if (signal?.aborted) return;
      setState({ data: responses, status: 'success', error: null });
    } catch (error) {
      if (signal?.aborted) return;
      const fallback = error instanceof Error ? error : new Error('特性アンケートの読込に失敗しました');
      setState((prev) => ({ ...prev, status: 'error', error: fallback }));
    }
  }, [demoMode, sp]);

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
