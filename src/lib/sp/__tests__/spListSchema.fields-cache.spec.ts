import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __clearFieldInternalNamesRuntimeCacheForTests,
  getListFieldInternalNames,
} from '../spListSchema';

const baseUrl = 'https://example.sharepoint.com/sites/welfare/_api/web';

const fieldsResponse = () =>
  new Response(JSON.stringify({
    value: [
      { InternalName: 'Title' },
      { InternalName: 'UserCode' },
      { InternalName: 'RecordDate' },
    ],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('getListFieldInternalNames cache', () => {
  beforeEach(() => {
    __clearFieldInternalNamesRuntimeCacheForTests();
    sessionStorage.clear();
  });

  it('shares one in-flight fields request for concurrent callers', async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const spFetch = vi.fn(() => pendingResponse);

    const first = getListFieldInternalNames(spFetch, baseUrl, 'SupportPlans');
    const second = getListFieldInternalNames(spFetch, baseUrl, 'SupportPlans');
    const third = getListFieldInternalNames(spFetch, baseUrl, 'SupportPlans');

    expect(spFetch).toHaveBeenCalledTimes(1);
    expect(spFetch).toHaveBeenCalledWith(
      "/lists/getbytitle('SupportPlans')/fields?$select=InternalName&$top=5000",
    );

    resolveFetch(fieldsResponse());

    await expect(first).resolves.toEqual(new Set(['Title', 'UserCode', 'RecordDate']));
    await expect(second).resolves.toEqual(new Set(['Title', 'UserCode', 'RecordDate']));
    await expect(third).resolves.toEqual(new Set(['Title', 'UserCode', 'RecordDate']));
    expect(spFetch).toHaveBeenCalledTimes(1);
  });

  it('uses runtime cache after the first successful fields request', async () => {
    const spFetch = vi.fn(async () => fieldsResponse());

    const first = await getListFieldInternalNames(spFetch, baseUrl, 'SupportPlans');
    first.add('InjectedByCaller');

    const second = await getListFieldInternalNames(spFetch, baseUrl, 'SupportPlans');

    expect(spFetch).toHaveBeenCalledTimes(1);
    expect(second).toEqual(new Set(['Title', 'UserCode', 'RecordDate']));
    expect(second.has('InjectedByCaller')).toBe(false);
  });
});
