import type { Page, Request, Route } from '@playwright/test';

type HttpResponseInit = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

type CreateContext<TItem> = {
  takeNextId: () => number;
  listName: string;
  request: Request;
  items: TItem[];
};

type UpdateContext<TItem> = {
  request: Request;
  previous: TItem;
  listName: string;
};

type ListStubConfig<TItem extends Record<string, unknown> = Record<string, unknown>> = {
  name: string;
  aliases?: readonly string[];
  items?: TItem[];
  nextId?: number;
  insertPosition?: 'start' | 'end';
  pageSize?: number;
  sort?: (items: TItem[]) => TItem[];
  onCreate?: (payload: unknown, ctx: CreateContext<TItem>) => TItem;
  fields?: Array<{ InternalName: string; Title?: string; TypeAsString?: string }>;
  onUpdate?: (id: number, payload: unknown, ctx: UpdateContext<TItem>) => TItem;
};

type SetupSharePointStubsOptions = {
  lists?: ListStubConfig[];
  currentUser?: HttpResponseInit;
  fallback?: HttpResponseInit | ((request: Request) => Promise<HttpResponseInit | null> | HttpResponseInit | null);
  debug?: boolean;
};

type ListState<TItem extends Record<string, unknown> = Record<string, unknown>> = {
  config: ListStubConfig<TItem>;
  items: TItem[];
  nextId: number;
};

type ScheduleRecord = Record<string, unknown>;

let scheduleStore: ScheduleRecord[] = [];

export const resetScheduleStore = (next: ScheduleRecord[]): void => {
  scheduleStore = next.map((item) => cloneRecord(item));
};

const ensureText = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const normalizeScheduleRecord = (rec: ScheduleRecord): ScheduleRecord => {
  const title = ensureText(rec['Title']) ?? ensureText(rec['cr014_title']);
  const service = ensureText(rec['ServiceType']) ?? ensureText(rec['cr014_serviceType']);
  if (title) { rec['Title'] = title; rec['cr014_title'] = title; }
  if (service) { rec['ServiceType'] = service; rec['cr014_serviceType'] = service; }
  if (!rec['Status']) rec['Status'] = '予定';
  return rec;
};

const isScheduleList = (config: ListStubConfig): boolean => {
  const names = [config.name, ...(config.aliases ?? [])].map(normalizeName);
  return names.some((n) => ['schedules', 'scheduleevents', 'schedules_master', 'supportschedule'].includes(n));
};

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json;odata=nometadata; charset=utf-8',
  'Cache-Control': 'no-store',
};

const DEFAULT_CURRENT_USER: HttpResponseInit = {
  status: 200,
  body: { Id: 1, Title: 'Mock User', Email: 'mock@example.com' },
};

const normalizeName = (value: string): string => value.trim().toLowerCase();

const computeNextId = (items: Array<Record<string, unknown>>): number => {
  let max = 0;
  for (const item of items) {
    const candidate = item?.['Id'];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) max = Math.max(max, candidate);
  }
  return max + 1;
};

const cloneRecord = <T extends Record<string, unknown>>(value: T): T => {
  try { return JSON.parse(JSON.stringify(value)) as T; } catch { return { ...value } as T; }
};

const toJsonBody = (body: unknown): string => {
  if (body === undefined || body === null) return '';
  if (typeof body === 'string') return body;
  try { return JSON.stringify(body); } catch { return ''; }
};

const normalizeBody = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== 'object') return {};
  const rec = body as Record<string, unknown>;
  if ('d' in rec && rec.d && typeof rec.d === 'object') {
    return rec.d as Record<string, unknown>;
  }
  return rec;
};

const fulfill = async (route: Route, init: HttpResponseInit) => {
  const status = init.status ?? 200;
  const body = toJsonBody(init.body);
  const headers = { ...JSON_HEADERS, ...init.headers };
  await route.fulfill({ status, headers, body });
};

