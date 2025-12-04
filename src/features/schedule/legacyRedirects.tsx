import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

type ScheduleTab = 'week' | 'day' | 'month';

const LEGACY_DATE_KEYS = ['date', 'day', 'monthDate'] as const;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const resolveDateParam = (search: string): string => {
  const params = new URLSearchParams(search);
  for (const key of LEGACY_DATE_KEYS) {
    const raw = params.get(key);
    if (raw && ISO_DATE_PATTERN.test(raw.trim())) {
      return raw.trim();
    }
  }
  return new Date().toISOString().slice(0, 10);
};

const buildTarget = (tab: ScheduleTab, search: string): string => {
  const params = new URLSearchParams(search);
  const next = new URLSearchParams();
  next.set('tab', tab);
  next.set('date', resolveDateParam(search));

  const org = params.get('org');
  if (org) {
    next.set('org', org);
  }

  return `/schedules/week?${next.toString()}`;
};

const LegacyScheduleRedirect = ({ tab }: { tab: ScheduleTab }) => {
  const location = useLocation();
  const target = useMemo(() => buildTarget(tab, location.search), [tab, location.search]);
  return <Navigate to={target} replace />;
};

export const LegacyDayRedirect = () => <LegacyScheduleRedirect tab="day" />;
export const LegacyMonthRedirect = () => <LegacyScheduleRedirect tab="month" />;
