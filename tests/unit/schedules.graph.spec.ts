import { __resetAppConfigForTests, getAppConfig } from '@/lib/env';
import type { Event as GraphEvent } from '@microsoft/microsoft-graph-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let makeGraphSchedulesPort: typeof import('@/features/schedules/data').makeGraphSchedulesPort;

const from = '2025-10-10T00:00:00Z';
const to = '2025-10-11T00:00:00Z';

const createResponse = (options: {
  ok: boolean;
  status?: number;
  events?: GraphEvent[];
  text?: string;
  headers?: Record<string, string>;
  throwOnHeaderGet?: boolean;
}): Response => {
  const {
    ok,
    status = ok ? 200 : 500,
    events = [],
    text = '',
    headers = {},
    throwOnHeaderGet = false,
  } = options;

  return {
    ok,
    status,
    json: async () => ({ value: events }),
    text: async () => text,
    headers: {
      get: (name: string) => {
        if (throwOnHeaderGet) {
          throw new Error('header error');
        }
        return headers[name.toLowerCase()] ?? null;
      },
    },
  } as unknown as Response;
};

describe('Graph schedules adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetAppConfigForTests();
  });

  beforeEach(async () => {
    vi.stubEnv('VITE_MSAL_CLIENT_ID', 'e2e-mock-client-id-12345678');
    vi.stubEnv('VITE_MSAL_TENANT_ID', 'common');
    if (!makeGraphSchedulesPort) {
      ({ makeGraphSchedulesPort } = await import('@/features/schedules/data'));
    }
  });

  it('fetches and maps events to sched items', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        {
          ok: true,
          json: async () => ({
            value: [
              {
                id: 'event-1',
                subject: 'Standup',
                organizer: { emailAddress: { name: 'Alice' } },
                location: { displayName: 'Teams' },
                start: { dateTime: '2025-10-10T09:00:00', timeZone: 'Asia/Tokyo' },
                end: { dateTime: '2025-10-10T09:15:00', timeZone: 'Asia/Tokyo' },
              } satisfies GraphEvent,
            ],
          }),
          text: async () => '',
        } as unknown as Response,
      );

    const port = makeGraphSchedulesPort(async () => 'token');
    const items = await port.list({ from, to });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('me/calendarView');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'event-1', title: 'Standup' });
  });

  it('filters invalid events and synthesizes fallback identifiers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createResponse({
        ok: true,
        events: [
          {
            id: undefined,
            subject: '  ',
            start: { dateTime: '2025-10-10T10:00:00' },
            end: { dateTime: '2025-10-10T11:00:00' },
          } as GraphEvent,
          {
            id: 'skip-no-end',
            subject: 'Skip',
            start: { dateTime: '2025-10-10T12:00:00' },
          } as GraphEvent,
        ],
      }),
    );

    const port = makeGraphSchedulesPort(async () => 'token');
    const items = await port.list({ from, to });

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toMatch(/^graph-/);
    expect(items[0]?.title).toBe('(無題)');
  });

  it('throws when token acquisition fails', async () => {
    const port = makeGraphSchedulesPort(async () => null);
    await expect(port.list({ from, to })).rejects.toMatchObject({
      userMessage: expect.stringContaining('サインインをやり直してください'),
    });
  });

  it('surfaces Graph errors with user message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      {
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => 'Internal error',
      } as unknown as Response,
    );

    const port = makeGraphSchedulesPort(async () => 'token');
    await expect(port.list({ from, to })).rejects.toMatchObject({
      userMessage: expect.stringContaining('予定の取得に失敗しました'),
    });
  });

  it('wraps network failures with a safe user message', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    const port = makeGraphSchedulesPort(async () => 'token');

    await expect(port.list({ from, to })).rejects.toMatchObject({
      userMessage: expect.stringContaining('予定の取得に失敗しました'),
    });
  });

  it('honours cached responses while the TTL remains valid', async () => {
    const baseConfig = getAppConfig({});
    vi.spyOn({ getAppConfig }, 'getAppConfig').mockReturnValue({
      ...baseConfig,
      schedulesCacheTtlSec: 120,
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createResponse({
        ok: true,
        events: [
          {
            id: 'cached-1',
            subject: 'Cached',
            start: { dateTime: from },
            end: { dateTime: to },
          } as GraphEvent,
        ],
      }),
    );

    const port = makeGraphSchedulesPort(async () => 'token');

    const first = await port.list({ from, to });
    const second = await port.list({ from, to });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('returns the existing in-flight promise for duplicate range requests', async () => {
    const baseConfig = getAppConfig({});
    vi.spyOn({ getAppConfig }, 'getAppConfig').mockReturnValue({
      ...baseConfig,
      schedulesCacheTtlSec: 0,
    });

  let resolveFetch: ((value: Response | PromiseLike<Response>) => void) | null = null;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const port = makeGraphSchedulesPort(async () => 'token');

    const pendingA = port.list({ from, to });
    const pendingB = port.list({ from, to });

    // allow the async factory to register the resolver
    await Promise.resolve();
    const resolver = resolveFetch;
    expect(typeof resolver).toBe('function');
    if (!resolver) {
      throw new Error('fetch resolver not registered');
    }
    const invoke = resolver as unknown as (value: Response | PromiseLike<Response>) => void;
    invoke(
      createResponse({
        ok: true,
        events: [
          {
            id: 'event-shared',
            subject: 'Shared',
            start: { dateTime: from },
            end: { dateTime: to },
          } as GraphEvent,
        ],
      }),
    );

    const [resultA, resultB] = await Promise.all([pendingA, pendingB]);

    expect(resultA).toBe(resultB);
    expect(resultA).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries according to retry-after hints and exponential backoff', async () => {
    const baseConfig = getAppConfig({});
    vi.spyOn({ getAppConfig }, 'getAppConfig').mockReturnValue({
      ...baseConfig,
      graphRetryMax: 3,
      graphRetryBaseMs: 100,
      graphRetryCapMs: 300,
    });

    const now = Date.now();
    const headerSequence = ['1', new Date(now + 150).toUTCString()];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const next = headerSequence.shift();
      if (next !== undefined) {
        return Promise.resolve(
          createResponse({
            ok: false,
            status: 429,
            headers: { 'retry-after': next },
          }),
        );
      }
      return Promise.resolve(
        createResponse({
          ok: true,
          events: [
            {
              id: 'final',
              subject: 'Final',
              start: { dateTime: from },
              end: { dateTime: to },
            } as GraphEvent,
          ],
        }),
      );
    });

    vi.useFakeTimers();

    const port = makeGraphSchedulesPort(async () => 'token');
    const resultPromise = port.list({ from, to });

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const items = await resultPromise;

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(items).toHaveLength(1);
  });

  it('ignores retry-after headers when accessor throws and stops after max attempts', async () => {
    const baseConfig = getAppConfig({});
    vi.spyOn({ getAppConfig }, 'getAppConfig').mockReturnValue({
      ...baseConfig,
      graphRetryMax: 1,
      graphRetryBaseMs: 0,
      graphRetryCapMs: 0,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createResponse({
        ok: false,
        status: 503,
        throwOnHeaderGet: true,
        text: 'Service Unavailable',
      }),
    );

    const port = makeGraphSchedulesPort(async () => 'token');

    await expect(port.list({ from, to })).rejects.toMatchObject({
      userMessage: expect.stringContaining('予定の取得に失敗しました'),
    });
  });

  it('aborts older in-flight range requests and resolves the latest', async () => {
    const abortErrors: unknown[] = [];
    let resolvedHits = 0;
    let callIndex = 0;

    const makeAbortError = () => {
      try {
        return new DOMException('Aborted', 'AbortError');
      } catch {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return error;
      }
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation((_, init?: RequestInit) => {
      const { signal } = init ?? {};
      const currentCall = callIndex++;

      return new Promise<Response>((resolve, reject) => {
        const abortListener = () => {
          const error = makeAbortError();
          abortErrors.push(error);
          reject(error);
        };

        if (signal) {
          if (signal.aborted) {
            abortListener();
            return;
          }
          signal.addEventListener('abort', abortListener, { once: true });
        }

        if (currentCall === 0) {
          return;
        }

        resolvedHits += 1;
        resolve(
          {
            ok: true,
            json: async () => ({ value: [] }),
            text: async () => '',
          } as unknown as Response,
        );
      });
    });

    const port = makeGraphSchedulesPort(async () => 'token');

    const firstRange = port.list({ from, to });
    const secondRange = port.list({ from: '2025-10-11T00:00:00Z', to: '2025-10-12T00:00:00Z' });

    await expect(firstRange).rejects.toHaveProperty('name', 'AbortError');
    await expect(secondRange).resolves.toEqual([]);

    expect(abortErrors).toHaveLength(1);
    expect(resolvedHits).toBe(1);
  });
});
