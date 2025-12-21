import { isE2eMsalMockEnabled, readBool, readEnv, readOptionalEnv } from '@/lib/env';
import { fetchSp } from '@/lib/fetchSp';
import { acquireSpAccessToken } from '@/lib/msal';

import type { OrgFilterKey } from '../orgFilters';

// Lightweight schedules client with TTL cache + optional dev fixtures.
// Switches to fixtures automatically if SharePoint config is missing or VITE_SCHEDULE_FIXTURES=1.

export type ScheduleCategory = 'Org' | 'Staff' | 'User';

export interface BaseShiftWarning {
  staffId: string;
  staffName?: string;
  reasons: Array<'day' | 'time' | 'span'>;
}

export interface ScheduleEvent {
  id: string | number;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay?: boolean;
  category: ScheduleCategory;
  personName?: string;
  targetUserNames?: string[];
  targetUserEmails?: string[];
  targetUserIds?: string[];
  staffIds?: string[];
  staffNames?: string[];
  staffEmails?: string[];
  dayKey?: string; // e.g., '2025-10-06'
  etag?: string;
  orgCode?: OrgFilterKey;
  baseShiftWarnings?: BaseShiftWarning[];
  // keep room for SharePoint fields if needed
  // raw?: unknown;
}

type Range = { fromISO: string; toISO: string };

const TTL_MS = 15_000;
type CacheValue<T> = { at: number; data: T };
const cache = new Map<string, CacheValue<ScheduleEvent[]>>();

const PROXY_PREFIX = '/sharepoint-api';
const preferProxyFetch = readBool('VITE_SP_USE_PROXY', false);
const siteBaseUrl = resolveSiteBaseUrl();
const scheduleCategoryField = resolveScheduleCategoryField();
// Keep select/expand lists tightly scoped so SharePoint accepts the query.
const scheduleSelectFields = createScheduleSelectFields(scheduleCategoryField);
const scheduleExpandFields = ['AssignedStaff', 'TargetUser', 'Author', 'Editor'] as const;

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

function resolveFixturesOverride(): boolean | null {
  const raw = readOptionalEnv('VITE_SCHEDULE_FIXTURES');
  if (raw == null) {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized === 'auto' || normalized === 'default') {
    return null;
  }
  if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(normalized)) {
    return false;
  }
  return null;
}

function resolveFixturesMode(): boolean {
  const override = resolveFixturesOverride();
  if (override !== null) {
    return override;
  }
  if (readBool('VITE_FORCE_SHAREPOINT', false) || readBool('VITE_FEATURE_SCHEDULES_SP', false)) {
    return false;
  }
  if (isE2eMsalMockEnabled()) {
    return true;
  }
  if (readBool('VITE_SCHEDULE_FIXTURES', false)) {
    return true;
  }
  const siteId = readEnv('VITE_SP_SITE_ID', '').trim();
  return !siteId;
}

export function isScheduleFixturesMode(): boolean {
  return resolveFixturesMode();
}

/**
 * Read scenario parameter from URL for E2E testing
 */
function getScenarioFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('scenario');
  } catch {
    return null;
  }
}

/**
 * Get fixtures for the given scenario or default fixtures
 */
function getFixturesForScenario(scenario: string | null): Record<ScheduleCategory, ScheduleEvent[]> {
  if (scenario === 'conflicts-basic') {
    console.info('[schedulesClient] Using conflicts-basic fixtures');
    return conflictsBasicFixtures;
  }
  return fixtures;
}

