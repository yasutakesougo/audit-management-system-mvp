import { fetchSp } from '@/lib/fetchSp';
import { isE2eMsalMockEnabled, readBool, readEnv } from '@/lib/env';
import { acquireSpAccessToken } from '@/lib/msal';

// Lightweight schedules client with TTL cache + optional dev fixtures.
// Switches to fixtures automatically if SharePoint config is missing or VITE_SCHEDULE_FIXTURES=1.

export type ScheduleCategory = 'Org' | 'Staff' | 'User';

export interface ScheduleEvent {
  id: string | number;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay?: boolean;
  category: ScheduleCategory;
  personName?: string;
  staffIds?: string[];
  staffNames?: string[];
  dayKey?: string; // e.g., '2025-10-06'
  // keep room for SharePoint fields if needed
  // raw?: unknown;
}

type Range = { fromISO: string; toISO: string };

const TTL_MS = 15_000;
type CacheValue<T> = { at: number; data: T };
const cache = new Map<string, CacheValue<ScheduleEvent[]>>();

type ScheduleEnv = ImportMetaEnv & {
  readonly VITE_SCHEDULE_FIXTURES?: string;
  readonly VITE_SP_SITE_ID?: string;
  readonly VITE_SP_SITE_URL?: string;
  readonly VITE_SP_BASE_URL?: string;
  readonly VITE_SP_RESOURCE?: string;
  readonly VITE_SP_SITE_RELATIVE?: string;
  readonly VITE_SP_LIST_SCHEDULES?: string;
  readonly VITE_SP_USE_PROXY?: string;
  readonly VITE_E2E_MSAL_MOCK?: string;
};

const env = import.meta.env as ScheduleEnv;
const PROXY_PREFIX = '/sharepoint-api';
const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const preferProxyFetch = TRUTHY.has((env.VITE_SP_USE_PROXY ?? '').trim().toLowerCase());
const siteBaseUrl = resolveSiteBaseUrl();

export function clearSchedulesCache() {
  cache.clear();
}

function keyFor(category: ScheduleCategory, r: Range) {
  return `${category}:${r.fromISO}|${r.toISO}`;
}

function now() {
  return Date.now();
}

function isExpired(v: CacheValue<unknown>) {
  return now() - v.at > TTL_MS;
}

function resolveFixturesMode(): boolean {
  if (isE2eMsalMockEnabled()) {
    return true;
  }
  if (readBool('VITE_SCHEDULE_FIXTURES', false)) {
    return true;
  }
  const siteIdInline = (env.VITE_SP_SITE_ID ?? '').trim();
  if (siteIdInline) {
    return false;
  }
  const siteIdRuntime = readEnv('VITE_SP_SITE_ID', '').trim();
  return !siteIdRuntime;
}

export function isScheduleFixturesMode(): boolean {
  return resolveFixturesMode();
}

// --- DEV FIXTURES (deterministic) -------------------------------------------------
const fixtures: Record<ScheduleCategory, ScheduleEvent[]> = {
  Org: [
    {
      id: 1001,
      title: '所内ミーティング',
      start: '2025-10-06T09:00:00+09:00',
      end: '2025-10-06T10:00:00+09:00',
      category: 'Org',
      dayKey: '2025-10-06',
    },
  ],
  Staff: [
    {
      id: 9201,
      title: '午前会議',
      start: '2025-10-06T09:00:00+09:00',
      end: '2025-10-06T12:00:00+09:00',
      category: 'Staff',
      personName: '吉田 千尋',
      staffIds: ['401'],
      staffNames: ['吉田 千尋'],
      dayKey: '2025-10-06',
    },
  ],
  User: [
    {
      id: 31001,
      title: 'I022 作業プログラム',
      start: '2025-10-06T13:30:00+09:00',
      end: '2025-10-06T15:00:00+09:00',
      category: 'User',
      personName: '中村 裕樹',
      dayKey: '2025-10-06',
    },
  ],
};

function filterByRange(data: ScheduleEvent[], r: Range) {
  const from = new Date(r.fromISO).getTime();
  const to = new Date(r.toISO).getTime();
  return data.filter((e) => {
    const s = new Date(e.start).getTime();
    const t = new Date(e.end).getTime();
    return t >= from && s <= to;
  });
}

