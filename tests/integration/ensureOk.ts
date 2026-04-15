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

  let hint = '';
  if (status === 401) {
    hint = '\n[Hint] Authentication Expired. Please regenerate PW_STORAGE_STATE_B64 locally.';
  } else if (status === 403) {
    hint = '\n[Hint] Access Denied. Check SharePoint site/list permissions OR verify if PW_STORAGE_STATE_B64 has expired.';
  } else if (status >= 500) {
    hint = '\n[Hint] SharePoint Server Error. Check for list view thresholds or service health.';
  }

  throw new Error(`[${label}] HTTP ${status}${hint} sprequestguid=${guid}\n${bodySnippet}`);
}
