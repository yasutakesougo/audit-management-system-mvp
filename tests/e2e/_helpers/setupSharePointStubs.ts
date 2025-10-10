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

type ListStubConfig<TItem = Record<string, unknown>> = {
  name: string;
  aliases?: readonly string[];
  items?: TItem[];
  nextId?: number;
  insertPosition?: 'start' | 'end';
  sort?: (items: TItem[]) => TItem[];
  onCreate?: (payload: unknown, ctx: CreateContext<TItem>) => TItem;
  onUpdate?: (id: number, payload: unknown, ctx: UpdateContext<TItem>) => TItem;
};

type SetupSharePointStubsOptions = {
  lists?: ListStubConfig[];
  currentUser?: HttpResponseInit;
  fallback?: HttpResponseInit | ((request: Request) => Promise<HttpResponseInit | null> | HttpResponseInit | null);
  debug?: boolean;
};

type ListState<TItem = Record<string, unknown>> = {
  config: ListStubConfig<TItem>;
  items: TItem[];
  nextId: number;
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
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      max = Math.max(max, candidate);
    }
  }
  return max + 1;
};

const toJsonBody = (body: unknown): string => {
  if (body === undefined || body === null) return '';
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
};

const fulfill = async (route: Route, init: HttpResponseInit) => {
  const status = init.status ?? 200;
  const body = toJsonBody(init.body);
  const headers = { ...JSON_HEADERS, ...init.headers };
  if (!body) {
    headers['Content-Length'] = '0';
  }
  await route.fulfill({ status, headers, body });
};

const parseRequestBody = (request: Request): unknown => {
  try {
    const raw = request.postData();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const stripOuterParens = (input: string): string => {
  let trimmed = input.trim();
  while (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner.length) break;
    trimmed = inner;
  }
  return trimmed;
};

const parseClauses = (filter: string): string[] => {
  const clauses: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < filter.length; i += 1) {
    const char = filter[i];
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && filter.slice(i, i + 4).toLowerCase() === ' and') {
      clauses.push(filter.slice(start, i));
      start = i + 4;
    }
  }
  clauses.push(filter.slice(start));
  return clauses.map(stripOuterParens).filter(Boolean);
};

const applyFilter = (items: Array<Record<string, unknown>>, filterRaw: string | null): Array<Record<string, unknown>> => {
  if (!filterRaw) return items;
  const clauses = parseClauses(filterRaw);
  if (clauses.length === 0) return items;
  let result = items;
  for (const clause of clauses) {
    const comparison = clause.match(/^([\w@.]+)\s+(eq|lt|le|gt|ge)\s+(.+)$/i);
    const substring = clause.match(/substringof\('([^']*)',\s*([\w@.]+)\)/i);
    if (comparison) {
      const [, field, opRaw, valueRaw] = comparison;
      const op = opRaw.toLowerCase();
      const fieldName = field;
      const valueText = valueRaw.trim();
      if (op === 'eq') {
        const stringMatch = valueText.match(/^'(.*)'$/s);
        if (stringMatch) {
          const expected = stringMatch[1]?.replace(/''/g, "'") ?? '';
          result = result.filter((item) => String(item[fieldName] ?? '').toLowerCase() === expected.toLowerCase());
          continue;
        }
        const numeric = Number(valueText);
        if (!Number.isNaN(numeric)) {
          result = result.filter((item) => Number(item[fieldName]) === numeric);
          continue;
        }
      }
      const dateMatch = valueText.match(/^datetime'([^']+)'$/i);
      if (dateMatch) {
        const expected = Date.parse(dateMatch[1]);
        result = result.filter((item) => {
          const raw = item[fieldName];
          const actual = typeof raw === 'string' ? Date.parse(raw) : Number.NaN;
          if (Number.isNaN(expected) || Number.isNaN(actual)) return false;
          if (op === 'lt') return actual < expected;
          if (op === 'le') return actual <= expected;
          if (op === 'gt') return actual > expected;
          if (op === 'ge') return actual >= expected;
          return false;
        });
        continue;
      }
    }
    if (substring) {
      const [, needle, field] = substring;
      const expected = needle.toLowerCase();
      result = result.filter((item) => String(item[field] ?? '').toLowerCase().includes(expected));
      continue;
    }
    // unhandled clause -> leave result as-is
  }
  return result;
};

const normalizeBody = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== 'object') return {};
  return body as Record<string, unknown>;
};

const matchListPath = (pathname: string) => {
  const decoded = decodeURIComponent(pathname);
  const byTitle = decoded.match(/\/_api\/web\/lists\/getbytitle\('([^']+)'\)(.*)$/i);
  if (byTitle) {
    return { key: byTitle[1], remainder: byTitle[2] ?? '' };
  }
  return null;
};