function sortByStartAsc(a: ScheduleEvent, b: ScheduleEvent) {
  const da = new Date(a.start).getTime();
  const db = new Date(b.start).getTime();
  return da === db ? Number(a.id) - Number(b.id) : da - db;
}

// --- PUBLIC API -------------------------------------------------------------------
export async function getSchedules(
  category: ScheduleCategory,
  r: Range,
  opts?: { signal?: AbortSignal },
): Promise<ScheduleEvent[]> {
  const key = keyFor(category, r);
  const hit = cache.get(key);
  if (hit && !isExpired(hit)) return hit.data;

  let data: ScheduleEvent[];
  const fixturesMode = resolveFixturesMode();
  if (fixturesMode) {
    console.info('[schedulesClient] fixtures=true');
    data = filterByRange(fixtures[category] ?? [], r).sort(sortByStartAsc);
  } else {
    console.info('[schedulesClient] fixtures=false');
    // Real fetch (SharePoint/Graph). Keep it minimal; wire later as needed.
    // Example SP list endpoint structure can be adapted here.
    const request = buildSharePointRequest(category, r);
    const requestInit: RequestInit = {
      signal: opts?.signal,
      headers: {
        Accept: 'application/json;odata=nometadata',
      },
    };

    const res = await executeSharePointFetch(category, request, requestInit);
    if (!res.ok) throw new Error(`SP fetch failed: ${res.status}`);
    const json = (await res.json()) as SharePointResponse;
    data = (json.value ?? []).map(spToEvent).map(coerceAllDay).sort(sortByStartAsc);
  }

  cache.set(key, { at: now(), data });
  return data;
}

export function getOrgSchedules(r: Range, opts?: { signal?: AbortSignal }) {
  return getSchedules('Org', r, opts);
}
export function getStaffSchedules(r: Range, opts?: { signal?: AbortSignal }) {
  return getSchedules('Staff', r, opts);
}
export function getUserSchedules(r: Range, opts?: { signal?: AbortSignal }) {
  return getSchedules('User', r, opts);
}

export async function getComposedWeek(r: Range, opts?: { signal?: AbortSignal }) {
  const [org, staff, user] = await Promise.all([
    getOrgSchedules(r, opts),
    getStaffSchedules(r, opts),
    getUserSchedules(r, opts),
  ]);
  return [...org, ...staff, ...user].sort(sortByStartAsc);
}

// --- SP wiring helpers (skeletal; fill to your schema) ----------------------------
function buildSharePointRequest(category: ScheduleCategory, r: Range) {
  const path = buildSpQueryPath(category, r);
  return {
    path,
    proxyUrl: `${PROXY_PREFIX}${path}`,
    absoluteUrl: `${siteBaseUrl}${path}`,
  } as const;
}

async function executeSharePointFetch(category: ScheduleCategory, request: ReturnType<typeof buildSharePointRequest>, init: RequestInit) {
  if (preferProxyFetch) {
    try {
      const accessToken = await acquireSpAccessToken();
      const proxyInit = buildProxyInit(init, accessToken);
      const proxyRes = await fetch(request.proxyUrl, proxyInit);
      console.info('[schedulesClient] fetch', { category, url: request.proxyUrl, via: 'proxy', status: proxyRes.status });
      if (proxyRes.status !== 403) {
        return proxyRes;
      }
      console.warn('[schedulesClient] SharePoint proxy returned 403, falling back to direct fetch.');
    } catch (error) {
      console.warn('[schedulesClient] proxy fetch failed, retrying direct SharePoint call.', error);
    }
  }

  const directRes = await fetchSp(request.absoluteUrl, init);
  console.info('[schedulesClient] fetch', { category, url: request.absoluteUrl, via: 'direct', status: directRes.status });
  return directRes;
}

function buildProxyInit(init: RequestInit, accessToken: string): RequestInit {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json;odata=nometadata');
  }
  headers.set('Authorization', `Bearer ${accessToken}`);
  return { ...init, headers };
}

