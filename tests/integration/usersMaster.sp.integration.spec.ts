import { test, expect, type APIResponse } from '@playwright/test';
import { loadAuthState, extractSharePointAccessToken } from './sharePointTokenExtractor';

const SP_RESOURCE = process.env.VITE_SP_RESOURCE ?? 'https://isogokatudouhome.sharepoint.com';
const SP_SITE_RELATIVE = process.env.VITE_SP_SITE_RELATIVE ?? '/sites/app-test';
const LIST_TITLE = 'Users_Master';

// NOTE: fixed key to keep nightly integration idempotent (does not grow test data)
// If multi-tenant or parallel runs are introduced in future, suffix with tenant/env id (e.g., E2E_INTEGRATION_USER_${TENANT}_${ENV})
const FIXED_USER_ID = 'E2E_INTEGRATION_USER_0001';

async function ensureOk(res: APIResponse, label: string): Promise<void> {
  if (res.ok()) return;

  const status = res.status();
  const spid =
    res.headers()['sprequestguid'] ??
    res.headers()['request-id'] ??
    'n/a';
  let bodySnippet = '';
  try {
    const text = await res.text();
    bodySnippet = text.slice(0, 400);
  } catch {
    bodySnippet = '<unreadable body>';
  }

  throw new Error(
    `[integration][${label}] status=${status} sprequestguid=${spid}\n${bodySnippet}`
  );
}

test.describe('Users_Master (SharePoint REST) integration', () => {
  test('List reachability + schema + idempotent upsert + update', async ({ request }) => {
    // Load authentication state (produced by npm run auth:setup)
    const state = loadAuthState();
    const accessToken = extractSharePointAccessToken(state, SP_RESOURCE);

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=nometadata',
    };

    // ---- 1) List Reachability ----
    const listItemsUrl =
      `${SP_RESOURCE}${SP_SITE_RELATIVE}/_api/web/lists/getbytitle('${LIST_TITLE}')/items` +
      `?$top=1&$select=Id,UserID,Title,FullName,IsActive,Modified`;

    const resList = await request.get(listItemsUrl, { headers });
    await ensureOk(resList, 'list-reachability');

    const jsonList = await resList.json();
    expect(jsonList.value).toBeTruthy();
    expect(Array.isArray(jsonList.value)).toBe(true);

    // ---- 2) Schema (verify selected fields exist) ----
    if (Array.isArray(jsonList.value) && jsonList.value.length > 0) {
      const row = jsonList.value[0];
      for (const field of ['Id', 'UserID', 'Title', 'FullName', 'IsActive', 'Modified']) {
        expect(row).toHaveProperty(field);
      }
    }

    // ---- 3) Idempotent Upsert (fixed UserID) ----
    const findUrl =
      `${SP_RESOURCE}${SP_SITE_RELATIVE}/_api/web/lists/getbytitle('${LIST_TITLE}')/items` +
      `?$filter=UserID eq '${FIXED_USER_ID}'` +
      `&$select=Id,UserID,Title,FullName,IsActive,Modified`;

    // Before upsert
    const beforeRes = await request.get(findUrl, { headers });
    await ensureOk(beforeRes, 'find-before');
    const beforeJson = await beforeRes.json();
    const beforeCount = beforeJson.value?.length ?? 0;

    // Upsert twice to verify idempotency
    async function upsertOnce(): Promise<void> {
      const found = await request.get(findUrl, { headers });
      await ensureOk(found, 'find-for-upsert');
      const foundJson = await found.json();
      const existing = foundJson.value?.[0];

      const payload = {
        UserID: FIXED_USER_ID,
        Title: 'E2E Integration User',
        FullName: 'E2E Integration User',
        IsActive: true,
      };

      if (!existing) {
        // Create new item
        const createUrl = `${SP_RESOURCE}${SP_SITE_RELATIVE}/_api/web/lists/getbytitle('${LIST_TITLE}')/items`;
        const created = await request.post(createUrl, {
          headers,
          data: payload,
        });
        await ensureOk(created, 'create');
        return;
      }

      // Update existing item (MERGE)
      const itemId = existing.Id;
      const updateUrl = `${SP_RESOURCE}${SP_SITE_RELATIVE}/_api/web/lists/getbytitle('${LIST_TITLE}')/items(${itemId})`;
      const updated = await request.post(updateUrl, {
        headers: {
          ...headers,
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE',
        },
        data: payload,
      });
      await ensureOk(updated, 'merge');
    }

    await upsertOnce();
    await upsertOnce();

    // After upsert: count should not increase
    const afterRes = await request.get(findUrl, { headers });
    await ensureOk(afterRes, 'find-after');
    const afterJson = await afterRes.json();
    const afterCount = afterJson.value?.length ?? 0;

    // "Does not grow": after count should be at least 1 (created if missing), at most same as before if already existed
    expect(afterCount).toBeGreaterThanOrEqual(1);
    expect(afterCount).toBeLessThanOrEqual(Math.max(1, beforeCount));

    // ---- 4) Update Reflection (FullName change) ----
    const existing = afterJson.value[0];
    const itemId = existing.Id;

    // Update FullName
    const updateUrl = `${SP_RESOURCE}${SP_SITE_RELATIVE}/_api/web/lists/getbytitle('${LIST_TITLE}')/items(${itemId})`;
    const updateNewFullName = 'E2E Integration User (Updated)';
    const patch = await request.post(updateUrl, {
      headers: {
        ...headers,
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE',
      },
      data: { FullName: updateNewFullName },
    });
    await ensureOk(patch, 'merge-update-fullname');

    // Verify update was applied
    const verify = await request.get(findUrl, { headers });
    await ensureOk(verify, 'verify-update');
    const verifyJson = await verify.json();
    expect(verifyJson.value[0].FullName).toBe(updateNewFullName);
  });
});
