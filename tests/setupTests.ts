// Lightweight SharePoint fetch mock for unit tests.
// Provides deterministic responses for common _api endpoints used by spClient tests.
// Unknown endpoints fall back to { value: [] } to keep tests stable and offline.
import { beforeEach, afterAll, vi } from 'vitest';

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const jsonResponse = (body: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(headers ?? {}) },
  });

const handlers: Array<{
  match: RegExp;
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>;
}> = [
  {
    // Fetch existing list metadata
    match: /\/(_api|_vti_bin)\/web\/lists\/getbytitle\('Existing%20List'\)/i,
    handler: () => jsonResponse({ Id: 101, Title: 'Existing List' }),
  },
  {
    // Generic getbytitle fallback
    match: /\/(_api|_vti_bin)\/web\/lists\/getbytitle\('/i,
    handler: () => jsonResponse({ Id: 202, Title: 'MockedList' }),
  },
  {
    // Fields enumeration
    match: /\/(_api|_vti_bin)\/web\/lists\/getbytitle\('[^']+'\)\/fields/i,
    handler: () =>
      jsonResponse([
        { InternalName: 'Title', TypeAsString: 'Text', Required: false },
        { InternalName: 'StartUtc', TypeAsString: 'DateTime', Required: true },
      ]),
  },
  {
    // Create list
    match: /\/(_api|_vti_bin)\/web\/lists(?:\?|$)/i,
    handler: () => jsonResponse({ Id: 303, Title: 'CreatedList' }),
  },
  {
    // Default for other _api calls
    match: /\/(_api|_vti_bin)\//i,
    handler: () => jsonResponse({ value: [] }),
  },
];

type SpMockFetch = typeof fetch & {
  __isSpMock?: boolean;
  mockClear?: () => void;
};

const isSpMockFetch = (fn: typeof fetch | SpMockFetch): fn is SpMockFetch =>
  typeof fn === 'function' && Boolean((fn as SpMockFetch).__isSpMock);

const originalFetch = globalThis.fetch;

export function installSharePointFetchMock(): void {
  if (isSpMockFetch(globalThis.fetch)) return;

  const impl: FetchImpl = async (input, init) => {
    const url = String(input);
    for (const h of handlers) {
      if (h.match.test(url)) {
        try {
          return await Promise.resolve(h.handler(url, init));
        } catch (err) {
          return new Response(String(err ?? 'error'), { status: 500 });
        }
      }
    }
    return jsonResponse({ value: [] }, 200);
  };

  const mock = vi.fn(impl) as unknown as SpMockFetch;
  mock.__isSpMock = true;
  globalThis.fetch = mock;
}

export function uninstallSharePointFetchMock(): void {
  if (isSpMockFetch(globalThis.fetch) && originalFetch) {
    globalThis.fetch = originalFetch;
  }
}

installSharePointFetchMock();

// Ensure the mock is present for each test and its call history does not leak across tests.
beforeEach(() => {
  installSharePointFetchMock();
  const current = globalThis.fetch;
  if (isSpMockFetch(current) && typeof current.mockClear === 'function') {
    current.mockClear();
  }
});

afterAll(() => {
  uninstallSharePointFetchMock();
});
