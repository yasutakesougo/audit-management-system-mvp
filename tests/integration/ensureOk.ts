import { type APIResponse } from '@playwright/test';

export async function ensureOk(res: APIResponse, label: string): Promise<void> {
  if (res.ok()) return;

  const status = res.status();
  const headers = res.headers();
  const guid =
    headers['sprequestguid'] ??
    headers['SPRequestGuid'] ??
    headers['x-ms-request-id'] ??
    headers['request-id'] ??
    'N/A';

  let bodySnippet = '';
  try {
    bodySnippet = (await res.text()).slice(0, 400);
  } catch {
    bodySnippet = '<unreadable body>';
  }

  throw new Error(`[${label}] HTTP ${status} sprequestguid=${guid}\n${bodySnippet}`);
}
