import { useCallback, useState } from 'react';

const LS_KEY = 'sp-dev-panel';

function loadPanelState(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch { return {}; }
}

function savePanelField(key: string, value: string) {
  try {
    const state = loadPanelState();
    state[key] = value;
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function usePersisted(key: string, fallback: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => loadPanelState()[key] ?? fallback);
  const set = useCallback((v: string) => { setValue(v); savePanelField(key, v); }, [key]);
  return [value, set];
}
