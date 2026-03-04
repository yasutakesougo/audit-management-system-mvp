/**
 * DailyPage — Constants, types, and pure utility functions
 *
 * Extracted from DailyPage.tsx for single-responsibility.
 */

// ─── Filter Types ───────────────────────────────────────────────────────────

export const FILTER_OPTIONS = ['all', 'draft', 'submitted', 'approved'] as const;
export type FilterKey = (typeof FILTER_OPTIONS)[number];

export type DailyFilters = {
  q: string;
  filter: FilterKey;
  from: string;
  to: string;
  quickRange: 'all' | 'today';
  showAdvanced: boolean;
};

export const STORAGE_KEY = 'daily.filters.v2';
export const INITIAL_FILTERS: DailyFilters = {
  q: '',
  filter: 'all',
  from: '',
  to: '',
  quickRange: 'all',
  showAdvanced: false,
};

export const DEBOUNCE_MS = 300;

// ─── Status Labels & Colors ─────────────────────────────────────────────────

export const STATUS_LABEL: Record<string, string> = {
  draft: '下書き',
  submitted: '申請中',
  approved: '承認済み',
  rejected: '差戻し',
};

export const STATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rejected: 'warning',
};

// ─── Pure Utilities ─────────────────────────────────────────────────────────

export const dateOnly = (s?: string | null) => {
  if (!s) return '';
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  return iso.replace(/-/g, '/');
};

export const applyParam = <TKey extends keyof DailyFilters>(
  draft: DailyFilters,
  key: TKey,
  params: URLSearchParams,
  resolver: () => DailyFilters[TKey],
  fallback?: DailyFilters[TKey],
) => {
  const paramKey = key === 'quickRange' ? 'range' : key;
  if (!params.has(paramKey)) {
    if (fallback !== undefined && draft[key] !== fallback) {
      draft[key] = fallback;
    }
    return;
  }
  draft[key] = resolver();
};

export const parseFiltersFromParams = (params: URLSearchParams, prev: DailyFilters): DailyFilters => {
  const next: DailyFilters = { ...prev };

  applyParam(next, 'q', params, () => (params.get('q') ?? '').trim(), '');
  applyParam(next, 'filter', params, () => {
    const value = params.get('filter');
    return FILTER_OPTIONS.includes(value as FilterKey) ? (value as FilterKey) : 'all';
  }, 'all');
  applyParam(next, 'from', params, () => params.get('from') ?? '', '');
  applyParam(next, 'to', params, () => params.get('to') ?? '', '');
  applyParam(next, 'quickRange', params, () => (params.get('range') === 'today' ? 'today' : 'all'), 'all');

  return next;
};
