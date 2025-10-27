import { scheduleIdle } from './util';
import { prefetch, type PrefetchRequest } from './prefetch';
import type { PrefetchSource } from './tracker';

export const PREFETCH_KEYS = {
  dashboard: 'route:dashboard',
  records: 'route:records',
  checklist: 'route:checklist',
  audit: 'route:audit',
  users: 'route:users',
  staff: 'route:staff',
  dailyMenu: 'route:daily:menu',
  schedulesWeek: 'route:schedules:week',
  schedulesDay: 'route:schedules:day',
  schedulesList: 'route:schedules:list',
  schedulesMonth: 'route:schedules:month',
  adminTemplates: 'route:admin:templates',
  adminSteps: 'route:admin:step-templates',
  adminIndividual: 'route:admin:individual-support',
  supportProcedures: 'route:support-procedures',
} as const;

export type PrefetchKey = (typeof PREFETCH_KEYS)[keyof typeof PREFETCH_KEYS];

type PrefetchRegistry = Record<PrefetchKey, () => Promise<unknown>>;

type NeighborMap = Partial<Record<PrefetchKey, PrefetchKey[]>>;

export const ROUTE_IMPORTERS: PrefetchRegistry = {
  [PREFETCH_KEYS.dashboard]: () => import('@/pages/DashboardPage'),
  [PREFETCH_KEYS.records]: () => import('@/features/records/RecordList'),
  [PREFETCH_KEYS.checklist]: () => import('@/features/compliance-checklist/ChecklistPage'),
  [PREFETCH_KEYS.audit]: () => import('@/features/audit/AuditPanel'),
  [PREFETCH_KEYS.users]: () => import('@/features/users'),
  [PREFETCH_KEYS.staff]: () => import('@/features/staff'),
  [PREFETCH_KEYS.dailyMenu]: () => import('@/pages/DailyRecordMenuPage'),
  [PREFETCH_KEYS.schedulesWeek]: () => import('@/features/schedule/SchedulePage'),
  [PREFETCH_KEYS.schedulesDay]: () => import('@/features/schedule/views/TimelineDay'),
  [PREFETCH_KEYS.schedulesList]: () => import('@/features/schedule/views/ListView'),
  [PREFETCH_KEYS.schedulesMonth]: () => import('@/features/schedule/MonthPage'),
  [PREFETCH_KEYS.adminTemplates]: () => import('@/pages/SupportActivityMasterPage'),
  [PREFETCH_KEYS.adminSteps]: () => import('@/pages/SupportStepMasterPage'),
  [PREFETCH_KEYS.adminIndividual]: () => import('@/pages/IndividualSupportManagementPage'),
  [PREFETCH_KEYS.supportProcedures]: () => import('@/pages/TimeFlowSupportRecordPage'),
};

const registry: PrefetchRegistry = ROUTE_IMPORTERS;

const neighbors: NeighborMap = {
  [PREFETCH_KEYS.schedulesWeek]: [PREFETCH_KEYS.schedulesDay, PREFETCH_KEYS.schedulesList],
  [PREFETCH_KEYS.schedulesDay]: [PREFETCH_KEYS.schedulesWeek, PREFETCH_KEYS.schedulesList],
  [PREFETCH_KEYS.schedulesList]: [PREFETCH_KEYS.schedulesWeek],
  [PREFETCH_KEYS.dashboard]: [PREFETCH_KEYS.records, PREFETCH_KEYS.audit],
};

export type WarmRouteOptions = {
  source: PrefetchSource;
  ttlMs?: number;
  meta?: Record<string, unknown>;
  signal?: AbortSignal;
};

export const warmRoute = (
  importer: () => Promise<unknown>,
  key: PrefetchKey,
  options: WarmRouteOptions,
) => prefetch({ key, importer, ...options });

export const prefetchByKey = (key: PrefetchKey, source: PrefetchSource, options?: Partial<PrefetchRequest>) => {
  const importer = registry[key];
  if (!importer) {
    return null;
  }
  return prefetch({ key, importer, source, ...options });
};

export const warmNeighbors = (key: PrefetchKey): void => {
  const list = neighbors[key];
  if (!list || list.length === 0) {
    return;
  }
  scheduleIdle(() => {
    list.forEach((neighborKey) => {
      prefetchByKey(neighborKey, 'idle');
    });
  }, { timeout: 500 });
};

export const registerPrefetch = (key: PrefetchKey, loader: () => Promise<unknown>): void => {
  registry[key] = loader;
};

export const registerNeighbors = (key: PrefetchKey, next: PrefetchKey[]): void => {
  neighbors[key] = next;
};
