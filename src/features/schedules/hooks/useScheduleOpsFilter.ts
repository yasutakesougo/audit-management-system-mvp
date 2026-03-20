/**
 * useScheduleOpsFilter — URL Query 同期型のフィルター
 *
 * 責務:
 * - OpsFilterState を URL と同期、更新、クリアする
 * - activeFilterCount を計算する (クリアボタン表示用)
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DEFAULT_OPS_FILTER, type OpsFilterState, type OpsServiceType } from '../domain/scheduleOps';

// URL Param keys
const KEYS = {
  serviceType: 'serviceType',
  staffId: 'staffId',
  searchQuery: 'searchQuery',
  includeCancelled: 'includeCancelled',
  hasAttention: 'hasAttention',
  hasPickup: 'hasPickup',
  hasBath: 'hasBath',
  hasMedication: 'hasMedication',
} as const;

export type ScheduleOpsFilterReturn = {
  filter: OpsFilterState;
  setFilter: (patch: Partial<OpsFilterState>) => void;
  clearFilter: () => void;
  activeFilterCount: number;
};

// URL -> State deserialize
const parseBoolean = (val: string | null): boolean => val === 'true';

export const useScheduleOpsFilter = (): ScheduleOpsFilterReturn => {
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. Read from URL
  const filter = useMemo<OpsFilterState>(() => {
    return {
      serviceType: (searchParams.get(KEYS.serviceType) as OpsServiceType | 'all') ?? DEFAULT_OPS_FILTER.serviceType,
      staffId: searchParams.get(KEYS.staffId) || DEFAULT_OPS_FILTER.staffId,
      searchQuery: searchParams.get(KEYS.searchQuery) ?? DEFAULT_OPS_FILTER.searchQuery,
      includeCancelled: searchParams.has(KEYS.includeCancelled)
        ? parseBoolean(searchParams.get(KEYS.includeCancelled))
        : DEFAULT_OPS_FILTER.includeCancelled,
      hasAttention: searchParams.has(KEYS.hasAttention)
        ? parseBoolean(searchParams.get(KEYS.hasAttention))
        : DEFAULT_OPS_FILTER.hasAttention,
      hasPickup: searchParams.has(KEYS.hasPickup)
        ? parseBoolean(searchParams.get(KEYS.hasPickup))
        : DEFAULT_OPS_FILTER.hasPickup,
      hasBath: searchParams.has(KEYS.hasBath)
        ? parseBoolean(searchParams.get(KEYS.hasBath))
        : DEFAULT_OPS_FILTER.hasBath,
      hasMedication: searchParams.has(KEYS.hasMedication)
        ? parseBoolean(searchParams.get(KEYS.hasMedication))
        : DEFAULT_OPS_FILTER.hasMedication,
    };
  }, [searchParams]);

  // 2. Active filter count calculation (ignores searchQuery)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.serviceType !== DEFAULT_OPS_FILTER.serviceType) count++;
    if (filter.staffId !== DEFAULT_OPS_FILTER.staffId) count++;
    if (filter.includeCancelled !== DEFAULT_OPS_FILTER.includeCancelled) count++;
    if (filter.hasAttention !== DEFAULT_OPS_FILTER.hasAttention) count++;
    if (filter.hasPickup !== DEFAULT_OPS_FILTER.hasPickup) count++;
    if (filter.hasBath !== DEFAULT_OPS_FILTER.hasBath) count++;
    if (filter.hasMedication !== DEFAULT_OPS_FILTER.hasMedication) count++;
    return count;
  }, [filter]);

  // 3. Update Function
  const setFilter = useCallback(
    (patch: Partial<OpsFilterState>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const merged = { ...filter, ...patch };

        // serviceType
        if (merged.serviceType === DEFAULT_OPS_FILTER.serviceType) {
          next.delete(KEYS.serviceType);
        } else {
          next.set(KEYS.serviceType, merged.serviceType);
        }

        // staffId
        if (!merged.staffId) {
          next.delete(KEYS.staffId);
        } else {
          next.set(KEYS.staffId, merged.staffId);
        }

        // searchQuery
        if (!merged.searchQuery) {
          next.delete(KEYS.searchQuery);
        } else {
          next.set(KEYS.searchQuery, merged.searchQuery);
        }

        // booleans
        const bools = ['includeCancelled', 'hasAttention', 'hasPickup', 'hasBath', 'hasMedication'] as const;
        for (const key of bools) {
          if (merged[key] === DEFAULT_OPS_FILTER[key]) {
            next.delete(KEYS[key]);
          } else {
            next.set(KEYS[key], String(merged[key]));
          }
        }

        return next;
      }, { replace: true });
    },
    [filter, setSearchParams]
  );

  // 4. Clear Function
  const clearFilter = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.values(KEYS).forEach((k) => next.delete(k));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return {
    filter,
    setFilter,
    clearFilter,
    activeFilterCount,
  };
};
