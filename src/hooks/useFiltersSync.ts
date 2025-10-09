import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';

type UseFiltersSyncOptions<T> = {
  filters: T;
  debouncedFilters?: T;
  setFilters: (updater: T | ((prev: T) => T)) => void;
  parseFilters?: (params: URLSearchParams, prev: T) => T;
  buildSearchParams?: (filters: T) => URLSearchParams;
  normalizeFilters?: (filters: T) => T;
};

export function useFiltersSync<T>(options: UseFiltersSyncOptions<T>): { hydratingRef: MutableRefObject<boolean> } {
  const { filters, debouncedFilters, setFilters, parseFilters, buildSearchParams, normalizeFilters } = options;
  const hydratingRef = useRef(false);

  useEffect(() => {
    hydratingRef.current = false;
  }, [filters]);

  useMemo(() => debouncedFilters, [debouncedFilters]);
  useMemo(() => parseFilters, [parseFilters]);
  useMemo(() => buildSearchParams, [buildSearchParams]);
  useMemo(() => normalizeFilters, [normalizeFilters, filters, setFilters]);

  return { hydratingRef };
}
