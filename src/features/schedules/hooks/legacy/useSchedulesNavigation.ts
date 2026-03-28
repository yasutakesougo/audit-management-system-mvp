/**
 * useSchedulesNavigation
 *
 * Sub-hook handling all navigation logic for the schedules week/month page:
 * - Active date tracking
 * - Week/month shifting
 * - View href computation (day/week/month)
 * - Active day range for queries
 *
 * Extracted from useWeekPageOrchestrator to reduce orchestrator to composition-only.
 */

import type { ScheduleCategory } from '@/features/schedules/domain/types';
import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { makeRange } from './useSchedules';
import { toDateIso } from '../view-models/useSchedulesPageState';

export interface NavigationDeps {
  focusDate: Date;
  weekRange: { from: string; to: string };
  categoryFilter: ScheduleCategory | 'All';
  orgParam: string;
  dateIso: string | null;
  setDateIso: (iso: string) => void;
}

export interface NavigationReturn {
  activeDateIso: string | null;
  setActiveDateIso: (iso: string | null) => void;
  dayLane: ScheduleCategory | null;
  setDayLane: (lane: ScheduleCategory | null) => void;
  resolvedActiveDateIso: string;
  dayViewHref: string;
  weekViewHref: string;
  monthViewHref: string;
  activeDayRange: { from: string; to: string };
  handleDayClick: (dayIso: string, event?: MouseEvent<HTMLButtonElement>) => void;
  handlePrevWeek: () => void;
  handleNextWeek: () => void;
  handleTodayWeek: () => void;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  handleTodayMonth: () => void;
  syncDateParam: (dateIso: string) => void;
  primeRouteReset: () => void;
}

export function useSchedulesNavigation(deps: NavigationDeps): NavigationReturn {
  const { focusDate, weekRange, categoryFilter, orgParam, setDateIso } = deps;

  const [activeDateIso, setActiveDateIso] = useState<string | null>(() => toDateIso(focusDate));
  const [dayLane, setDayLane] = useState<ScheduleCategory | null>(null);

  const defaultDateIso = weekRange.from.slice(0, 10);
  const resolvedActiveDateIso = activeDateIso ?? defaultDateIso;

  // Sync active date with focus date changes
  useEffect(() => {
    const nextIso = toDateIso(focusDate);
    setActiveDateIso((prev: any) => (prev === nextIso ? prev : nextIso));
  }, [focusDate]);

  // Clear day lane on mode change
  const primeRouteReset = useCallback(() => {
    if (typeof window === 'undefined') return;
    const scope = window as typeof window & { __suppressRouteReset__?: boolean };
    scope.__suppressRouteReset__ = true;
  }, []);

  const syncDateParam = useCallback(
    (dateIso: string) => {
      setDateIso(dateIso);
    },
    [setDateIso],
  );

  // View hrefs
  const dayViewHref = useMemo(() => {
    const params = new URLSearchParams({ date: resolvedActiveDateIso });
    if (dayLane) params.set('lane', dayLane);
    if (categoryFilter !== 'All') params.set('cat', categoryFilter);
    if (orgParam !== 'all') params.set('org', orgParam);
    return `/schedules/day?${params.toString()}`;
  }, [categoryFilter, dayLane, orgParam, resolvedActiveDateIso]);

  const weekViewHref = useMemo(() => {
    const params = new URLSearchParams({ date: resolvedActiveDateIso });
    if (categoryFilter !== 'All') params.set('cat', categoryFilter);
    if (orgParam !== 'all') params.set('org', orgParam);
    return `/schedules/week?${params.toString()}`;
  }, [categoryFilter, orgParam, resolvedActiveDateIso]);

  const monthViewHref = useMemo(() => {
    const params = new URLSearchParams({ date: resolvedActiveDateIso });
    if (categoryFilter !== 'All') params.set('cat', categoryFilter);
    if (orgParam !== 'all') params.set('org', orgParam);
    return `/schedules/month?${params.toString()}`;
  }, [categoryFilter, orgParam, resolvedActiveDateIso]);

  const activeDayRange = useMemo(() => {
    const start = new Date(`${resolvedActiveDateIso}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return makeRange(start, end);
  }, [resolvedActiveDateIso]);

  // Event handlers
  const handleDayClick = useCallback(
    (dayIso: string, _event?: MouseEvent<HTMLButtonElement>) => {
      setActiveDateIso(dayIso);
      setDayLane(null);
      primeRouteReset();
      syncDateParam(dayIso);
    },
    [primeRouteReset, syncDateParam],
  );

  // Navigation: week shift
  const shiftWeek = useCallback(
    (deltaWeeks: number) => {
      const baseIso = deps.dateIso ?? toDateIso(focusDate);
      const base = new Date(`${baseIso}T00:00:00Z`);
      base.setDate(base.getDate() + deltaWeeks * 7);
      const iso = toDateIso(base);
      setActiveDateIso(iso);
      primeRouteReset();
      syncDateParam(iso);
    },
    [focusDate, primeRouteReset, deps.dateIso, syncDateParam],
  );

  const handlePrevWeek = useCallback(() => shiftWeek(-1), [shiftWeek]);
  const handleNextWeek = useCallback(() => shiftWeek(1), [shiftWeek]);
  const handleTodayWeek = useCallback(() => {
    const todayIso = toDateIso(new Date());
    setActiveDateIso(todayIso);
    primeRouteReset();
    syncDateParam(todayIso);
  }, [primeRouteReset, syncDateParam]);

  const handlePrevMonth = useCallback(() => {
    const prevMonthDate = new Date(focusDate);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const iso = toDateIso(prevMonthDate);
    setActiveDateIso(iso);
    primeRouteReset();
    syncDateParam(iso);
  }, [focusDate, primeRouteReset, syncDateParam]);

  const handleNextMonth = useCallback(() => {
    const nextMonthDate = new Date(focusDate);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const iso = toDateIso(nextMonthDate);
    setActiveDateIso(iso);
    primeRouteReset();
    syncDateParam(iso);
  }, [focusDate, primeRouteReset, syncDateParam]);

  const handleTodayMonth = useCallback(() => {
    const todayIso = toDateIso(new Date());
    setActiveDateIso(todayIso);
    primeRouteReset();
    syncDateParam(todayIso);
  }, [primeRouteReset, syncDateParam]);

  return {
    activeDateIso,
    setActiveDateIso,
    dayLane,
    setDayLane,
    resolvedActiveDateIso,
    dayViewHref,
    weekViewHref,
    monthViewHref,
    activeDayRange,
    handleDayClick,
    handlePrevWeek,
    handleNextWeek,
    handleTodayWeek,
    handlePrevMonth,
    handleNextMonth,
    handleTodayMonth,
    syncDateParam,
    primeRouteReset,
  };
}
