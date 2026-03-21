import { create } from 'zustand';
import type { ActionSuggestionState, SuggestionStatus } from '../domain/types';

export type SuggestionStateMeta = {
  by?: string;
  reason?: string;
};

export type SuggestionStateStore = {
  states: Record<string, ActionSuggestionState>;
  dismiss: (stableId: string, meta?: SuggestionStateMeta) => void;
  snooze: (stableId: string, until: string, meta?: SuggestionStateMeta) => void;
  reopen: (stableId: string) => void;
};

export const SUGGESTION_STATE_STORAGE_KEY = 'action-engine.suggestion-states.v1';
export const SUGGESTION_STATE_STORAGE_VERSION = 1;

type PersistedSuggestionStatePayload = {
  version: number;
  states: Record<string, ActionSuggestionState>;
};

const VALID_STATUSES: SuggestionStatus[] = ['open', 'dismissed', 'snoozed'];

function getSuggestionStateStorage(): Storage | null {
  try {
    if (!('localStorage' in globalThis)) return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function safeClearSuggestionStateStorage(storage: Storage | null) {
  if (!storage) return;
  try {
    storage.removeItem(SUGGESTION_STATE_STORAGE_KEY);
  } catch {
    // localStorage が利用不可でもアプリ動作は継続する
  }
}

function toValidState(stableId: string, value: unknown): ActionSuggestionState | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<ActionSuggestionState>;
  if (
    typeof candidate.status !== 'string'
    || !VALID_STATUSES.includes(candidate.status as SuggestionStatus)
  ) {
    return null;
  }
  if (typeof candidate.updatedAt !== 'string') return null;

  const status = candidate.status as SuggestionStatus;
  const normalized: ActionSuggestionState = {
    stableId,
    status,
    updatedAt: candidate.updatedAt,
  };

  if (typeof candidate.updatedBy === 'string') {
    normalized.updatedBy = candidate.updatedBy;
  }
  if (typeof candidate.reason === 'string') {
    normalized.reason = candidate.reason;
  }
  if (status === 'snoozed') {
    if (typeof candidate.snoozedUntil !== 'string') return null;
    normalized.snoozedUntil = candidate.snoozedUntil;
  }

  return normalized;
}

function sanitizeSuggestionStates(
  rawStates: unknown,
): Record<string, ActionSuggestionState> {
  if (!rawStates || typeof rawStates !== 'object') return {};

  const next: Record<string, ActionSuggestionState> = {};
  for (const [stableId, value] of Object.entries(rawStates as Record<string, unknown>)) {
    if (!stableId) continue;
    const valid = toValidState(stableId, value);
    if (valid) {
      next[stableId] = valid;
    }
  }

  return next;
}

export function loadSuggestionStatesFromStorage(
  storage: Storage | null = getSuggestionStateStorage(),
): Record<string, ActionSuggestionState> {
  if (!storage) return {};

  try {
    const raw = storage.getItem(SUGGESTION_STATE_STORAGE_KEY);
    if (!raw) return {};

    const payload = JSON.parse(raw) as Partial<PersistedSuggestionStatePayload>;
    if (!payload || payload.version !== SUGGESTION_STATE_STORAGE_VERSION) {
      safeClearSuggestionStateStorage(storage);
      return {};
    }

    return sanitizeSuggestionStates(payload.states);
  } catch {
    safeClearSuggestionStateStorage(storage);
    return {};
  }
}

export function saveSuggestionStatesToStorage(
  states: Record<string, ActionSuggestionState>,
  storage: Storage | null = getSuggestionStateStorage(),
) {
  if (!storage) return;

  try {
    const payload: PersistedSuggestionStatePayload = {
      version: SUGGESTION_STATE_STORAGE_VERSION,
      states,
    };
    storage.setItem(SUGGESTION_STATE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage が利用不可でもアプリ動作は継続する
  }
}

function buildBaseState(
  stableId: string,
  meta: SuggestionStateMeta | undefined,
): Pick<ActionSuggestionState, 'stableId' | 'updatedAt' | 'updatedBy' | 'reason'> {
  return {
    stableId,
    updatedAt: new Date().toISOString(),
    updatedBy: meta?.by,
    reason: meta?.reason,
  };
}

export const useSuggestionStateStore = create<SuggestionStateStore>((set) => ({
  states: loadSuggestionStatesFromStorage(),

  dismiss: (stableId, meta) =>
    set((state) => {
      const nextState: ActionSuggestionState = {
        ...buildBaseState(stableId, meta),
        status: 'dismissed',
      };
      const nextStates: Record<string, ActionSuggestionState> = {
        ...state.states,
        [stableId]: nextState,
      };
      saveSuggestionStatesToStorage(nextStates);
      return { states: nextStates };
    }),

  snooze: (stableId, until, meta) =>
    set((state) => {
      const nextState: ActionSuggestionState = {
        ...buildBaseState(stableId, meta),
        status: 'snoozed',
        snoozedUntil: until,
      };
      const nextStates: Record<string, ActionSuggestionState> = {
        ...state.states,
        [stableId]: nextState,
      };
      saveSuggestionStatesToStorage(nextStates);
      return { states: nextStates };
    }),

  reopen: (stableId) =>
    set((state) => {
      const nextState: ActionSuggestionState = {
        stableId,
        status: 'open',
        updatedAt: new Date().toISOString(),
      };
      const nextStates: Record<string, ActionSuggestionState> = {
        ...state.states,
        [stableId]: nextState,
      };
      saveSuggestionStatesToStorage(nextStates);
      return { states: nextStates };
    }),
}));
