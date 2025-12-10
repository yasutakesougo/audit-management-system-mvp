import { prefetch, type PrefetchHandle, type PrefetchRequest } from './prefetch';
import type { PrefetchSource } from './tracker';
import { scheduleIdle } from './util';

export const PREFETCH_KEYS = {
  dashboard: 'route:dashboard',
  handoffTimeline: 'route:handoff-timeline',
  meetingGuide: 'route:meeting-guide',
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
  icebergPdca: 'route:iceberg:pdca',
  analysisDashboard: 'route:analysis:dashboard',
  assessmentDashboard: 'route:assessment:dashboard',
  iceberg: 'route:analysis:iceberg',
  supportPlanGuideMarkdown: 'feature:support-plan-guide:markdown',
  muiForms: 'mui:forms',
  muiOverlay: 'mui:overlay',
  muiFeedback: 'mui:feedback',
  muiData: 'mui:data',
} as const;

export type PrefetchKey = (typeof PREFETCH_KEYS)[keyof typeof PREFETCH_KEYS];

type PrefetchRegistry = Record<PrefetchKey, () => Promise<unknown>>;

type NeighborMap = Partial<Record<PrefetchKey, PrefetchKey[]>>;

export const ROUTE_IMPORTERS: PrefetchRegistry = {
  [PREFETCH_KEYS.dashboard]: () => import('@/pages/DashboardPage'),
  [PREFETCH_KEYS.handoffTimeline]: () => import('@/pages/HandoffTimelinePage'),
  [PREFETCH_KEYS.meetingGuide]: () => import('@/pages/MeetingGuidePage'),
  [PREFETCH_KEYS.records]: () => import('@/features/records/RecordList'),
  [PREFETCH_KEYS.checklist]: () => import('@/features/compliance-checklist/ChecklistPage'),
  [PREFETCH_KEYS.audit]: () => import('@/features/audit/AuditPanel'),
  [PREFETCH_KEYS.users]: () => import('@/features/users'),
  [PREFETCH_KEYS.staff]: () => import('@/features/staff'),
  [PREFETCH_KEYS.dailyMenu]: () => import('@/pages/DailyRecordMenuPage'),
  [PREFETCH_KEYS.schedulesWeek]: () => import('@/features/schedule/SchedulePage'),
  [PREFETCH_KEYS.schedulesDay]: () => import('@/features/schedule/views/TimelineDay'),
  [PREFETCH_KEYS.schedulesList]: () => import('@/features/schedule/views/ListView'),
  [PREFETCH_KEYS.schedulesMonth]: () => import('@/features/schedules/MonthPage'),
  [PREFETCH_KEYS.adminTemplates]: () => import('@/pages/SupportActivityMasterPage'),
  [PREFETCH_KEYS.adminSteps]: () => import('@/pages/SupportStepMasterPage'),
  [PREFETCH_KEYS.adminIndividual]: () => import('@/pages/IndividualSupportManagementPage'),
  [PREFETCH_KEYS.supportProcedures]: () => import('@/pages/TimeFlowSupportRecordPage'),
  [PREFETCH_KEYS.icebergPdca]: () => import('@/features/iceberg-pdca/IcebergPdcaPage'),
  [PREFETCH_KEYS.analysisDashboard]: () => import('@/pages/AnalysisDashboardPage'),
  [PREFETCH_KEYS.assessmentDashboard]: () => import('@/pages/AssessmentDashboardPage'),
  [PREFETCH_KEYS.iceberg]: () => import('@/pages/IcebergAnalysisPage'),
  [PREFETCH_KEYS.supportPlanGuideMarkdown]: () => import('@/pages/SupportPlanGuidePage.Markdown'),
  [PREFETCH_KEYS.muiForms]: () => import('@/mui/forms.entry').then((mod) => mod.warm?.()),
  [PREFETCH_KEYS.muiOverlay]: () => import('@/mui/overlay.entry').then((mod) => mod.warm?.()),
  [PREFETCH_KEYS.muiFeedback]: () => import('@/mui/feedback.entry').then((mod) => mod.warm?.()),
  [PREFETCH_KEYS.muiData]: () => import('@/mui/data.entry').then((mod) => mod.warm?.()),
};

// 初期値は ROUTE_IMPORTERS だが、registerPrefetch から動的に追加・上書きされうる可変レジストリ
const registry: PrefetchRegistry = { ...ROUTE_IMPORTERS };

// 同様に、neighbors も後から registerNeighbors で拡張する前提の可変マップ
const neighbors: NeighborMap = {
  [PREFETCH_KEYS.schedulesWeek]: [PREFETCH_KEYS.schedulesDay, PREFETCH_KEYS.schedulesList],
  [PREFETCH_KEYS.schedulesDay]: [PREFETCH_KEYS.schedulesWeek, PREFETCH_KEYS.schedulesList],
  [PREFETCH_KEYS.schedulesList]: [PREFETCH_KEYS.schedulesWeek],
  [PREFETCH_KEYS.dashboard]: [
    PREFETCH_KEYS.records,
    PREFETCH_KEYS.audit,
    PREFETCH_KEYS.supportProcedures,
    PREFETCH_KEYS.icebergPdca,
    PREFETCH_KEYS.analysisDashboard,
    PREFETCH_KEYS.assessmentDashboard,
    PREFETCH_KEYS.iceberg,
    PREFETCH_KEYS.supportPlanGuideMarkdown,
  ],
};

export type WarmRouteOptions = {
  source: PrefetchSource;
  ttlMs?: number;
  meta?: Record<string, unknown>;
  signal?: AbortSignal;
};

/**
 * Initiates a prefetch operation with a direct importer function.
 * @param importer The function to import the module
 * @param key The prefetch key for tracking
 * @param options Additional prefetch options
 * @returns A handle to monitor and control the prefetch operation
 */
export const warmRoute = (
  importer: () => Promise<unknown>,
  key: PrefetchKey,
  options: WarmRouteOptions,
): PrefetchHandle => prefetch({ key, importer, ...options });

/**
 * Initiates a prefetch operation by looking up the importer from the registry.
 * @param key The prefetch key to look up
 * @param source The source triggering the prefetch
 * @param options Additional prefetch options
 * @returns A prefetch handle, or null if the key is not registered
 */
export const prefetchByKey = (
  key: PrefetchKey,
  source: PrefetchSource,
  options?: Partial<PrefetchRequest>,
): PrefetchHandle | null => {
  const importer = registry[key];
  if (!importer) {
    return null;
  }
  return prefetch({ key, importer, source, ...options });
};

/**
 * Prefetches neighboring routes after an idle delay.
 * @param key The current route key to find neighbors for
 * @note Neighbors are prefetched with 'idle' source after a 500ms timeout
 */
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

/**
 * Dynamically registers a new prefetch importer.
 * @param key The prefetch key to register
 * @param loader The importer function for this key
 */
export const registerPrefetch = (key: PrefetchKey, loader: () => Promise<unknown>): void => {
  registry[key] = loader;
};

/**
 * Dynamically registers neighbor relationships for a route.
 * @param key The route key
 * @param next Array of neighboring route keys to prefetch
 */
export const registerNeighbors = (key: PrefetchKey, next: PrefetchKey[]): void => {
  neighbors[key] = next;
};
