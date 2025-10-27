import type { HydrationSpan } from '@/lib/hydrationHud';

export type HydrationRouteEntry = {
  id: HydrationSpan['id'];
  label: HydrationSpan['label'];
  budget: number;
};

export const HYDRATION_KEYS = {
  dashboard: { id: 'route:dashboard', label: 'Dashboard', budget: 80 },
  records: { id: 'route:records', label: 'Records', budget: 90 },
  checklist: { id: 'route:checklist', label: 'Checklist', budget: 90 },
  audit: { id: 'route:audit', label: 'Audit', budget: 90 },
  users: { id: 'route:users', label: 'Users', budget: 90 },
  staff: { id: 'route:staff', label: 'Staff', budget: 90 },
  schedulesWeek: { id: 'route:schedules:week', label: 'Schedules Week', budget: 150 },
  schedulesMonth: { id: 'route:schedules:month', label: 'Schedules Month', budget: 160 },
  schedulesCreate: { id: 'route:schedules:create', label: 'Schedules Create', budget: 150 },
  schedulesDay: { id: 'route:schedules:day', label: 'Schedules Day', budget: 120 },
  supportProcedures: { id: 'route:support-procedures', label: 'Support Procedures', budget: 120 },
  dailyMenu: { id: 'route:daily', label: 'Daily Menu', budget: 90 },
  dailyActivity: { id: 'route:daily:activity', label: 'Daily Activity', budget: 110 },
  dailySupport: { id: 'route:daily:support', label: 'Daily Support', budget: 110 },
  adminTemplates: { id: 'route:admin:templates', label: 'Admin Templates', budget: 110 },
  adminSteps: { id: 'route:admin:step-templates', label: 'Admin Step Templates', budget: 110 },
  adminIndividualSupport: {
    id: 'route:admin:individual-support',
    label: 'Admin Individual Support',
    budget: 120,
  },
} as const satisfies Record<string, HydrationRouteEntry>;

type Matcher = {
  match: (pathname: string, search: string) => boolean;
  entry: HydrationRouteEntry;
};

const trimTrailingSlash = (value: string): string => {
  if (value.length <= 1) return value;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const includesQuery = (search: string, key: string, expected: string): boolean => {
  if (!search) return false;
  const params = new URLSearchParams(search);
  return params.get(key)?.toLowerCase() === expected.toLowerCase();
};

const MATCHERS: Matcher[] = [
  {
    match: (path, search) => path.startsWith('/schedules') && includesQuery(search, 'view', 'day'),
    entry: HYDRATION_KEYS.schedulesDay,
  },
  { match: (path) => path === '/' || path === '', entry: HYDRATION_KEYS.dashboard },
  { match: (path) => path.startsWith('/records/support-procedures'), entry: HYDRATION_KEYS.supportProcedures },
  { match: (path) => path.startsWith('/records'), entry: HYDRATION_KEYS.records },
  { match: (path) => path.startsWith('/checklist'), entry: HYDRATION_KEYS.checklist },
  { match: (path) => path.startsWith('/audit'), entry: HYDRATION_KEYS.audit },
  { match: (path) => path.startsWith('/users'), entry: HYDRATION_KEYS.users },
  { match: (path) => path.startsWith('/staff'), entry: HYDRATION_KEYS.staff },
  { match: (path) => path.startsWith('/schedules/month'), entry: HYDRATION_KEYS.schedulesMonth },
  { match: (path) => path.startsWith('/schedules/create'), entry: HYDRATION_KEYS.schedulesCreate },
  { match: (path) => path.startsWith('/schedules'), entry: HYDRATION_KEYS.schedulesWeek },
  { match: (path) => path.startsWith('/schedule'), entry: HYDRATION_KEYS.schedulesWeek },
  { match: (path) => path.startsWith('/daily/activity'), entry: HYDRATION_KEYS.dailyActivity },
  { match: (path) => path.startsWith('/daily/support'), entry: HYDRATION_KEYS.dailySupport },
  { match: (path) => path.startsWith('/daily'), entry: HYDRATION_KEYS.dailyMenu },
  { match: (path) => path.startsWith('/admin/step-templates'), entry: HYDRATION_KEYS.adminSteps },
  {
    match: (path) => path.startsWith('/admin/individual-support'),
    entry: HYDRATION_KEYS.adminIndividualSupport,
  },
  { match: (path) => path.startsWith('/admin'), entry: HYDRATION_KEYS.adminTemplates },
];

export const resolveHydrationEntry = (
  pathname: string,
  search = '',
): HydrationRouteEntry | null => {
  const lowered = pathname.toLowerCase();
  const normalizedPath = trimTrailingSlash(lowered.startsWith('/') ? lowered : `/${lowered}`);
  const normalizedSearch = search ?? '';
  for (const matcher of MATCHERS) {
    if (matcher.match(normalizedPath, normalizedSearch)) {
      return matcher.entry;
    }
  }
  return null;
};