function buildSpQueryPath(category: ScheduleCategory, r: Range): string {
  const listKey = resolveSchedulesListIdentifier();
  const fromUtc = new Date(r.fromISO).toISOString();
  const toUtc = new Date(r.toISO).toISOString();
  const filter = `(cr014_category eq '${category}') and (EventDate le datetime'${toUtc}') and (EndDate ge datetime'${fromUtc}')`;
  const select = 'Id,Title,EventDate,EndDate,AllDay,cr014_category,cr014_personName,cr014_staffIds,cr014_staffNames,@odata.etag';
  const params = new URLSearchParams({
    $top: '500',
    $filter: filter,
    $orderby: 'EventDate asc,Id asc',
    $select: select,
  });
  return `/_api/web/${listKey}/items?${params.toString()}`;
}

function resolveSchedulesListIdentifier(): string {
  const raw = (env.VITE_SP_LIST_SCHEDULES ?? 'ScheduleEvents').trim();
  if (!raw) return "lists/getbytitle('ScheduleEvents')";
  if (/^guid:/i.test(raw)) {
    const guid = raw.replace(/^guid:/i, '').replace(/[{}]/g, '').trim();
    return guid ? `lists(guid'${guid}')` : "lists/getbytitle('ScheduleEvents')";
  }
  const escaped = raw.replace(/'/g, "''");
  return `lists/getbytitle('${escaped}')`;
}

function resolveSiteBaseUrl(): string {
  const candidates = [env.VITE_SP_SITE_URL, env.VITE_SP_BASE_URL];
  const siteRelative = (() => {
    const raw = env.VITE_SP_SITE_RELATIVE ?? '';
    if (!raw.trim()) return '';
    return raw.startsWith('/') ? raw : `/${raw}`;
  })();
  if (!candidates[0] && env.VITE_SP_RESOURCE && siteRelative) {
    candidates.push(`${env.VITE_SP_RESOURCE.replace(/\/?$/, '')}${siteRelative}`);
  }
  const resolved = candidates.find((value) => value && value.trim());
  const normalized = (resolved ?? 'https://contoso.sharepoint.com/sites/Audit').replace(/\/?$/, '');
  return normalized;
}

interface SharePointResponse {
  readonly value?: ReadonlyArray<ScheduleSpItem>;
}

type ScheduleSpItem = {
  readonly Id: string | number;
  readonly Title: string;
  readonly EventDate: string;
  readonly EndDate: string;
  readonly AllDay?: boolean;
  readonly cr014_category: ScheduleCategory;
  readonly cr014_personName?: string;
  readonly cr014_staffIds?: string[];
  readonly cr014_staffNames?: string[];
  readonly cr014_dayKey?: string;
};

function normalizeCategory(value: string | null | undefined): ScheduleCategory {
  if (!value) return 'Org';
  const normalized = value.toString().trim().toLowerCase();
  if (['org', '組織', '団体'].some((key) => normalized.includes(key))) return 'Org';
  if (['staff', '職員', 'スタッフ'].some((key) => normalized.includes(key))) return 'Staff';
  if (['user', '利用者', 'ユーザー'].some((key) => normalized.includes(key))) return 'User';
  return 'Org';
}

function coerceAllDay(event: ScheduleEvent): ScheduleEvent {
  if (!event.allDay) return event;
  const startTime = new Date(event.start).getTime();
  const endTime = new Date(event.end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return event;
  }
  if (endTime <= startTime) {
    const nextDay = new Date(startTime + 86_400_000).toISOString();
    return { ...event, end: nextDay };
  }
  return event;
}

function spToEvent(item: ScheduleSpItem): ScheduleEvent {
  return {
    id: item.Id,
    title: item.Title,
    start: item.EventDate,
    end: item.EndDate,
    allDay: !!item.AllDay,
    category: normalizeCategory(item.cr014_category),
    personName: item.cr014_personName,
    staffIds: item.cr014_staffIds,
    staffNames: item.cr014_staffNames,
    dayKey: (item.cr014_dayKey as string) ?? undefined,
    // raw: item,
  };
}
