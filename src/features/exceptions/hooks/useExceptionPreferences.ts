import { create } from 'zustand';
import { useMemo } from 'react';
import type { AcknowledgementState, ResolvedState } from '@/features/exceptions/domain/exceptionLogic';

export type ExceptionPreferencesState = {
  dismissed: Record<string, boolean>;                    // stableId -> true
  snoozed: Record<string, string>;                       // stableId -> ISO date string
  acknowledged: Record<string, AcknowledgementState>;   // stableId -> acknowledgement（ADR-019）
  resolved: Record<string, ResolvedState>;               // stableId -> resolved（ADR-019）
};

export type ExceptionPreferencesStore = ExceptionPreferencesState & {
  dismiss: (stableId: string) => void;
  snooze: (stableId: string, until: string) => void;
  undismiss: (stableId: string) => void;
  unsnooze: (stableId: string) => void;
  /** ADR-019: 対応着手の意思表示（dismiss とは別概念） */
  acknowledge: (stableId: string, state: AcknowledgementState) => void;
  unacknowledge: (stableId: string) => void;
  /** ADR-019: 意図的な完了。アクティブリストから除外される（dismiss と意味は異なる） */
  resolve: (stableId: string, state: ResolvedState) => void;
  unresolve: (stableId: string) => void;
  getActivePreferences: () => {
    dismissedStableIds: Set<string>;
    snoozedStableIds: Set<string>;
    acknowledgedMap: Record<string, AcknowledgementState>;
    resolvedMap: Record<string, ResolvedState>;
  };
};

export const EXCEPTION_PREF_STORAGE_KEY = 'isokatsu.exception-preferences.v2';
export const EXCEPTION_PREF_VERSION = 2;

type PersistedPayload = {
  version: number;
  state: ExceptionPreferencesState;
};

