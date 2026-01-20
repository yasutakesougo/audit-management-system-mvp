import { test, expect, request, type APIResponse } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type StorageState = {
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

const AUTH_STATE = resolve(process.cwd(), 'tests/.auth/storageState.json');
const SP_RESOURCE = process.env.VITE_SP_RESOURCE ?? 'https://isogokatudouhome.sharepoint.com';
const SP_SITE_RELATIVE = process.env.VITE_SP_SITE_RELATIVE ?? '/sites/app-test';
const LIST_TITLE = 'DailyOpsSignals';
const FIXED_DATE = '2000-01-01T00:00:00Z';

function requireAuthState(): StorageState {
  if (!existsSync(AUTH_STATE)) {
    throw new Error(
      `[integration] Missing storageState at ${AUTH_STATE}. Run: npm run auth:setup`
    );
  }
  return JSON.parse(readFileSync(AUTH_STATE, 'utf-8')) as StorageState;
}

/**
 * Extract SharePoint access token from MSAL storageState.
 * MSAL stores tokens in localStorage with various formats.
 */
function extractSharePointAccessToken(state: StorageState): string {
  const all = state.origins.flatMap((o) => o.localStorage);
  const originsCount = state.origins.length;
  const localStorageCount = all.length;
  const candidates = all
    .map((x) => x.value)
    .filter((v) => v.includes('accessToken') && v.includes(SP_RESOURCE));
  const candidateCount = candidates.length;

  // Try JSON-encoded tokens first
  for (const v of candidates) {
    try {
      const obj = JSON.parse(v);
      if (typeof obj?.secret === 'string' && obj.secret.length > 100) return obj.secret;
      if (typeof obj?.accessToken === 'string' && obj.accessToken.length > 100)
        return obj.accessToken;
    } catch {
      // ignore
    }
  }

  // Fallback: scan all localStorage for token-like strings
  for (const { value } of all) {
    try {
      const obj = JSON.parse(value);
      const token = obj?.secret ?? obj?.accessToken;
      if (typeof token === 'string' && token.length > 100 && !token.includes('refresh')) {
        return token;
      }
    } catch {
      // ignore
    }
  }

  throw new Error(
    [
      '[integration] Could not extract SharePoint access token from storageState.',
      `origins=${originsCount}, localStorageEntries=${localStorageCount}, candidateTokens=${candidateCount}`,
      'Run: npm run auth:setup (ensure SharePoint scope is granted and token is in storageState).',
    ].join(' ')
  );
}

async function ensureOk(res: APIResponse, label: string): Promise<void> {
  if (res.ok()) return;
  const status = res.status();
  const spid = res.headers()['sprequestguid'] ?? res.headers()['request-id'] ?? 'n/a';
  let bodySnippet = '';
  try {
    const text = await res.text();
    bodySnippet = text.slice(0, 400);
  } catch {
    bodySnippet = '<unreadable body>';
  }
  throw new Error(
    `[integration] ${label} failed: status=${status} sprequestguid=${spid} body=${bodySnippet}`
  );
}

/**
 * DailyOpsSignals Integration Tests (SharePoint REST API)
 *
 * These tests bypass UI and directly invoke SharePoint REST endpoints
 * to verify: List reachability, Schema, Idempotent Upsert, and Resolve.
 *
 * Prerequisites:
 * - Run `npm run auth:setup` once to save authentication state
 * - Ensure VITE_SKIP_SHAREPOINT=0, VITE_DEMO_MODE=0, VITE_SKIP_LOGIN=0
 *
 * Usage:
 *   npm run ci:integration:dailyops
 */
test.describe('DailyOpsSignals (SharePoint REST) integration', () => {
  test('List reachability / schema / idempotent upsert / resolve', async () => {
    const state = requireAuthState();
    const accessToken = extractSharePointAccessToken(state);

    const api = await request.newContext({
      baseURL: `${SP_RESOURCE}${SP_SITE_RELATIVE}`,
      extraHTTPHeaders: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json;odata=nometadata',
      },
    });

    // 1) List meta (entity type)
    const listMetaRes = await api.get(
      `/_api/web/lists/getbytitle('${LIST_TITLE}')?$select=ListItemEntityTypeFullName`
    );
    await ensureOk(listMetaRes, 'List meta');
    const listMeta = await listMetaRes.json();
    const entityType = listMeta?.ListItemEntityTypeFullName;
    expect(typeof entityType, 'Entity type must be string').toBe('string');

    // 2) Schema (8 internal names)
    const fieldsRes = await api.get(
      `/_api/web/lists/getbytitle('${LIST_TITLE}')/Fields?$select=InternalName`
    );
    await ensureOk(fieldsRes, 'Fields fetch');
    const fields = (await fieldsRes.json())?.value ?? [];
    const names = new Set(fields.map((f: { InternalName: string }) => f.InternalName));
    const required = ['date', 'targetType', 'targetId', 'kind', 'time', 'summary', 'status', 'source'];
    for (const r of required) {
      expect(names.has(r), `Missing required field: ${r}`).toBeTruthy();
    }

    // 3) Read items (List reachability)
    const items0Res = await api.get(
      `/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$top=1&$select=Id`
    );
    await ensureOk(items0Res, 'Items fetch');

    // Get digest for POST/MERGE
    const ctxRes = await api.post(`/_api/contextinfo`, {
      headers: { Accept: 'application/json;odata=nometadata' },
    });
    await ensureOk(ctxRes, 'Context info');
    const digest = (await ctxRes.json())?.FormDigestValue;
    expect(typeof digest, 'Digest must be string').toBe('string');

    // Test payload (fixed composite key for integration)
    const payload = {
      __metadata: { type: entityType },
      date: FIXED_DATE,
      targetType: 'User',
      targetId: 'E2E_INTEGRATION',
      kind: 'EarlyLeave',
      time: '11:00',
      summary: 'integration upsert',
      status: 'Active',
      source: 'E2E',
    };

    // Helper: find existing item with same composite key
    const filter = [
      `date eq datetime'${payload.date}'`,
      `targetType eq '${payload.targetType}'`,
      `targetId eq '${payload.targetId}'`,
      `kind eq '${payload.kind}'`,
    ].join(' and ');

    async function findExistingId(): Promise<number | null> {
      const res = await api.get(
        `/_api/web/lists/getbytitle('${LIST_TITLE}')/items?` +
          `$select=Id,status&$filter=${encodeURIComponent(filter)}&$top=5`
      );
      await ensureOk(res, 'Find existing');
      const json = await res.json();
      const v = json?.value ?? [];
      if (!Array.isArray(v) || v.length === 0) return null;
      return v[0].Id as number;
    }

    // Upsert 1st time
    let id = await findExistingId();
    if (id == null) {
      const createRes = await api.post(`/_api/web/lists/getbytitle('${LIST_TITLE}')/items`, {
        headers: {
          'X-RequestDigest': digest,
          'Content-Type': 'application/json;odata=verbose',
          Accept: 'application/json;odata=nometadata',
        },
        data: payload,
      });
      await ensureOk(createRes, 'Create');
      id = (await createRes.json())?.Id;
      expect(typeof id, 'Created item ID must be number').toBe('number');
    }

    // Upsert 2nd time (idempotent: count should not increase)
    const before = await api.get(
      `/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$select=Id&$filter=${encodeURIComponent(filter)}`
    );
    await ensureOk(before, 'Before upsert count');
    const beforeCount = ((await before.json())?.value ?? []).length;

    // Update same record (MERGE)
    const mergeRes = await api.post(`/_api/web/lists/getbytitle('${LIST_TITLE}')/items(${id})`, {
      headers: {
        'X-RequestDigest': digest,
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE',
        'Content-Type': 'application/json;odata=verbose',
        Accept: 'application/json;odata=nometadata',
      },
      data: {
        __metadata: { type: entityType },
        summary: 'integration upsert (2)',
        status: 'Active',
      },
    });
    await ensureOk(mergeRes, 'Merge');

    const after = await api.get(
      `/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$select=Id&$filter=${encodeURIComponent(filter)}`
    );
    await ensureOk(after, 'After upsert count');
    const afterCount = ((await after.json())?.value ?? []).length;
    expect(afterCount, 'Idempotent upsert: count must not increase').toBe(beforeCount);

    // Resolve (set status to Resolved)
    const resolveRes = await api.post(
      `/_api/web/lists/getbytitle('${LIST_TITLE}')/items(${id})`,
      {
        headers: {
          'X-RequestDigest': digest,
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE',
          'Content-Type': 'application/json;odata=verbose',
          Accept: 'application/json;odata=nometadata',
        },
        data: {
          __metadata: { type: entityType },
          status: 'Resolved',
        },
      }
    );
    await ensureOk(resolveRes, 'Resolve');

    const finalRes = await api.get(
      `/_api/web/lists/getbytitle('${LIST_TITLE}')/items(${id})?$select=Id,status`
    );
    await ensureOk(finalRes, 'Final fetch');
    const finalItem = await finalRes.json();
    expect(finalItem?.status, 'Status must be Resolved').toBe('Resolved');

    await api.dispose();
  });
});
