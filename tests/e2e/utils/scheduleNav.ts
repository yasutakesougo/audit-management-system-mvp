import type { Page } from '@playwright/test';
import { format } from 'date-fns';

type NavOptions = {
  searchParams?: Record<string, string | number | boolean>;
};

const formatIsoDate = (date: Date): string => format(date, 'yyyy-MM-dd');

const buildSearch = (base: Record<string, string>, extra?: Record<string, string | number | boolean>): string => {
  const params = new URLSearchParams(base);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, String(value));
    }
  }
  return params.toString();
};

export async function gotoDay(page: Page, date: Date, options?: NavOptions): Promise<void> {
  const iso = formatIsoDate(date);
  const search = buildSearch({ date: iso, tab: 'day' }, options?.searchParams);
  await page.goto(`/schedules/week?${search}`);
}

export async function gotoWeek(page: Page, date: Date, options?: NavOptions): Promise<void> {
  const iso = formatIsoDate(date);
  const search = buildSearch({ date: iso, tab: 'week' }, options?.searchParams);
  await page.goto(`/schedules/week?${search}`, { waitUntil: 'domcontentloaded' });
}

export async function gotoMonth(page: Page, date: Date, options?: NavOptions): Promise<void> {
  const iso = formatIsoDate(date);
  const search = buildSearch({ date: iso, tab: 'month' }, options?.searchParams);
  await page.goto(`/schedules/week?${search}`, { waitUntil: 'domcontentloaded' });
}

type OrgNavOptions = NavOptions & {
  date?: Date;
  org?: string;
};

export async function gotoOrg(page: Page, options?: OrgNavOptions): Promise<void> {
  const iso = formatIsoDate(options?.date ?? new Date());
  const baseSearch: Record<string, string> = { date: iso, tab: 'org' };
  if (options?.org) {
    baseSearch.org = options.org;
  }
  const search = buildSearch(baseSearch, options?.searchParams);
  await page.goto(`/schedules/week?${search}`, { waitUntil: 'domcontentloaded' });
}
