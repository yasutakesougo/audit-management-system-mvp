import { expect, test, type APIResponse } from '@playwright/test';
import { extractSharePointAccessToken, loadAuthState } from './sharePointTokenExtractor';

const SP_RESOURCE = process.env.VITE_SP_RESOURCE ?? 'https://isogokatudouhome.sharepoint.com';
const SP_SITE_RELATIVE = process.env.VITE_SP_SITE_RELATIVE ?? '/sites/app-test';
const LIST_TITLE = 'Staff_Master';
const FIXED_STAFF_ID = 'E2E_INTEGRATION_STAFF_0001';
const FIXED_HIRE_DATE_ISO = '2000-01-01T00:00:00Z';

async function ensureOk(res: APIResponse, label: string): Promise<void> {
  if (res.ok()) return;

  const status = res.status();
  const headers = res.headers();
  const spid =
    headers['sprequestguid'] ??
    headers['request-id'] ??
    headers['x-ms-diagnostics-session'] ??
    'n/a';

  let bodySnippet = '';
  try {
    const text = await res.text();
    bodySnippet = (text ?? '').slice(0, 400);
  } catch {
    bodySnippet = '<unreadable body>';
  }

  throw new Error(`[integration][${label}] status=${status} sprequestguid=${spid}\n${bodySnippet}`);
}

test.describe('Staff_Master (SharePoint REST) integration', () => {
  test('reachability + schema + idempotent upsert + update', async ({ request }) => {
    const state = loadAuthState();
    const accessToken = extractSharePointAccessToken(state, SP_RESOURCE);

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=nometadata',
    };

    const apiBase = `${SP_RESOURCE}${SP_SITE_RELATIVE}/_api/web/lists/getbytitle('${LIST_TITLE}')/items`;
    const selectFields = [
      'Id',
      'Title',
      'StaffID',
      'FullName',
      'Role',
      'IsActive',
      'Department',
      'HireDate',
      'Email',
      'Modified',
    ].join(',');

    // 1) List reachability
    const reachability = await request.get(`${apiBase}?$top=1`, { headers });
    await ensureOk(reachability, 'list reachability');
    const reachabilityJson = await reachability.json();
    expect(Array.isArray(reachabilityJson.value)).toBeTruthy();

    // 2) Schema (select specific fields)
    const schemaRes = await request.get(`${apiBase}?$top=1&$select=${selectFields}`, { headers });
    await ensureOk(schemaRes, 'schema select');
    const schemaJson = await schemaRes.json();
    expect(schemaJson.value).toBeTruthy();

    const filter = `StaffID eq '${FIXED_STAFF_ID}'`;
    const selectParam = encodeURIComponent(selectFields);
    const filterParam = encodeURIComponent(filter);

    const findByStaffId = async () => {
      const res = await request.get(
        `${apiBase}?$top=2&$select=${selectParam}&$filter=${filterParam}`,
        { headers },
      );
      await ensureOk(res, 'find by StaffID');
      const json = await res.json();
      const value = json?.value;
      return Array.isArray(value) && value.length > 0 ? value[0] : null;
    };

    const createItem = async (): Promise<number> => {
      const payload = {
        Title: `E2E Staff ${FIXED_STAFF_ID}`,
        StaffID: FIXED_STAFF_ID,
        FullName: 'E2E Staff Member',
        Role: 'E2E',
        Department: 'E2E',
        IsActive: true,
        HireDate: FIXED_HIRE_DATE_ISO,
        Email: 'e2e-staff@example.invalid',
      };

      const res = await request.post(apiBase, { headers, data: payload });
      await ensureOk(res, 'create');
      const json = await res.json();
      if (typeof json?.Id !== 'number') {
        throw new Error('create did not return Id');
      }
      return json.Id as number;
    };

    const mergeItem = async (id: number, patch: Record<string, unknown>) => {
      const res = await request.post(`${apiBase}(${id})`, {
        headers: {
          ...headers,
          'X-HTTP-Method': 'MERGE',
          'IF-MATCH': '*',
        },
        data: patch,
      });
      await ensureOk(res, 'merge');
    };

    // 3) Idempotent upsert (fixed StaffID)
    const before = await findByStaffId();

    let item = before;
    if (!item?.Id) {
      const id = await createItem();
      item = { Id: id };
    } else {
      await mergeItem(item.Id, { FullName: 'E2E Staff Member' });
    }

    // Upsert again (should not increase count)
    const itemAgain = await findByStaffId();
    if (!itemAgain?.Id) throw new Error('upsert #2 lookup failed');
    await mergeItem(itemAgain.Id, { FullName: 'E2E Staff Member v2' });

    const afterRes = await request.get(
      `${apiBase}?$top=5&$select=${selectParam}&$filter=${filterParam}`,
      { headers },
    );
    await ensureOk(afterRes, 'count after upsert');
    const afterJson = await afterRes.json();
    const afterCount = Array.isArray(afterJson.value) ? afterJson.value.length : 0;
    expect(afterCount).toBe(1);

    const finalItem = afterJson.value?.[0];
    if (!finalItem?.Id) throw new Error('final item missing Id');

    // 4) Update / deactivate
    await mergeItem(finalItem.Id, { IsActive: false });

    const verify = await findByStaffId();
    expect(verify).toBeTruthy();
    expect(verify?.IsActive).toBe(false);
  });
});
