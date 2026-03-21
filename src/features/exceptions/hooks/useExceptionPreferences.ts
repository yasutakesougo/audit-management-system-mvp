import { create } from 'zustand';
import { useMemo } from 'react';

export type ExceptionPreferencesState = {
  dismissed: Record<string, boolean>; // stableId -> true
  snoozed: Record<string, string>; // stableId -> ISO date string
};

export type ExceptionPreferencesStore = ExceptionPreferencesState & {
  dismiss: (stableId: string) => void;
  snooze: (stableId: string, until: string) => void;
  undismiss: (stableId: string) => void;
  unsnooze: (stableId: string) => void;
  getActivePreferences: () => {
    dismissedStableIds: Set<string>;
    snoozedStableIds: Set<string>;
  };
};

export const EXCEPTION_PREF_STORAGE_KEY = 'isokatsu.exception-preferences.v1';
export const EXCEPTION_PREF_VERSION = 1;

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

function loadFromStorage(): ExceptionPreferencesState {
  const storage = getStorage();
  if (!storage) return { dismissed: {}, snoozed: {} };
  try {
    const raw = storage.getItem(EXCEPTION_PREF_STORAGE_KEY);
    if (!raw) return { dismissed: {}, snoozed: {} };
    const payload = JSON.parse(raw) as Partial<PersistedPayload>;
    if (payload?.version !== EXCEPTION_PREF_VERSION || !payload.state) {
      storage.removeItem(EXCEPTION_PREF_STORAGE_KEY);
      return { dismissed: {}, snoozed: {} };
    }
    const dismissed = typeof payload.state.dismissed === 'object' ? payload.state.dismissed : {};
    const snoozed = typeof payload.state.snoozed === 'object' ? payload.state.snoozed : {};
    return { dismissed, snoozed };
  } catch {
    return { dismissed: {}, snoozed: {} };
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
    const nextState = { dismissed: next, snoozed: s.snoozed };
    saveToStorage(nextState);
    return { dismissed: next };
  }),

  snooze: (stableId, until) => set((s) => {
    const next = { ...s.snoozed, [stableId]: until };
    const nextState = { dismissed: s.dismissed, snoozed: next };
    saveToStorage(nextState);
    return { snoozed: next };
  }),

  undismiss: (stableId) => set((s) => {
    const next = { ...s.dismissed };
    delete next[stableId];
    const nextState = { dismissed: next, snoozed: s.snoozed };
    saveToStorage(nextState);
    return { dismissed: next };
  }),

  unsnooze: (stableId) => set((s) => {
    const next = { ...s.snoozed };
    delete next[stableId];
    const nextState = { dismissed: s.dismissed, snoozed: next };
    saveToStorage(nextState);
    return { snoozed: next };
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
    
    return { dismissedStableIds, snoozedStableIds };
  }
}));

export function useActiveExceptionPreferences() {
  const dismissed = useExceptionPreferences((s) => s.dismissed);
  const snoozed = useExceptionPreferences((s) => s.snoozed);
  
  return useMemo(() => {
    const now = new Date().getTime();
    
    const dismissedStableIds = new Set(
      Object.entries(dismissed)
        .filter(([, isDismissed]) => isDismissed)
        .map(([id]) => id)
    );
    
    const snoozedStableIds = new Set(
      Object.entries(snoozed)
        .filter(([, until]) => new Date(until).getTime() > now)
        .map(([id]) => id)
    );

    return { dismissedStableIds, snoozedStableIds };
  }, [dismissed, snoozed]);
}