// --- DEV FIXTURES (deterministic) -------------------------------------------------
const fixtures: Record<ScheduleCategory, ScheduleEvent[]> = {
  Org: [
    {
      id: 8301,
      title: '連絡会議',
      start: '2025-10-07T13:30:00+09:00',
      end: '2025-10-07T14:30:00+09:00',
      category: 'Org',
      dayKey: '2025-10-07',
      orgCode: 'main',
    },
    {
      id: 1001,
      title: '所内ミーティング',
      start: '2025-11-14T09:00:00+09:00',
      end: '2025-11-14T10:00:00+09:00',
      category: 'Org',
      dayKey: '2025-11-14',
      orgCode: 'main',
    },
    {
      id: 1002,
      title: 'スタッフ研修',
      start: '2025-11-15T14:00:00+09:00',
      end: '2025-11-15T16:00:00+09:00',
      category: 'Org',
      dayKey: '2025-11-15',
      orgCode: 'main',
    },
  ],
  Staff: [
    {
      id: 8201,
      title: '午前会議',
      start: '2025-10-07T09:00:00+09:00',
      end: '2025-10-07T12:00:00+09:00',
      category: 'Staff',
      personName: '吉田 千尋',
      staffIds: ['401'],
      staffNames: ['吉田 千尋'],
      dayKey: '2025-10-07',
      orgCode: 'main',
    },
    {
      id: 9201,
      title: '午前会議',
      start: '2025-11-14T09:00:00+09:00',
      end: '2025-11-14T12:00:00+09:00',
      category: 'Staff',
      personName: '吉田 千尋',
      staffIds: ['401'],
      staffNames: ['吉田 千尋'],
      dayKey: '2025-11-14',
      orgCode: 'main',
    },
    {
      id: 9202,
      title: '個別支援会議',
      start: '2025-11-14T14:00:00+09:00',
      end: '2025-11-14T15:30:00+09:00',
      category: 'Staff',
      personName: '佐藤 美穂',
      staffIds: ['402'],
      staffNames: ['佐藤 美穂'],
      dayKey: '2025-11-14',
      orgCode: 'shortstay',
    },
  ],
  User: [
    {
      id: 8101,
      title: '訪問リハビリ',
      start: '2025-10-07T09:00:00+09:00',
      end: '2025-10-07T09:30:00+09:00',
      category: 'User',
      personName: '川崎 朗',
      targetUserNames: ['川崎 朗'],
      targetUserIds: ['U-101'],
      staffIds: ['301'],
      staffNames: ['阿部 真央'],
      dayKey: '2025-10-07',
      orgCode: 'main',
    },
    {
      id: 8102,
      title: '訪問看護',
      start: '2025-10-07T09:15:00+09:00',
      end: '2025-10-07T10:00:00+09:00',
      category: 'User',
      personName: '古山 美紀',
      targetUserNames: ['古山 美紀'],
      targetUserIds: ['U-102'],
      staffIds: ['302'],
      staffNames: ['蒼井 純'],
      dayKey: '2025-10-07',
      orgCode: 'main',
    },
    {
      id: 8103,
      title: '夜間対応',
      start: '2025-10-06T23:30:00+09:00',
      end: '2025-10-07T01:00:00+09:00',
      category: 'User',
      personName: '斎藤 遼',
      targetUserNames: ['斎藤 遼'],
      targetUserIds: ['U-103'],
      staffIds: ['303'],
      staffNames: ['佐伯 由真'],
      dayKey: '2025-10-06',
      orgCode: 'main',
    },
    // 生活介護（通所）
    {
      id: 31001,
      title: '田中 太郎 - 生活介護',
      start: '2025-11-14T09:00:00+09:00',
      end: '2025-11-14T15:00:00+09:00',
      category: 'User',
      personName: '田中 太郎',
      targetUserNames: ['田中 太郎'],
      targetUserIds: ['USER001'],
      dayKey: '2025-11-14',
      orgCode: 'main',
    },
    // ショートステイ（生活支援） - 生活介護と重複
    {
      id: 31002,
      title: '田中 太郎 - ショートステイ',
      start: '2025-11-14T10:00:00+09:00',
      end: '2025-11-14T16:00:00+09:00',
      category: 'User',
      personName: '田中 太郎',
      targetUserNames: ['田中 太郎'],
      targetUserIds: ['USER001'],
      staffIds: ['402'],
      staffNames: ['佐藤 美穂'],
      dayKey: '2025-11-14',
      orgCode: 'shortstay',
    },
    // 一時ケア（生活支援）
    {
      id: 31003,
      title: '山田 花子 - 一時ケア',
      start: '2025-11-14T13:00:00+09:00',
      end: '2025-11-14T17:00:00+09:00',
      category: 'User',
      personName: '山田 花子',
      targetUserNames: ['山田 花子'],
      targetUserIds: ['USER002'],
      staffIds: ['403'],
      staffNames: ['鈴木 一郎'],
      dayKey: '2025-11-14',
      orgCode: 'respite',
    },
    // 山田 花子の別の一時ケア（生活支援同士の重複）
    {
      id: 31004,
      title: '山田 花子 - 一時ケア（追加）',
      start: '2025-11-14T15:00:00+09:00',
      end: '2025-11-14T18:00:00+09:00',
      category: 'User',
      personName: '山田 花子',
      targetUserNames: ['山田 花子'],
      targetUserIds: ['USER002'],
      staffIds: ['404'],
      staffNames: ['高橋 次郎'],
      dayKey: '2025-11-14',
      orgCode: 'respite',
    },
    // 佐藤 美穂の個別支援会議と重複するショートステイ
    {
      id: 31005,
      title: '佐々木 三郎 - ショートステイ',
      start: '2025-11-14T14:30:00+09:00',
      end: '2025-11-14T19:00:00+09:00',
      category: 'User',
      personName: '佐々木 三郎',
      targetUserNames: ['佐々木 三郎'],
      targetUserIds: ['USER003'],
      staffIds: ['402'], // 佐藤 美穂と同じスタッフ
      staffNames: ['佐藤 美穂'],
      dayKey: '2025-11-14',
      orgCode: 'shortstay',
    },
    // 通常の生活介護
    {
      id: 31006,
      title: '鈴木 四郎 - 生活介護',
      start: '2025-11-14T09:30:00+09:00',
      end: '2025-11-14T15:30:00+09:00',
      category: 'User',
      personName: '鈴木 四郎',
      targetUserNames: ['鈴木 四郎'],
      targetUserIds: ['USER004'],
      dayKey: '2025-11-14',
      orgCode: 'main',
    },
  ],
};