function getStorage(): Storage | null {
  try {
    if (!('localStorage' in globalThis)) return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

const EMPTY_STATE: ExceptionPreferencesState = { dismissed: {}, snoozed: {}, acknowledged: {}, resolved: {} };

function loadFromStorage(): ExceptionPreferencesState {
  const storage = getStorage();
  if (!storage) return EMPTY_STATE;
  try {
    const raw = storage.getItem(EXCEPTION_PREF_STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const payload = JSON.parse(raw) as Partial<PersistedPayload>;
    if (payload?.version !== EXCEPTION_PREF_VERSION || !payload.state) {
      storage.removeItem(EXCEPTION_PREF_STORAGE_KEY);
      return EMPTY_STATE;
    }
    const dismissed = typeof payload.state.dismissed === 'object' ? payload.state.dismissed : {};
    const snoozed = typeof payload.state.snoozed === 'object' ? payload.state.snoozed : {};
    const acknowledged = typeof payload.state.acknowledged === 'object' ? payload.state.acknowledged : {};
    const resolved = typeof payload.state.resolved === 'object' ? payload.state.resolved : {};
    return { dismissed, snoozed, acknowledged, resolved };
  } catch {
    return EMPTY_STATE;
  }
}

function saveToStorage(state: ExceptionPreferencesState) {
  const storage = getStorage();
  if (!storage) return;
  try {
    const payload: PersistedPayload = {
      version: EXCEPTION_PREF_VERSION,
      state,
    };
    storage.setItem(EXCEPTION_PREF_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export const useExceptionPreferences = create<ExceptionPreferencesStore>((set, get) => ({
  ...loadFromStorage(),

  dismiss: (stableId) => set((s) => {
    const next = { ...s.dismissed, [stableId]: true };
    const nextState = { dismissed: next, snoozed: s.snoozed, acknowledged: s.acknowledged, resolved: s.resolved };
    saveToStorage(nextState);
    return { dismissed: next };
  }),

  snooze: (stableId, until) => set((s) => {
    const next = { ...s.snoozed, [stableId]: until };
    const nextState = { dismissed: s.dismissed, snoozed: next, acknowledged: s.acknowledged, resolved: s.resolved };
    saveToStorage(nextState);
    return { snoozed: next };
  }),

  undismiss: (stableId) => set((s) => {
    const next = { ...s.dismissed };
    delete next[stableId];
    const nextState = { dismissed: next, snoozed: s.snoozed, acknowledged: s.acknowledged, resolved: s.resolved };
    saveToStorage(nextState);
    return { dismissed: next };
  }),

  unsnooze: (stableId) => set((s) => {
    const next = { ...s.snoozed };
    delete next[stableId];
    const nextState = { dismissed: s.dismissed, snoozed: next, acknowledged: s.acknowledged, resolved: s.resolved };
    saveToStorage(nextState);
    return { snoozed: next };
  }),

  acknowledge: (stableId, state) => set((s) => {
    const next = { ...s.acknowledged, [stableId]: state };
    const nextState = { dismissed: s.dismissed, snoozed: s.snoozed, acknowledged: next, resolved: s.resolved };
    saveToStorage(nextState);
    return { acknowledged: next };
  }),

  unacknowledge: (stableId) => set((s) => {
    const next = { ...s.acknowledged };
    delete next[stableId];
    const nextState = { dismissed: s.dismissed, snoozed: s.snoozed, acknowledged: next, resolved: s.resolved };
    saveToStorage(nextState);
    return { acknowledged: next };
  }),

  resolve: (stableId, state) => set((s) => {
    const next = { ...s.resolved, [stableId]: state };
    const nextState = { dismissed: s.dismissed, snoozed: s.snoozed, acknowledged: s.acknowledged, resolved: next };
    saveToStorage(nextState);
    return { resolved: next };
  }),

  unresolve: (stableId) => set((s) => {
    const next = { ...s.resolved };
    delete next[stableId];
    const nextState = { dismissed: s.dismissed, snoozed: s.snoozed, acknowledged: s.acknowledged, resolved: next };
    saveToStorage(nextState);
    return { resolved: next };
  }),

  getActivePreferences: () => {
    const s = get();
    const now = new Date().getTime();

    const dismissedStableIds = new Set<string>();
    for (const [id, value] of Object.entries(s.dismissed)) {
      if (value) dismissedStableIds.add(id);
    }

    const snoozedStableIds = new Set<string>();
    for (const [id, untilStr] of Object.entries(s.snoozed)) {
      const untilTime = new Date(untilStr).getTime();
      if (!isNaN(untilTime) && untilTime > now) {
        snoozedStableIds.add(id);
      }
    }

    return { dismissedStableIds, snoozedStableIds, acknowledgedMap: s.acknowledged, resolvedMap: s.resolved };
  },
}));

export function useActiveExceptionPreferences() {
  // Subscribe to each field separately to avoid returning a new object literal
  // on every call (which would cause useSyncExternalStore to loop via forceStoreRerender).
  const dismissed = useExceptionPreferences((s) => s.dismissed);
  const snoozed = useExceptionPreferences((s) => s.snoozed);
  const acknowledged = useExceptionPreferences((s) => s.acknowledged);
  const resolved = useExceptionPreferences((s) => s.resolved);

  return useMemo(() => {
    const now = new Date().getTime();

    const dismissedStableIds = new Set(
      Object.entries(dismissed)
        .filter(([, isDismissed]) => isDismissed)
        .map(([id]) => id),
    );

    const snoozedStableIds = new Set(
      Object.entries(snoozed)
        .filter(([, until]) => {
          try {
            return until && new Date(until).getTime() > now;
          } catch {
            return false;
          }
        })
        .map(([id]) => id),
    );

    return { dismissedStableIds, snoozedStableIds, acknowledgedMap: acknowledged, resolvedMap: resolved };
  }, [dismissed, snoozed, acknowledged, resolved]);
}
