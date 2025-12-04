import { useEffect, useState } from 'react';
import { getAppConfig } from '@/lib/env';

export const NURSE_DASHBOARD_STORAGE_KEY = 'nurse.dashboard.dev.v1';

export type NurseDashboardFixture = {
  date: string;
  summary: {
    totalTasks: number;
    pending: number;
    inProgress: number;
    completed: number;
  };
  tasks: Array<{
    id: string;
    userName: string;
    time: string;
    type: string;
    label: string;
    status: string;
  }>;
};

/**
 * Reads the deterministic nurse dashboard fixture from localStorage when available
 * (dev / demo / E2E). Returns null when no seed is present or JSON parsing fails.
 */
export function useNurseDashboardDemoSeed() {
  const [fixture, setFixture] = useState<NurseDashboardFixture | null>(null);
  const { isDev: isDevEnv } = getAppConfig();

  useEffect(() => {
    if (!isDevEnv) return;
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(NURSE_DASHBOARD_STORAGE_KEY);
      if (!raw) return;
      setFixture(JSON.parse(raw) as NurseDashboardFixture);
    } catch {
      // Ignore malformed fixture data; spec assertions will reveal issues.
    }
  }, [isDevEnv]);

  return fixture;
}
