import { describe, expect, it, vi } from 'vitest';
import { ensureListExists } from '../spListSchema';

const jsonResponse = (value: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

describe('ensureListExists boundaries', () => {
  it('既存リストが見つかり、preventPhysicalCreation=true のとき項目追加を行わない', async () => {
    const spFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        d: {
          Id: '{11111111-1111-1111-1111-111111111111}',
          Title: 'SupportOrders',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        value: [{ InternalName: 'UserName', TypeAsString: 'Text' }],
      }));

    const result = await ensureListExists(
      spFetch,
      'SupportOrders',
      [{ internalName: 'NewColumn', typeAsString: 'Text', required: true }],
      { preventPhysicalCreation: true },
    );

    expect(result).toEqual({
      listId: '11111111-1111-1111-1111-111111111111',
      title: 'SupportOrders',
    });
    expect(spFetch).toHaveBeenCalledTimes(1);
    expect(spFetch).toHaveBeenNthCalledWith(
      1,
      "/lists/getbytitle('SupportOrders')?$select=Id,Title",
      { spOptions: undefined },
    );
  });

  it('404 が返る場合は create を行い、新規リストを作成結果として返す', async () => {
    const spFetch = vi.fn();
    spFetch
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce(jsonResponse({
        Id: '{22222222-2222-2222-2222-222222222222}',
        Title: 'BillingOrders',
      }));

    const result = await ensureListExists(spFetch, 'BillingOrders', []);

    expect(spFetch).toHaveBeenCalledTimes(2);
    expect(spFetch).toHaveBeenNthCalledWith(
      1,
      "/lists/getbytitle('BillingOrders')?$select=Id,Title",
      { spOptions: undefined },
    );
    expect(spFetch).toHaveBeenNthCalledWith(
      2,
      '/lists',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json;odata=verbose',
        }),
      }),
    );
    expect(result).toEqual({
      listId: '22222222-2222-2222-2222-222222222222',
      title: 'BillingOrders',
    });
  });

  it('preventPhysicalCreation が true の場合、リスト作成後にフィールド追加は行わない', async () => {
    const spFetch = vi.fn()
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce(jsonResponse({
        Id: '{33333333-3333-3333-3333-333333333333}',
        Title: 'QAList',
      }));

    const result = await ensureListExists(
      spFetch,
      'QAList',
      [{ internalName: 'NewColumn', typeAsString: 'Text', required: true }],
      { preventPhysicalCreation: true },
    );

    expect(spFetch).toHaveBeenCalledTimes(2);
    expect(spFetch).toHaveBeenNthCalledWith(
      2,
      '/lists',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json;odata=verbose',
        }),
      }),
    );
    expect(result).toEqual({
      listId: '33333333-3333-3333-3333-333333333333',
      title: 'QAList',
    });
  });
});
