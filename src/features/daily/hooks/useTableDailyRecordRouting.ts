import { useEffect, useState } from 'react';

/**
 * Storage keys for URL synchronization
 */
export const TABLE_DAILY_DATE_QUERY_KEY = 'date';
export const TABLE_DAILY_UNSENT_FILTER_QUERY_KEY = 'unsent';
export const TABLE_DAILY_UNSENT_FILTER_STORAGE_KEY = 'daily-table-record:unsent-filter:v1';

/**
 * Validate date string format (YYYY-MM-DD)
 */
export const isValidDateValue = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Get date from URL query parameter
 * Returns null if not present or invalid
 */
export const getDateFromUrl = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const date = params.get(TABLE_DAILY_DATE_QUERY_KEY);
  if (!date || !isValidDateValue(date)) {
    return null;
  }

  return date;
};

/**
 * Check if unsent filter is enabled in URL
 */
export const isUnsentFilterEnabledInUrl = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get(TABLE_DAILY_UNSENT_FILTER_QUERY_KEY) === '1';
};

/**
 * Sync unsent filter state to URL
 * Updates URL without page reload using replaceState
 */
export const syncUnsentFilterToUrl = (enabled: boolean): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const nextUrl = new URL(window.location.href);
  if (enabled) {
    nextUrl.searchParams.set(TABLE_DAILY_UNSENT_FILTER_QUERY_KEY, '1');
  } else {
    nextUrl.searchParams.delete(TABLE_DAILY_UNSENT_FILTER_QUERY_KEY);
  }

  const nextRelative = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  const currentRelative = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextRelative !== currentRelative) {
    window.history.replaceState({}, '', nextRelative);
  }
};

/**
 * Custom hook for managing URL-based routing state
 * 
 * Responsibilities:
 * - Initialize date from URL parameter
 * - Sync unsent filter with URL and localStorage
 * - Provide routing state to parent components
 * 
 * @param open - Dialog open state (used to trigger URL sync)
 * @returns Routing state object
 */
export const useTableDailyRecordRouting = (open: boolean) => {
  const [initialDateFromUrl] = useState<string | null>(() => getDateFromUrl());
  const [showUnsentOnly, setShowUnsentOnly] = useState<boolean>(false);

  // Initialize unsent filter from URL or localStorage when dialog opens
  useEffect(() => {
    if (!open) {
      return;
    }

    const fromQuery = isUnsentFilterEnabledInUrl();
    const fromStorage = localStorage.getItem(TABLE_DAILY_UNSENT_FILTER_STORAGE_KEY) === '1';
    setShowUnsentOnly(fromQuery || fromStorage);
  }, [open]);

  // Sync unsent filter to URL and localStorage
  useEffect(() => {
    if (!open) {
      return;
    }

    try {
      if (showUnsentOnly) {
        localStorage.setItem(TABLE_DAILY_UNSENT_FILTER_STORAGE_KEY, '1');
      } else {
        localStorage.removeItem(TABLE_DAILY_UNSENT_FILTER_STORAGE_KEY);
      }
    } catch (error) {
      console.error('未送信フィルタの保存に失敗しました:', error);
    }

    syncUnsentFilterToUrl(showUnsentOnly);
  }, [open, showUnsentOnly]);

  return {
    initialDateFromUrl,
    showUnsentOnly,
    setShowUnsentOnly,
  };
};