// Conflict fixtures for testing - events with baseShiftWarnings
const conflictsBasicFixtures: Record<ScheduleCategory, ScheduleEvent[]> = {
  Org: [
    {
      id: 1001,
      title: '所内ミーティング',
      start: '2025-11-14T09:00:00+09:00',
      end: '2025-11-14T10:00:00+09:00',
      category: 'Org',
      dayKey: '2025-11-14',
      orgCode: 'main',
    },
  ],
  Staff: [
    {
      id: 9201,
      title: '午前会議',
      start: '2025-11-14T09:00:00+09:00',
      end: '2025-11-14T12:00:00+09:00',
      category: 'Staff',
      personName: '吉田 千尋',
      staffIds: ['401'],
      staffNames: ['吉田 千尋'],
      dayKey: '2025-11-14',
      orgCode: 'main',
      // This staff event has warnings
      baseShiftWarnings: [
        { staffId: '401', staffName: '吉田 千尋', reasons: ['time'] },
      ],
    },
    {
      id: 9202,
      title: '個別支援会議',
      start: '2025-11-14T14:00:00+09:00',
      end: '2025-11-14T15:30:00+09:00',
      category: 'Staff',
      personName: '佐藤 美穂',
      staffIds: ['402'],
      staffNames: ['佐藤 美穂'],
      dayKey: '2025-11-14',
      orgCode: 'shortstay',
      baseShiftWarnings: [
        { staffId: '402', staffName: '佐藤 美穂', reasons: ['span'] },
      ],
    },
  ],
  User: [
    {
      id: 31001,
      title: '田中 太郎 - 生活介護',
      start: '2025-11-14T09:00:00+09:00',
      end: '2025-11-14T15:00:00+09:00',
      category: 'User',
      personName: '田中 太郎',
      targetUserNames: ['田中 太郎'],
      targetUserIds: ['USER001'],
      dayKey: '2025-11-14',
      orgCode: 'main',
      // User event with conflict warning
      baseShiftWarnings: [
        { staffId: '301', staffName: '担当者A', reasons: ['day', 'time'] },
      ],
    },
    {
      id: 31002,
      title: '田中 太郎 - ショートステイ',
      start: '2025-11-14T10:00:00+09:00',
      end: '2025-11-14T16:00:00+09:00',
      category: 'User',
      personName: '田中 太郎',
      targetUserNames: ['田中 太郎'],
      targetUserIds: ['USER001'],
      staffIds: ['402'],
      staffNames: ['佐藤 美穂'],
      dayKey: '2025-11-14',
      orgCode: 'shortstay',
      baseShiftWarnings: [
        { staffId: '402', staffName: '佐藤 美穂', reasons: ['time'] },
      ],
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
    const scenario = getScenarioFromUrl();
    const fixtureData = getFixturesForScenario(scenario);
    console.info('[schedulesClient] fixtures=true', scenario ? `scenario=${scenario}` : '');
    data = filterByRange(fixtureData[category] ?? [], r).sort(sortByStartAsc);
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

    const items = await fetchSharePointItems(category, request, requestInit);
    data = items.map(spToEvent).map(coerceAllDay).sort(sortByStartAsc);
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

async function fetchSharePointItems(
  category: ScheduleCategory,
  request: ReturnType<typeof buildSharePointRequest>,
  init: RequestInit,
): Promise<ScheduleSpItem[]> {
  const collected: ScheduleSpItem[] = [];
  const firstResponse = await executeSharePointFetch(category, request, init);
  if (!firstResponse.ok) {
    throw new Error(`SP fetch failed: ${firstResponse.status}`);
  }
  const firstBody = (await firstResponse.json()) as SharePointResponse;
  collected.push(...(firstBody.value ?? []));

  let next = resolveNextLink(firstBody);
  while (next) {
    const normalizedNext = normalizeNextLink(next);
    const pageResponse = await fetchSp(normalizedNext, init);
    console.info('[schedulesClient] fetch', { category, url: normalizedNext, via: 'direct', status: pageResponse.status });
    if (!pageResponse.ok) {
      throw new Error(`SP fetch failed (page): ${pageResponse.status}`);
    }
    const body = (await pageResponse.json()) as SharePointResponse;
    collected.push(...(body.value ?? []));
    next = resolveNextLink(body);
  }

  return collected;
}

function normalizeNextLink(value: string): string {
  if (/^https?:/i.test(value)) {
    return value;
  }
  if (!value.trim()) {
    return value;
  }
  const suffix = value.startsWith('/') ? value : `/${value}`;
  return `${siteBaseUrl}${suffix}`;
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
  const filter = `(${scheduleCategoryField} eq '${category}') and (EventDate lt datetime'${toUtc}') and (EndDate ge datetime'${fromUtc}')`;
  const params = new URLSearchParams({
    $top: '500',
    $filter: filter,
    $orderby: 'EventDate asc,Id asc',
    $select: scheduleSelectFields.join(','),
    $expand: scheduleExpandFields.join(','),
  });
  return `/_api/web/${listKey}/items?${params.toString()}`;
}

function resolveSchedulesListIdentifier(): string {
  const raw = readEnv('VITE_SP_LIST_SCHEDULES', 'ScheduleEvents').trim();
  if (!raw) return "lists/getbytitle('ScheduleEvents')";
  if (/^guid:/i.test(raw)) {
    const guid = raw.replace(/^guid:/i, '').replace(/[{}]/g, '').trim();
    return guid ? `lists(guid'${guid}')` : "lists/getbytitle('ScheduleEvents')";
  }
  const escaped = raw.replace(/'/g, "''");
  return `lists/getbytitle('${escaped}')`;
}

function resolveScheduleCategoryField(): string {
  const raw = readEnv('VITE_SP_SCHEDULE_CATEGORY', '').trim();
  return raw || 'cr014_category';
}

function createScheduleSelectFields(categoryField: string): string[] {
  const fields: string[] = ['Id', 'Title', 'EventDate', 'EndDate', 'AllDay'];
  const ensure = (value: string) => {
    if (!value || fields.includes(value)) {
      return;
    }
    fields.push(value);
  };
  ensure(categoryField);
  ensure('Category');
  [
    'AssignedStaffId',
    'TargetUserId',
    'AssignedStaff/Id',
    'AssignedStaff/Title',
    'AssignedStaff/EMail',
    'TargetUser/Id',
    'TargetUser/Title',
    'TargetUser/EMail',
    'Author/Title',
    'Editor/Title',
  ].forEach(ensure);
  return fields;
}

function resolveSiteBaseUrl(): string {
  const candidates = [readEnv('VITE_SP_SITE_URL', ''), readEnv('VITE_SP_BASE_URL', '')];
  const siteRelative = (() => {
    const raw = readEnv('VITE_SP_SITE_RELATIVE', '');
    if (!raw.trim()) return '';
    return raw.startsWith('/') ? raw : `/${raw}`;
  })();
  const resource = readEnv('VITE_SP_RESOURCE', '').replace(/\/?$/, '');
  if (!candidates[0] && resource && siteRelative) {
    candidates.push(`${resource}${siteRelative}`);
  }
  const resolved = candidates.find((value) => value && value.trim());
  const normalized = (resolved ?? 'https://contoso.sharepoint.com/sites/Audit').replace(/\/?$/, '');
  return normalized;
}

interface SharePointResponse {
  readonly value?: ReadonlyArray<ScheduleSpItem>;
  readonly '@odata.nextLink'?: string;
  readonly ['odata.nextLink']?: string;
}

type SharePointUser = {
  readonly Id?: number;
  readonly Title?: string;
  readonly EMail?: string;
  readonly Email?: string;
};

type ScheduleSpItem = {
  readonly Id: string | number;
  readonly Title: string;
  readonly EventDate?: string;
  readonly EndDate?: string;
  readonly Start?: string;
  readonly End?: string;
  readonly StartUtc?: string;
  readonly EndUtc?: string;
  readonly AllDay?: boolean;
  readonly Category?: string;
  readonly cr014_category?: string;
  readonly cr014_personName?: string;
  readonly cr014_staffIds?: string[];
  readonly cr014_staffNames?: string[];
  readonly cr014_dayKey?: string;
  readonly UserId?: string | number | null;
  readonly StaffId?: string | number | null;
  readonly AssignedStaffId?: number | readonly number[] | null;
  readonly TargetUserId?: number | readonly number[] | null;
  readonly AssignedStaff?: SharePointUser | SharePointUser[] | null;
  readonly TargetUser?: SharePointUser | SharePointUser[] | null;
  readonly Author?: SharePointUser | null;
  readonly Editor?: SharePointUser | null;
  readonly '@odata.etag'?: string;
};

function resolveNextLink(payload: SharePointResponse): string | undefined {
  return payload['@odata.nextLink'] ?? payload['odata.nextLink'];
}

function normalizeIso(value: string): string {
  const trimmed = value.trim();
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return trimmed;
  }
  return new Date(parsed).toISOString();
}

function toUserArray(value: SharePointUser | SharePointUser[] | null | undefined): SharePointUser[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.slice();
  }
  return [value as SharePointUser];
}

function toLookupIdList(value: unknown): string[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const parsed = value
      .map((entry) => (typeof entry === 'number' ? entry : Number.parseInt(`${entry}`, 10)))
      .filter((num) => Number.isFinite(num))
      .map((num) => String(num));
    return parsed.length ? parsed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return [String(value)];
  }
  const raw = `${value}`.trim();
  if (!raw) return undefined;
  const segments = raw.split(/;#|,/).map((segment) => segment.trim()).filter(Boolean);
  return segments.length ? segments : undefined;
}

function userIdentifierList(users: SharePointUser[]): string[] {
  const identifiers = users
    .map((user) => user?.EMail?.trim() || user?.Email?.trim() || (typeof user?.Id === 'number' ? String(user.Id) : ''))
    .filter((value): value is string => Boolean(value && value.trim()));
  return [...new Set(identifiers.map((value) => value.trim()))];
}

function extractUserNames(users: SharePointUser[]): string[] {
  return [...new Set(users.map((user) => user?.Title?.trim()).filter((value): value is string => Boolean(value)))];
}

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

function pickDate(...values: ReadonlyArray<string | undefined>): string {
  const match = values.find((value) => typeof value === 'string' && value.trim());
  if (!match) {
    throw new Error('SharePoint item missing required date fields.');
  }
  return normalizeIso(match);
}

function deriveDayKey(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return undefined;
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function spToEvent(item: ScheduleSpItem): ScheduleEvent {
  const start = pickDate(item.StartUtc, item.Start, item.EventDate);
  const end = pickDate(item.EndUtc, item.End, item.EndDate);
  const dynamicCategory = (item as Record<string, unknown>)[scheduleCategoryField];
  const categoryRaw = (typeof dynamicCategory === 'string' ? dynamicCategory : undefined) ?? item.cr014_category ?? item.Category ?? null;
  const assignedUsers = toUserArray(item.AssignedStaff);
  const targetUsers = toUserArray(item.TargetUser);
  const staffLookupIds = toLookupIdList(item.AssignedStaffId);
  const targetLookupIds = toLookupIdList(item.TargetUserId);
  const staffIdentifiers = userIdentifierList(assignedUsers);
  const staffIds = item.cr014_staffIds ?? staffLookupIds ?? staffIdentifiers;
  const staffNames = item.cr014_staffNames ?? extractUserNames(assignedUsers);
  const staffEmails = staffIdentifiers.length ? staffIdentifiers : undefined;
  const targetUserIdentifiers = userIdentifierList(targetUsers);
  const targetUserEmails = targetUserIdentifiers;
  const targetUserNames = extractUserNames(targetUsers);
  const personName = item.cr014_personName ?? targetUserNames[0] ?? undefined;
  return {
    id: item.Id,
    title: item.Title,
    start,
    end,
    allDay: !!item.AllDay,
    category: normalizeCategory(categoryRaw),
    personName,
    targetUserNames: targetUserNames.length ? targetUserNames : undefined,
  targetUserEmails: targetUserEmails.length ? targetUserEmails : undefined,
  targetUserIds: targetLookupIds?.length ? targetLookupIds : undefined,
    staffIds,
    staffNames: staffNames && staffNames.length ? staffNames : undefined,
    staffEmails,
    dayKey: (item.cr014_dayKey as string) ?? deriveDayKey(start),
    etag: item['@odata.etag'],
    // raw: item,
  };
}