const prepareItemsResponse = (state: ListState, query: URLSearchParams): Record<string, unknown>[] => {
  const filtered = applyFilter(state.items as Array<Record<string, unknown>>, query.get('$filter'));
  const sorted = state.config.sort ? state.config.sort(filtered.slice()) : filtered;
  const topRaw = query.get('$top');
  const top = topRaw ? Number(topRaw) : Number.NaN;
  if (Number.isFinite(top) && top > 0) {
    return sorted.slice(0, top);
  }
  return sorted;
};

export async function setupSharePointStubs(page: Page, options: SetupSharePointStubsOptions = {}): Promise<void> {
  const nameMap = new Map<string, ListState>();
  const debug = options.debug ?? false;

  for (const config of options.lists ?? []) {
    const baseItems = Array.isArray(config.items) ? config.items : [];
    const items = baseItems;
    const nextId = Number.isFinite(config.nextId ?? Number.NaN) ? Number(config.nextId) : computeNextId(items as Array<Record<string, unknown>>);
    const state: ListState = { config, items: items as Array<Record<string, unknown>>, nextId };
    nameMap.set(normalizeName(config.name), state);
    for (const alias of config.aliases ?? []) {
      nameMap.set(normalizeName(alias), state);
    }
  }

  const resolveList = (name: string): ListState | undefined => nameMap.get(normalizeName(name));

  const resolveFallback = async (request: Request): Promise<HttpResponseInit> => {
    const candidate = options.fallback;
    if (!candidate) {
      return { status: 404, body: { error: 'Not mocked' } };
    }
    if (typeof candidate === 'function') {
      const result = await candidate(request);
      return result ?? { status: 404, body: { error: 'Not mocked' } };
    }
    return candidate;
  };

  await page.route('**/_api/web/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method().toUpperCase();

    if (/\/_api\/web\/currentuser$/i.test(pathname)) {
      await fulfill(route, options.currentUser ?? DEFAULT_CURRENT_USER);
      return;
    }

    if (/\/_api\/contextinfo$/i.test(pathname) && method === 'POST') {
      await fulfill(route, {
        status: 200,
        body: {
          FormDigestValue: 'stub-digest',
          FormDigestTimeoutSeconds: 1800,
        },
      });
      return;
    }

    const match = matchListPath(pathname);
    if (match) {
      const state = resolveList(match.key);
      if (!state) {
        await fulfill(route, await resolveFallback(request));
        return;
      }

      const remainder = match.remainder ?? '';

      if (/\/items\((\d+)\)$/i.test(remainder)) {
        const idMatch = remainder.match(/\((\d+)\)/);
        const id = idMatch ? Number(idMatch[1]) : Number.NaN;
        if (!Number.isFinite(id)) {
          await fulfill(route, { status: 400, body: { error: 'Invalid id' } });
          return;
        }
  const index = state.items.findIndex((item) => Number(item['Id']) === id);
        if (index === -1) {
          await fulfill(route, { status: 404, body: {} });
          return;
        }
        if (method === 'GET') {
          await fulfill(route, { status: 200, body: state.items[index] });
          return;
        }
        if (method === 'PATCH' || method === 'MERGE') {
          const payload = normalizeBody(parseRequestBody(request));
          const previous = state.items[index];
          const nextValue = state.config.onUpdate
            ? state.config.onUpdate(id, payload, { request, previous, listName: state.config.name })
            : { ...previous, ...payload };
          state.items[index] = nextValue;
          await fulfill(route, { status: 204, body: '' });
          return;
        }
        if (method === 'DELETE') {
          state.items.splice(index, 1);
          await fulfill(route, { status: 204, body: '' });
          return;
        }
      }

      if (/\/items\/?$/i.test(remainder)) {
        if (method === 'GET') {
          const items = prepareItemsResponse(state, url.searchParams);
            if (debug) {
              console.log(`[stub] GET ${url.href} -> ${items.length} item(s)`);
            }
            await fulfill(route, { status: 200, body: { value: items } });
          return;
        }
        if (method === 'POST') {
          const payload = parseRequestBody(request);
          const takeNextId = () => {
            const current = state.nextId;
            state.nextId += 1;
            return current;
          };
          const created = state.config.onCreate
            ? state.config.onCreate(payload, { takeNextId, listName: state.config.name, request, items: state.items })
            : { Id: takeNextId(), ...(normalizeBody(payload)) };
          if (typeof (created as Record<string, unknown>)['Id'] !== 'number') {
            (created as Record<string, unknown>)['Id'] = takeNextId();
          }
          if (state.config.insertPosition === 'start') {
            state.items.unshift(created as Record<string, unknown>);
          } else {
            state.items.push(created as Record<string, unknown>);
          }
          if (debug) {
            console.log(`[stub] POST ${url.href} -> ${JSON.stringify(created)}`);
          }
          await fulfill(route, { status: 201, body: created });
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
