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
};

export function makeListApi(client: SpClient) {
  // NOTE: your app already knows tenant/site; most projects use a proxy endpoint or direct _api.
  // Here we assume direct SharePoint REST path is built by env in spec (as you do today).
  // You'll pass `siteUrl` (absolute) into spec, not Vite dev base.
  return {
    async get(url: string, op: string) {
      const res = await client.request.get(url);
      // Debug: log headers
      if (process.env.DEBUG_INTEGRATION) {
        console.log(`[${op}] GET headers:`, res.headers());
      }
      await ensureOk(res, { op, url });
      return res;
    },
    async post(url: string, data: unknown, op: string, headers?: Record<string, string>) {
      const res = await client.request.post(url, {
        data,
        headers: { 'Content-Type': 'application/json;odata=verbose', ...(headers ?? {}) },
      });
      await ensureOk(res, { op, url });
      return res;
    },
    async merge(url: string, data: unknown, op: string) {
      const res = await client.request.post(url, {
        data,
        headers: {
          'Content-Type': 'application/json;odata=verbose',
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
