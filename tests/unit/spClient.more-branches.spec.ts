import type { AppConfig } from '@/lib/env';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeTestConfig, setTestConfigOverride } from '../helpers/mockEnv';
import { installTestResets } from '../helpers/reset';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: (): AppConfig => mergeTestConfig(),
    skipSharePoint: () => false,
    shouldSkipLogin: () => false,
  };
});

vi.mock('@/env', () => {
  const mockEnv = {};
  return {
    getRuntimeEnv: vi.fn(() => mockEnv),
    env: mockEnv,
    getIsDemo: vi.fn(() => false),
    getIsE2E: vi.fn(() => false),
    getIsMsalMock: vi.fn(() => false),
    isE2eMsalMockEnabled: () => false,
    get: vi.fn((name: string, fallback = '') => fallback),
    getFlag: vi.fn((name: string) => name === 'VITE_AUDIT_DEBUG'),
  };
});

vi.mock('@/lib/debugLogger', () => ({
  auditLog: {
    debug: (ns: string, ...a: unknown[]) => {
      if (typeof window !== 'undefined' ? window.localStorage.getItem('debug') : true) {
        console.debug(`[audit:${ns}]`, ...a);
      }
    },
    info: (ns: string, ...a: unknown[]) => console.info(`[audit:${ns}]`, ...a),
    warn: (ns: string, ...a: unknown[]) => console.warn(`[audit:${ns}]`, ...a),
    error: (ns: string, ...a: unknown[]) => console.error(`[audit:${ns}]`, ...a),
    enabled: true,
  },
}));

import { getRuntimeEnv } from '@/env';
import { SharePointItemNotFoundError, SharePointMissingEtagError } from '@/lib/errors';
import {
    __ensureListInternals,
    __test__,
    createSpClient,
    getStaffMaster,
    getUsersMaster,
    type SharePointBatchOperation,
} from '@/lib/spClient';

const mockGetRuntimeEnv = vi.mocked(getRuntimeEnv);

const defaultConfig: AppConfig = {
  VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
  VITE_SP_SITE_URL: 'https://contoso.sharepoint.com/sites/demo',
  VITE_SP_SITE_RELATIVE: '/sites/demo',
  VITE_SP_RETRY_MAX: 3,
  VITE_SP_RETRY_BASE_MS: 10,
  VITE_SP_RETRY_MAX_DELAY_MS: 50,
  VITE_MSAL_CLIENT_ID: '',
  VITE_MSAL_TENANT_ID: '',
  VITE_MSAL_TOKEN_REFRESH_MIN: 300,
  VITE_AUDIT_DEBUG: false,
  VITE_AUDIT_BATCH_SIZE: 20,
  VITE_AUDIT_RETRY_MAX: 3,
  VITE_AUDIT_RETRY_BASE: 500,
  VITE_E2E: false,
  VITE_MSAL_SCOPES: '',
  VITE_MSAL_LOGIN_SCOPES: '',
  VITE_LOGIN_SCOPES: '',
  VITE_SP_SCOPE_DEFAULT: '',
  VITE_AAD_CLIENT_ID: '',
  VITE_AAD_TENANT_ID: '',
  VITE_MSAL_LOGIN_FLOW: 'popup',
  isDev: false,
} as any;

const originalNodeEnv = process.env.NODE_ENV;
const originalPlaywrightFlag = process.env.PLAYWRIGHT_TEST;
const originalFetch = globalThis.fetch;
const originalWindow = (globalThis as Record<string, unknown>).window;

