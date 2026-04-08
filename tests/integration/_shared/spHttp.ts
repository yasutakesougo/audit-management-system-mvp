import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

export type EnsureOkContext = {
  op: string;
  url: string;
};

export async function ensureOk(res: APIResponse, ctx: EnsureOkContext): Promise<void> {
  if (res.ok()) return;

  const status = res.status();
  const headers = res.headers();

  // SharePoint request guid (header name varies; try common keys)
  const sprequestguid =
    headers['sprequestguid'] ||
    headers['sp-request-guid'] ||
    headers['request-id'] ||
    headers['client-request-id'] ||
    'N/A';

  const body = await res.text().catch(() => '');
  const snippet = body.slice(0, 400);

  throw new Error(
    `[integration] ${ctx.op} failed: ${status}\n` +
      `url=${ctx.url}\n` +
      `sprequestguid=${sprequestguid}\n` +
      `body=${snippet}`,
  );
}

export type SpClient = {
  baseUrl: string; // e.g. http://127.0.0.1:5173
  request: APIRequestContext;
  listTitle: string;
  authHeaders?: Record<string, string>;
};

export async function fetchRequestDigest(request: APIRequestContext, url: string): Promise<string> {
  const siteUrl = url.split('/_api')[0];
  const contextUrl = `${siteUrl}/_api/contextinfo`;

  const res = await request.post(contextUrl, {
    headers: { 'Accept': 'application/json;odata=verbose' },
  });

  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to fetch X-RequestDigest from ${contextUrl}: ${res.status()}\n${body}`);
  }

  const json = await res.json();
  const digest = json?.d?.GetContextWebInformation?.FormDigestValue;

  if (!digest) {
    throw new Error(`Invalid contextinfo response from ${contextUrl}: digest missing`);
  }

  return digest;
}

export function makeListApi(client: SpClient) {
  const commonHeaders = {
    'Accept': 'application/json;odata=nometadata',
    'Content-Type': 'application/json;odata=nometadata',
    ...(client.authHeaders ?? {}),
  };

  return {
    async get(url: string, op: string) {
      const res = await client.request.get(url, {
        headers: commonHeaders,
      });
      // Debug: log headers
      if (process.env.DEBUG_INTEGRATION) {
        // eslint-disable-next-line no-console
        console.log(`[${op}] GET headers:`, res.headers());
      }
      await ensureOk(res, { op, url });
      return res;
    },
    async post(url: string, data: unknown, op: string, headers?: Record<string, string>) {
      const digest = await fetchRequestDigest(client.request, url);

      const res = await client.request.post(url, {
        data,
        headers: {
          ...commonHeaders,
          'X-RequestDigest': digest,
          ...(headers ?? {}),
        },
      });
      await ensureOk(res, { op, url });
      return res;
    },
    async merge(url: string, data: unknown, op: string) {
      const digest = await fetchRequestDigest(client.request, url);

      const res = await client.request.post(url, {
        data,
        headers: {
          ...commonHeaders,
          'X-RequestDigest': digest,
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE',
        },
      });
      await ensureOk(res, { op, url });
      return res;
    },
  };
}

// Utility
export function toSelectQuery(fields: string[]): string {
  return fields.map(encodeURIComponent).join(',');
}

export function assertHasFields(obj: Record<string, unknown>, fields: string[]): void {
  for (const f of fields) {
    expect(obj).toHaveProperty(f);
  }
}