const parseRequestBody = (request: Request): unknown => {
  try { const raw = request.postData(); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
};

const matchListPath = (pathname: string) => {
  const decoded = decodeURIComponent(pathname);
  const byTitle = decoded.match(/\/_api\/web\/lists\/getbytitle\('([^']+)'\)(.*)$/i);
  return byTitle ? { key: byTitle[1], remainder: byTitle[2] ?? '' } : null;
};

export async function setupSharePointStubs(page: Page, options: SetupSharePointStubsOptions = {}): Promise<void> {
  const nameMap = new Map<string, ListState>();
  const _debug = options.debug ?? false;

  for (const config of options.lists ?? []) {
    const baseItems = Array.isArray(config.items) ? config.items.map((item) => cloneRecord(item)) : [];
    const nextId = Number.isFinite(config.nextId ?? Number.NaN) ? Number(config.nextId) : computeNextId(baseItems as Array<Record<string, unknown>>);
    if (isScheduleList(config)) resetScheduleStore(baseItems as Array<Record<string, unknown>>);
    const state: ListState = { config, items: baseItems as Array<Record<string, unknown>>, nextId };
    nameMap.set(normalizeName(config.name), state);
    for (const alias of config.aliases ?? []) nameMap.set(normalizeName(alias), state);
  }

  const resolveList = (name: string): ListState | undefined => nameMap.get(normalizeName(name));

  const resolveFallback = async (request: Request): Promise<HttpResponseInit> => {
    if (options.fallback) {
      if (typeof options.fallback === 'function') {
        const result = await options.fallback(request);
        if (result) return result;
      } else return options.fallback;
    }
    return { status: 404, body: { error: 'Not mocked' } };
  };

  await page.route('**/_api/contextinfo', async (route) => {
    if (route.request().method() === 'POST') {
      await fulfill(route, { status: 200, body: { d: { GetContextWebInformation: { FormDigestValue: 'stub-digest', FormDigestTimeoutSeconds: 1800 } } } });
    } else await route.continue();
  });

  await page.route('**/_api/web/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method().toUpperCase();
    const headers = request.headers();
    const methodOverride = (headers['x-http-method'] ?? headers['x-http-method-override'] ?? '').toUpperCase();
    const effectiveMethod = (method === 'POST' && ['MERGE', 'PATCH', 'DELETE'].includes(methodOverride)) ? methodOverride : method;

    if (pathname.toLowerCase().endsWith('/_api/web/currentuser')) {
      await fulfill(route, options.currentUser ?? DEFAULT_CURRENT_USER);
      return;
    }

    if (pathname.toLowerCase().endsWith('/_api/web/lists')) {
      if (method === 'POST') {
        const payload = parseRequestBody(request) as Record<string, unknown>;
        const title = String(payload.Title || 'New List');
        if (!resolveList(title)) nameMap.set(normalizeName(title), { config: { name: title }, items: [], nextId: 1 });
        await fulfill(route, { status: 201, body: { Title: title, Id: title, EntityTypeName: title } });
        return;
      }
      if (method === 'GET') {
        const results = Array.from(nameMap.values()).map(s => ({ Title: s.config.name, Id: s.config.name, EntityTypeName: s.config.name }));
        await fulfill(route, { status: 200, body: { value: results } });
        return;
      }
    }

    const match = matchListPath(pathname);
    if (match) {
      let state = resolveList(match.key);
      const isMetadataQuery = url.searchParams.get('$filter')?.includes('EntityTypeName') || match.remainder.toLowerCase().includes('/fields') || match.remainder === '' || match.remainder.startsWith('?');
      const isDataQuery = /\/items(\/|\?|$)/i.test(match.remainder);

      if (!state && (isMetadataQuery || isDataQuery)) {
         state = { config: { name: match.key }, items: [], nextId: 1 };
         nameMap.set(normalizeName(match.key), state);
      }

      if (!state) {
        await fulfill(route, await resolveFallback(request));
        return;
      }

      const isSchedule = isScheduleList(state.config);
      const getItems = (): Array<Record<string, unknown>> => (isSchedule ? scheduleStore : state.items);
      const setItems = (items: Array<Record<string, unknown>>) => { if (isSchedule) scheduleStore = items; else state.items = items; };
      const remainder = match.remainder ?? '';

      if (isMetadataQuery) {
        if (remainder === '' || remainder === '/') {
          await fulfill(route, { status: 200, body: { Title: state.config.name, Id: state.config.name, BaseType: 0, EntityTypeName: state.config.name } });
        } else {
          const fields = state.config.fields ?? [];
          const results = fields.map((f) => ({ InternalName: f.InternalName, Title: f.Title || f.InternalName, TypeAsString: f.TypeAsString || 'Text' }));
          await fulfill(route, { status: 200, body: { value: results } });
        }
        return;
      }

      if (/\/items\((\d+)\)$/i.test(remainder)) {
        const idMatch = remainder.match(/\((\d+)\)/);
        const id = idMatch ? Number(idMatch[1]) : Number.NaN;
        const items = getItems();
        const index = items.findIndex((item) => Number(item['Id']) === id);
        if (index === -1) { await fulfill(route, { status: 404, body: {} }); return; }
        if (effectiveMethod === 'GET') {
          const responseItem = isSchedule ? normalizeScheduleRecord(cloneRecord(items[index] as Record<string, unknown>)) : items[index];
          await fulfill(route, { status: 200, body: responseItem });
          return;
        }
        if (effectiveMethod === 'PATCH' || effectiveMethod === 'MERGE') {
          const payload = cloneRecord(normalizeBody(parseRequestBody(request)));
          if (isSchedule) normalizeScheduleRecord(payload);
          const nextValue = state.config.onUpdate ? state.config.onUpdate(id, payload, { request, previous: items[index], listName: state.config.name }) : { ...items[index], ...payload };
          const nextRecord = isSchedule ? normalizeScheduleRecord(cloneRecord(nextValue as Record<string, unknown>)) : cloneRecord(nextValue as Record<string, unknown>);
          const nextItems = getItems().slice(); nextItems[index] = nextRecord; setItems(nextItems);
          await fulfill(route, { status: 200, body: cloneRecord(nextRecord) });
          return;
        }
        if (effectiveMethod === 'DELETE') {
          const nextItems = getItems().slice(); nextItems.splice(index, 1); setItems(nextItems);
          await fulfill(route, { status: 204, body: '' }); return;
        }
      }

      if (isDataQuery) {
        if (method === 'GET') {
          const itemsSource = isSchedule ? scheduleStore : state.items;
          const results = itemsSource.map((item) => isSchedule ? normalizeScheduleRecord(cloneRecord(item as Record<string, unknown>)) : item);
          await fulfill(route, { status: 200, body: { value: results } });
          return;
        }
        if (method === 'POST') {
          const takeNextId = () => { const current = state.nextId; state.nextId += 1; return current; };
          const payload = parseRequestBody(request);
          const created = state.config.onCreate ? state.config.onCreate(payload, { takeNextId, listName: state.config.name, request, items: getItems() }) : { Id: takeNextId(), ...(normalizeBody(payload)) };
          const nextRecord = isSchedule ? normalizeScheduleRecord(cloneRecord(normalizeBody(created))) : cloneRecord(normalizeBody(created));
          if (typeof nextRecord['Id'] !== 'number') nextRecord['Id'] = takeNextId();
          const nextItems = getItems().slice();
          if (state.config.insertPosition === 'start') nextItems.unshift(cloneRecord(nextRecord));
          else nextItems.push(cloneRecord(nextRecord));
          setItems(nextItems);
          await fulfill(route, { status: 201, body: nextRecord });
          return;
        }
      }

      if (/\/fields\/?$/i.test(remainder)) {
        if (method === 'GET') {
          // 現場の動的スキーマ解決（resolveFields）を成功させるためのメタデータ応答
          const items = getItems();
          const keys = new Set<string>(['Id', 'Title', 'Modified', 'Created']);
          
          // スタブに存在するキーを全て内部名候補として返却
          if (items.length > 0) {
            for (const item of items) {
              Object.keys(item).forEach((k) => keys.add(k));
            }
          }

          const listKey = match.key.toLowerCase();
          const isSchedule = listKey.includes('schedule');
          const isUser = listKey.includes('user');
          const isStaff = listKey.includes('staff');

          // 送迎予定リポジトリが期待する主要フィールドを明示的に補完 (SCHEDULE_EVENTS_CANDIDATES の第一候補に合わせる)
          // 各リポジトリの CANDIDATES の第一候補（Canonical名）に合わせることで、診断バナーの警告を消去する
          if (isSchedule) {
            ['Title', 'EventDate', 'EndDate', 'Status', 'ServiceType', 'TargetUserId', 'cr014_personName', 'AssignedStaffId', 'LocationName', 'Note', 'RowKey', 'cr014_dayKey', 'MonthKey', 'cr014_fiscalYear', 'VehicleId', 'Visibility', 'StatusReason', 'AcceptedOn', 'AcceptedBy', 'AcceptedNote'].forEach(k => keys.add(k));
          }
          if (isUser) {
            ['UserID', 'FullName', 'Furigana', 'FullNameKana', 'ContractDate', 'ServiceStartDate', 'ServiceEndDate', 'IsHighIntensitySupportTarget', 'IsSupportProcedureTarget', 'IsActive', 'UsageStatus', 'AttendanceDays', 'TransportToDays', 'TransportFromDays', 'TransportCourse', 'TransportSchedule', 'TransportAdditionType', 'RecipientCertNumber', 'RecipientCertExpiry', 'GrantMunicipality', 'GrantPeriodStart', 'GrantPeriodEnd', 'DisabilitySupportLevel', 'GrantedDaysPerMonth', 'UserCopayLimit', 'MealAddition', 'CopayPaymentMethod'].forEach(k => keys.add(k));
          }
          if (isStaff) {
            ['StaffID', 'FullName', 'Furigana', 'FullNameKana', 'JobTitle', 'Role', 'RBACRole', 'IsActive', 'Department', 'HireDate', 'ResignDate', 'Email', 'Phone', 'WorkDays', 'BaseWorkingDays', 'BaseShiftStartTime', 'BaseShiftEndTime', 'Certifications'].forEach(k => keys.add(k));
          }
          if (listKey.toLowerCase().includes('isp')) {
            ['Title', 'UserCode', 'PlanStartDate', 'PlanEndDate', 'Status', 'VersionNo', 'IsCurrent', 'FormDataJson', 'UserSnapshotJson'].forEach(k => keys.add(k));
          }
          if (listKey.toLowerCase().includes('planning')) {
            ['Title', 'UserCode', 'ISPId', 'TargetScene', 'Status', 'VersionNo', 'IsCurrent', 'FormDataJson', 'IntakeJson', 'AssessmentJson', 'PlanningJson'].forEach(k => keys.add(k));
          }

          const value = Array.from(keys).map((k) => ({
            InternalName: k,
            TypeAsString: 'Text',
            Required: false,
          }));

          await fulfill(route, { status: 200, body: { value } });
          return;
        }
      }

      if (!remainder || remainder === '/') {
        await fulfill(route, {
          status: 200,
          body: {
            Title: state.config.name,
            Id: state.config.name,
          },
        });
        return;
      }

      await fulfill(route, await resolveFallback(request));
      return;
    }
    await fulfill(route, await resolveFallback(request));
  });
}