describe('buildFieldSchema branches', () => {
  installTestResets();

  beforeEach(() => {
    vi.unstubAllEnvs();
    mockGetRuntimeEnv.mockReturnValue({});
    __test__.resetMissingOptionalFieldsCache();
    delete process.env.PLAYWRIGHT_TEST;
  });

  beforeEach(() => {
    // Cleanup for fetch and window
    return () => {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalPlaywrightFlag === undefined) {
        delete process.env.PLAYWRIGHT_TEST;
      } else {
        process.env.PLAYWRIGHT_TEST = originalPlaywrightFlag;
      }
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      } else {
        delete (globalThis as unknown as { fetch?: typeof fetch }).fetch;
      }
      if (originalWindow === undefined) {
        delete (globalThis as Record<string, unknown>).window;
      } else {
        (globalThis as Record<string, unknown>).window = originalWindow;
      }
      __test__.resetMissingOptionalFieldsCache();
    };
  });

  const { buildFieldSchema } = __ensureListInternals;

  it('renders lookup field metadata with trimmed guid braces', () => {
    const schema = buildFieldSchema({
      internalName: 'LookupField',
      type: 'Lookup',
      displayName: '',
      required: true,
      lookupListId: ' {12345678-1234-1234-1234-1234567890ab} ',
      lookupFieldName: 'Title',
      allowMultiple: true,
    });

    expect(schema).toContain('Name="LookupField"');
    expect(schema).toContain('List="{12345678-1234-1234-1234-1234567890ab}"');
    expect(schema).toContain('Mult="TRUE"');
    expect(schema).not.toContain('DisplayName=""');
  });

  it('includes rich text, description, and default values for note fields', () => {
    const schema = buildFieldSchema({
      internalName: 'Comments',
      type: 'Note',
      richText: true,
      description: 'Long text',
      default: 'Hello',
    });

    expect(schema).toContain('RichText="TRUE"');
    expect(schema).toContain('<Description>Long text</Description>');
    expect(schema).toContain('<Default>Hello</Default>');
  });

  it('handles boolean fields and datetime formats', () => {
    const schedule = buildFieldSchema({
      internalName: 'ScheduledOn',
      type: 'DateTime',
      dateTimeFormat: 'DateTime',
      allowMultiple: true,
    });
    const flag = buildFieldSchema({
      internalName: 'IsActive',
      type: 'Boolean',
      default: true,
    });

    expect(schedule).toContain('Format="DateTime"');
    expect(schedule).toContain('Mult="TRUE"');
    expect(flag).toContain('Default="1"');
  });

  it('omits lookup list metadata when the identifier is blank', () => {
    const schema = buildFieldSchema({
      internalName: 'LookupField',
      type: 'Lookup',
      lookupListId: '   ',
    });

    expect(schema).toContain('ShowField="Title"');
    expect(schema).not.toContain('List=');
  });

  it('renders boolean defaults of false as 0', () => {
    const schema = buildFieldSchema({
      internalName: 'FeatureToggle',
      type: 'Boolean',
      default: false,
    });

    expect(schema).toContain('Default="0"');
  });
});

describe('resolveStaffListIdentifier scenarios', () => {
  installTestResets();

  it('prefers explicit guid override even with braces', () => {
    const result = __test__.resolveStaffListIdentifier('Staff', '{ABCDEF00-ABCD-ABCD-ABCD-ABCDEF123456}');
    expect(result).toEqual({ type: 'guid', value: 'ABCDEF00-ABCD-ABCD-ABCD-ABCDEF123456' });
  });

  it('accepts guid: prefix in title override', () => {
    const result = __test__.resolveStaffListIdentifier('guid:{ABCDEF00-ABCD-ABCD-ABCD-ABCDEF123456}', '');
    expect(result).toEqual({ type: 'guid', value: 'ABCDEF00-ABCD-ABCD-ABCD-ABCDEF123456' });
  });

  it('falls back to default staff list title when overrides are empty', () => {
    const result = __test__.resolveStaffListIdentifier('   ', '');
    expect(result).toEqual({ type: 'title', value: 'Staff_Master' });
  });
});

describe('fetchListItemsWithFallback callers', () => {
  it('treats bare objects without json() as empty payloads', async () => {
    const client = { spFetch: vi.fn().mockResolvedValue({ value: [{ id: 1 }] }) } as unknown as Parameters<typeof getUsersMaster>[0];
    mockGetRuntimeEnv.mockReturnValue({});

    const rows = await getUsersMaster(client, 50);

    expect(rows).toEqual([]);
    expect(client.spFetch).toHaveBeenCalledWith(expect.stringContaining('$top=50'));
  });

  it('rethrows once optional field fallbacks are exhausted', async () => {
    const error = new Error('network fail');
    const client = { spFetch: vi.fn().mockRejectedValue(error) } as unknown as Parameters<typeof getUsersMaster>[0];
    mockGetRuntimeEnv.mockReturnValue({});

    await expect(getUsersMaster(client)).rejects.toBe(error);
    expect(client.spFetch).toHaveBeenCalled();
  });
});

describe('spFetch retry matrix', () => {
  const makeResponse = (body: unknown, init: ResponseInit) => (
    body instanceof Response ? body : new Response(typeof body === 'string' ? body : JSON.stringify(body), init)
  );

  it('retries transient failures, logs in debug mode, and refreshes token on 401', async () => {
    process.env.NODE_ENV = 'development';
    setTestConfigOverride({
      VITE_SP_RETRY_MAX: 2,
      VITE_SP_RETRY_BASE_MS: 0,
      VITE_SP_RETRY_MAX_DELAY_MS: 0,
      VITE_AUDIT_DEBUG: true,
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse('', { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce(makeResponse('', { status: 401, statusText: 'Unauthorized' }))
      .mockResolvedValueOnce(makeResponse({ value: [] }, { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const acquireToken = vi.fn()
      .mockResolvedValueOnce('token-1')
      .mockResolvedValueOnce('token-2');
    const onRetry = vi.fn(() => {
      throw new Error('listener failed');
    });

    const client = createSpClient(acquireToken, `${defaultConfig.VITE_SP_RESOURCE}${defaultConfig.VITE_SP_SITE_RELATIVE}/_api/web`, { onRetry });
    await client.spFetch("lists/getbytitle('Sample')/items");

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(consoleWarn).toHaveBeenCalled();
  });

  it('retries 408 timeout responses', async () => {
    setTestConfigOverride({
      VITE_SP_RETRY_MAX: 2,
      VITE_SP_RETRY_BASE_MS: 0,
      VITE_SP_RETRY_MAX_DELAY_MS: 0,
      VITE_AUDIT_DEBUG: true,
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse('', { status: 408, statusText: 'Timeout' }))
      .mockResolvedValueOnce(makeResponse({ value: [] }, { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token-1');

    const client = createSpClient(acquireToken, `${defaultConfig.VITE_SP_RESOURCE}${defaultConfig.VITE_SP_SITE_RELATIVE}/_api/web`);
    await client.spFetch('/lists/test');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses Retry-After header with RFC1123 timestamp for 429 throttles', async () => {
    setTestConfigOverride({
      VITE_SP_RETRY_MAX: 2,
      VITE_SP_RETRY_BASE_MS: 1,
      VITE_SP_RETRY_MAX_DELAY_MS: 1,
      VITE_AUDIT_DEBUG: true,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const retryDate = new Date(Date.now() + 1000).toUTCString();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse('', { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': retryDate } }))
      .mockResolvedValueOnce(makeResponse({ value: [] }, { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token-1');
    const sleep = vi.spyOn(globalThis, 'setTimeout');

    try {
      const client = createSpClient(acquireToken, `${defaultConfig.VITE_SP_RESOURCE}${defaultConfig.VITE_SP_SITE_RELATIVE}/_api/web`);
      const pending = client.spFetch('/lists/test');
      await vi.runAllTimersAsync();
      await pending;

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalled();
    } finally {
      sleep.mockRestore();
      vi.useRealTimers();
    }
  });

  it('surfaces raiseHttpError with payload message when retries are exhausted', async () => {
    setTestConfigOverride({ VITE_SP_RETRY_MAX: 2, VITE_AUDIT_DEBUG: true });
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ error: { message: { value: 'Detailed failure' } } }, { status: 500, statusText: 'Server Error', headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token-1');

    const client = createSpClient(acquireToken, `${defaultConfig.VITE_SP_RESOURCE}${defaultConfig.VITE_SP_SITE_RELATIVE}/_api/web`);

    await expect(client.spFetch('/fail')).rejects.toThrow(/Detailed failure/);
  });
});

describe('coerceResult pathways via createItem', () => {
  const baseUrl = `${defaultConfig.VITE_SP_RESOURCE}${defaultConfig.VITE_SP_SITE_RELATIVE}/_api/web`;

  it('returns undefined for 204 responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const result = await client.createItem('List', {});
    expect(result).toBeUndefined();
  });

  it('returns undefined for zero content-length payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200, headers: { 'Content-Length': '0' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const result = await client.createItem('List', {});
    expect(result).toBeUndefined();
  });

  it('skips non-json content types', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const result = await client.createItem('List', {});
    expect(result).toBeUndefined();
  });

  it('handles invalid json bodies gracefully', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{oops', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const result = await client.createItem('List', {});
    expect(result).toBeUndefined();
  });

  it('returns undefined when the response lacks a content-type header', async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    response.headers.delete('Content-Type');
    const fetchMock = vi.fn().mockResolvedValue(response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const result = await client.createItem('List', {});
    expect(result).toBeUndefined();
  });
});

describe('patchListItem etag refresh branches', () => {
  const baseUrl = `${defaultConfig.VITE_SP_RESOURCE}${defaultConfig.VITE_SP_SITE_RELATIVE}/_api/web`;

  const makeJsonResponse = (body: unknown, init: ResponseInit) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });

  it('refreshes etag after 412 and succeeds on retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('precondition failed', { status: 412, statusText: 'Precondition Failed' }))
      .mockResolvedValueOnce(makeJsonResponse({ Id: 1 }, { status: 200, headers: { ETag: '"123"' } }))
      .mockResolvedValueOnce(new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const res = await client.updateItem('List', 1, { Name: 'A' });
    expect(res).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws SharePointItemNotFoundError when fallback fetch hits 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('precondition failed', { status: 412, statusText: 'Precondition Failed' }))
      .mockResolvedValueOnce(new Response('not found', { status: 404, statusText: 'Not Found' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    await expect(client.updateItem('List', 1, { Name: 'A' })).rejects.toBeInstanceOf(SharePointItemNotFoundError);
  });

  it('throws SharePointMissingEtagError when refreshed etag is absent', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('precondition failed', { status: 412, statusText: 'Precondition Failed' }))
      .mockResolvedValueOnce(makeJsonResponse({ Id: 1 }, { status: 200 }))
      .mockResolvedValueOnce(new Response('precondition failed', { status: 412, statusText: 'Precondition Failed' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    await expect(client.updateItem('List', 1, { Name: 'A' })).rejects.toBeInstanceOf(SharePointMissingEtagError);
  });

  it('throws SharePointMissingEtagError when 412 persists after refreshing etag', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('precondition failed', { status: 412, statusText: 'Precondition Failed' }))
      .mockResolvedValueOnce(makeJsonResponse({ Id: 1 }, { status: 200, headers: { ETag: '"abc"' } }))
      .mockResolvedValueOnce(new Response('precondition failed', { status: 412, statusText: 'Precondition Failed' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    await expect(client.updateItem('List', 1, { Name: 'A' })).rejects.toThrow('SharePoint returned 412 after refreshing ETag');
  });
});

describe('ensureListExists and metadata helpers', () => {
  const baseUrl = `${defaultConfig.VITE_SP_RESOURCE}${defaultConfig.VITE_SP_SITE_RELATIVE}/_api/web`;

  it('creates list when missing and adds new fields', async () => {
    const fetchMock = vi
      .fn()
  .mockResolvedValueOnce(new Response('Not Found', { status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ Id: '{111}', Title: 'Users' }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const result = await client.ensureListExists('Users', [
      { internalName: 'Display', type: 'Text', description: 'info' },
    ]);

    expect(result.title).toBe('Users');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('warns when existing field required flag differs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ Id: '{111}', Title: 'Users' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ InternalName: 'Display', Required: false }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    await client.ensureListExists('Users', [
      { internalName: 'Display', type: 'Text', required: true },
    ]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Field "Display" required flag differs'));
    warn.mockRestore();
  });

  it('parses SharePoint metadata wrapped inside the d envelope', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ d: { Id: '{ABC}', Title: 'Wrapped' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const result = await client.ensureListExists('Wrapped', []);

    expect(result).toEqual({ listId: 'ABC', title: 'Wrapped' });
  });
});

describe('postBatch retry logic and parser', () => {
  const baseUrl = `${defaultConfig.VITE_SP_RESOURCE}${defaultConfig.VITE_SP_SITE_RELATIVE}/_api/web`;

  it('retries batch requests on 429 and respects Retry-After seconds', async () => {
    setTestConfigOverride({
      VITE_SP_RETRY_MAX: 2,
      VITE_SP_RETRY_BASE_MS: 1,
      VITE_SP_RETRY_MAX_DELAY_MS: 1,
    });
    const originalFetch = globalThis.fetch;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0.001' } }))
      .mockResolvedValueOnce(new Response('', { status: 200, headers: { 'Content-Type': 'multipart/mixed; boundary=batch_response' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const previousWindow = (globalThis as Record<string, unknown>).window;
    const timersSpy = vi.spyOn(globalThis, 'setTimeout');
    vi.useFakeTimers();

    try {
      (globalThis as Record<string, unknown>).window = {};
      const client = createSpClient(acquireToken, baseUrl);

      const operations: SharePointBatchOperation[] = [
        { kind: 'create', list: 'Users', body: { Title: 'A' } },
      ];

      const pending = client.batch(operations);
      await vi.runAllTimersAsync();
      await pending;
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
      timersSpy.mockRestore();
      vi.useRealTimers();
      if (previousWindow === undefined) {
        delete (globalThis as Record<string, unknown>).window;
      } else {
        (globalThis as Record<string, unknown>).window = previousWindow;
      }
    }
  });

  it('parses batch responses into structured results', async () => {
    const payload = [
      '--batch_response',
      'Content-Type: application/http',
      '',
      'HTTP/1.1 200 OK',
      'Content-Type: application/json',
      '',
      '{"ok":true}',
      '--batch_response',
      'Content-Type: application/http',
      '',
      'HTTP/1.1 404 Not Found',
      '',
      'missing',
      '--batch_response--',
      '',
    ].join('\r\n');

    const fetchMock = vi.fn().mockResolvedValue(new Response(payload, { status: 200, headers: { 'Content-Type': 'multipart/mixed; boundary=batch_response' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const results = await client.batch([
      { kind: 'create', list: 'Users', body: {} },
    ]);

    expect(results).toEqual([
      { ok: true, status: 200, data: { ok: true } },
      { ok: false, status: 404, data: 'missing' },
    ]);
  });

  it('returns an empty array when batch is invoked without operations', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const results = await client.batch([]);

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the batch token acquisition returns an empty value', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('');
    const client = createSpClient(acquireToken, baseUrl);

    await expect(client.postBatch('--noop--', 'boundary')).rejects.toThrow('AUTH_REQUIRED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the request boundary when the response omits one', async () => {
    const boundarySuffix = '4fzzzxjylrx';
    const boundary = `batch_${boundarySuffix}`;
    const responsePayload = [
      `--${boundary}`,
      'Content-Type: application/http',
      '',
      'HTTP/1.1 200 OK',
      'Content-Type: application/json',
      '',
      '{"ok":true}',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    const fetchMock = vi.fn().mockResolvedValue(new Response(responsePayload, { status: 200, headers: { 'Content-Type': 'multipart/mixed' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    try {
      const results = await client.batch([
        { kind: 'create', list: 'Users', body: {} },
      ]);

      expect(results).toEqual([
        { ok: true, status: 200, data: { ok: true } },
      ]);
    } finally {
      mathSpy.mockRestore();
    }
  });
});

describe('listItems variations', () => {
  const baseUrl = `${defaultConfig.VITE_SP_RESOURCE}${defaultConfig.VITE_SP_SITE_RELATIVE}/_api/web`;

  it('appends select/filter/orderby/expand parameters and forwards the abort signal', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);
    const controller = new AbortController();

    await client.listItems("/lists/getbytitle('Announcements')", {
      select: ['Id'],
      filter: "Title eq 'A'",
      orderby: 'Id desc',
      expand: 'Fields',
      top: 5,
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('$select')).toBe('Id');
    expect(parsed.searchParams.get('$filter')).toBe("Title eq 'A'");
    expect(parsed.searchParams.get('$orderby')).toBe('Id desc');
    expect(parsed.searchParams.get('$expand')).toBe('Fields');
    expect(parsed.searchParams.get('$top')).toBe('5');
    expect(init.signal).toBe(controller.signal);
  });

  it('normalizes absolute next links back to relative paths', async () => {
    const firstPage = {
      value: [{ Id: 1 }],
      '@odata.nextLink': `${baseUrl}/lists/getbytitle('Announcements')/items?$skiptoken=Paged=TRUE`,
    };
    const secondPage = { value: [{ Id: 2 }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(secondPage), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    const rows = await client.listItems("lists/getbytitle('Announcements')", { top: 1 });

    expect(rows).toEqual([{ Id: 1 }, { Id: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, secondCallInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(secondCallInit.signal).toBeUndefined();
  });
});

describe('users master helpers', () => {
  it('sanitizes env override and falls back to default list name', async () => {
    mockGetRuntimeEnv.mockReturnValue({ VITE_SP_LIST_USERS: '   ' });
    const client = { spFetch: vi.fn().mockResolvedValue({ value: [] }) } as unknown as Parameters<typeof getUsersMaster>[0];

    const rows = await getUsersMaster(client, NaN);
    expect(rows).toEqual([]);
  });

  it('resolves staff list identifier before fetch', async () => {
    mockGetRuntimeEnv.mockReturnValue({
      VITE_SP_LIST_STAFF: 'guid:{ABCDEF00-ABCD-ABCD-ABCD-ABCDEF123456}',
      VITE_SP_LIST_STAFF_GUID: '',
    });
    const client = { spFetch: vi.fn().mockResolvedValue({ value: [] }) } as unknown as Parameters<typeof getStaffMaster>[0];

    const rows = await getStaffMaster(client);
    expect(rows).toEqual([]);
  });
});
